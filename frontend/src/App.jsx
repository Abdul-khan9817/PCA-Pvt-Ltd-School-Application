import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "./shared/ui";
import { C, PAGE_META } from "./shared/runtime";
import { Sidebar } from "./components/layout/Sidebar";
import { Topbar } from "./components/layout/Topbar";
import { renderPage } from "./app/renderPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { me, logout } from "./services/auth.service";
import { getAccessToken, setAccessToken } from "./services/apiClient";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { initSocket, disconnectSocket } from "./services/socket.service";

const roleLabel = role => ({ 
  admin: "Admin", 
  principal: "Principal", 
  vice_principal: "Vice Principal", 
  teacher: "Teacher", 
  student: "Student", 
 
}[role] || role);


const normalizeRole = roleStr => {
  if (!roleStr) return "admin";
  return roleStr
    .toLowerCase()
    .replace(/\s+/g, "_")              // Replace spaces with underscores: "vice principal" → "vice_principal"
    .replace("viceprincipal", "vice_principal")  // Handle typos without spaces
    .replace("vp", "vice_principal");   // Handle abbreviation
};


const normalizeUser = user => { 
  const rawRole = normalizeRole(user?.role || "admin"); 
  return { ...user, role: rawRole }; 
};

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(Boolean(getAccessToken()));
  const [page, setPage] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [authMode, setAuthMode] = useState(() => 
    new URLSearchParams(window.location.search).has("resetToken") ? "reset" : "login"
  );
  const [resetToken, setResetToken] = useState(() => 
    new URLSearchParams(window.location.search).get("resetToken") || ""
  );

  // Boot: Check if already logged in
  useEffect(() => {
    let active = true;
    if (!getAccessToken()) {
      setBooting(false);
      return () => { active = false; };
    }
    me()
      .then(data => {
        if (active) {
          const normalized = normalizeUser(data);
          setUser(normalized);
          initSocket(normalized);
        }
      })
      .catch((error) => {
        if (error?.status === 401) setAccessToken("");
      })
      .finally(() => {
        if (active) setBooting(false);
      });
    return () => { active = false; };
  }, []);

  const role = user?.role || "admin";
  const meta = PAGE_META[page] || { title: page, subtitle: "" };

  useEffect(() => {
    document.title = user ? `${meta.title} | PCA Pvt. Ltd` : "PCA Pvt. Ltd";
  }, [user, meta.title]);

  const clearAuthUrl = () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  const handleLogin = u => {
    const normalized = normalizeUser(u);
    setUser(normalized);
    initSocket(normalized);
    setPage("dashboard");
    clearAuthUrl();
  };

  const handleLogout = async () => {
    disconnectSocket();
    await logout();
    setUser(null);
    setPage("dashboard");
    setCollapsed(true);
    setMobileOpen(false);
  };

  // Show loading screen while checking auth
  if (booting) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: C.bg,
        fontFamily: "Inter,system-ui,sans-serif",
        color: C.muted
      }}>
        Loading PCA Pvt. Ltd…
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    if (authMode === "forgot") {
      return (
        <ForgotPasswordPage 
          onBack={() => setAuthMode("login")} 
          onResetToken={token => {
            setResetToken(token);
            setAuthMode("reset");
          }}
        />
      );
    }
    if (authMode === "reset") {
      return (
        <ResetPasswordPage 
          email={resetToken?.email}
          otp={resetToken?.otp}
          onBack={() => {
            setAuthMode("login");
            clearAuthUrl();
          }}
        />
      );
    }
    return (
      <LoginPage 
        onLogin={handleLogin} 
        onForgot={() => setAuthMode("forgot")}
      />
    );
  }

  // Get user role and check if supported
  const supportedRoles = ["admin", "principal", "vice_principal", "teacher", "student"];

  // Show error if role is not supported
  if (!supportedRoles.includes(role)) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: C.bg,
        fontFamily: "Inter,system-ui,sans-serif",
        padding: 24
      }}>
        <div style={{
          maxWidth: 520,
          background: C.white,
          borderRadius: 18,
          padding: 30,
          boxShadow: "0 10px 30px rgba(0,0,0,.08)",
          textAlign: "center"
        }}>
          <div style={{
            fontSize: 22,
            fontWeight: 800,
            color: C.text
          }}>
            Portal setup required
          </div>
          <div style={{
            fontSize: 14,
            color: C.muted,
            lineHeight: 1.6,
            marginTop: 8
          }}>
            Your account is authenticated as <strong>{roleLabel(role)}</strong>, 
            but this frontend currently contains the original Admin, Teacher and Student dashboard screens only.
          </div>
          <button 
            type="button" 
            onClick={handleLogout} 
            style={{
              marginTop: 20,
              border: 0,
              borderRadius: 10,
              height: 44,
              padding: "0 18px",
              background: C.accent,
              color: "white",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // Render main app with sidebar, topbar, and content
  return (
    <div 
      className="edumanage-shell" 
      style={{
        display: "flex",
        height: "100vh",
        background: C.bg,
        fontFamily: "Inter,system-ui,sans-serif",
        overflow: "hidden"
      }}
    >
      <Sidebar 
        isMobile={isMobile} 
        role={role} 
        active={page} 
        setActive={p => {
          setPage(p);
          if (isMobile) setMobileOpen(false);
        }} 
        collapsed={collapsed} 
        setCollapsed={setCollapsed} 
        mobileOpen={mobileOpen} 
        onMobileClose={() => setMobileOpen(false)} 
        onLogout={handleLogout}
      />
      
      {isMobile && mobileOpen && (
        <button 
          type="button" 
          aria-label="Close navigation" 
          className="edumanage-sidebar-backdrop" 
          onClick={() => setMobileOpen(false)} 
        />
      )}

      <div 
        className="edumanage-content" 
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minWidth: 0
        }}
      >
        <Topbar 
          title={meta.title} 
          subtitle={meta.subtitle} 
          userData={user} 
          setPage={setPage} 
          onLogout={handleLogout} 
          onMenu={() => setMobileOpen(true)} 
          isMobile={isMobile}
        />

        <main style={{ flex: 1, minWidth: 0, overflowY: "auto", overflowX: "auto" }}>
          <AnimatePresence mode="wait">
            <motion.div 
              key={page + role} 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }} 
              transition={{ duration: 0.18 }}
            >
              {renderPage(page, role, { 
                onLogout: handleLogout, 
                setPage, 
                userData: user 
              })}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}