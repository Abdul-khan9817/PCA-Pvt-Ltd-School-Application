import { useState } from "react";
import { motion, ChevronDown, GraduationCap, LogOut } from "../../shared/ui";
import { C, ADMIN_NAV, TEACHER_NAV, STUDENT_NAV } from "../../shared/runtime";
import { useMediaQuery } from "../../hooks/useMediaQuery";

// true  → hovering the collapsed sidebar pushes the page over (nothing is ever hidden behind it)
// false → hovering only floats the sidebar over the page (old behaviour)
const PUSH_PAGE_ON_HOVER = true;

function Sidebar({ role, active, setActive, collapsed, setCollapsed, onLogout, mobileOpen = false, onMobileClose }) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [hovered, setHovered] = useState(false);

  // The sidebar panel is `position: fixed`; the spacer below reserves its space in the
  // flex layout so the page always sits to the right of it (see PUSH_PAGE_ON_HOVER).
  const pinnedWidth = isMobile ? 0 : (collapsed ? 68 : 230);
  const isFlyout = !isMobile && collapsed && hovered; // temporarily peeking open
  const sidebarWidth = isMobile
    ? (mobileOpen ? 260 : 0)
    : (isFlyout ? 230 : pinnedWidth);

  const effectiveCollapsed = isMobile ? false : (collapsed && !hovered);

  const isManagement = ["admin", "principal", "vice_principal"].includes(role);
  const allNav = isManagement ? ADMIN_NAV : role === "teacher" ? TEACHER_NAV : STUDENT_NAV;
  const logo = role === "admin" ? "Admin Portal" : role === "principal" || role === "vice_principal" ? "Management Portal" : role === "teacher" ? "Teacher Portal" : "Student Portal";

  // ✅ Remove logout from nav — we pin it at bottom always visible
    const navGroups = allNav.map(group => ({
    ...group,
    items: group.items.filter(item =>
      item.id !== "logout" &&
      (role === "admin" || item.id !== "user-accounts") &&
      (role !== "vice_principal" || item.id !== "fees")
    ),
  })).filter(group => group.items.length > 0);
  
  const NavButton = ({ item }) => {
    const Icon = item.icon;
    const isActive = active === item.id;
    return (
      <div style={{ position: "relative" }}>
        <button
          type="button"
          title={effectiveCollapsed ? item.label : ""}
          aria-label={item.label}
          onClick={() => { setActive(item.id); if (isMobile) onMobileClose?.(); }}
          style={{
            width: "100%", display: "flex", alignItems: "center",
            gap: effectiveCollapsed ? 0 : 12,
            padding: effectiveCollapsed ? "11px 0" : "11px 20px",
            justifyContent: effectiveCollapsed ? "center" : "flex-start",
            background: isActive ? "rgba(79,110,247,.25)" : "transparent",
            border: "none", cursor: "pointer", textAlign: "left",
            borderLeft: !effectiveCollapsed && isActive ? `3px solid ${C.accent}` : "3px solid transparent",
            color: isActive ? "#fff" : "rgba(255,255,255,.6)",
            transition: "all .15s",
          }}
        >
          {effectiveCollapsed && isActive && (
            <div style={{
              position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
              width: 3, height: 28, background: C.accent, borderRadius: "0 3px 3px 0",
            }} />
          )}
          <Icon size={18} />
          {!effectiveCollapsed && (
            <span style={{ fontSize: 13.5, fontWeight: isActive ? 600 : 400, whiteSpace: "nowrap" }}>
              {item.label}
            </span>
          )}
          {!effectiveCollapsed && isActive && (
            <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: C.accent }} />
          )}
        </button>
      </div>
    );
  };

  return (
    <>
      {/* Reserves the layout space the page must give up to the sidebar. It follows the sidebar's
          CURRENT width (same animation), so when the sidebar expands the page shifts/resizes with
          it instead of being hidden underneath. */}
      {!isMobile && (
        <motion.div
          initial={false}
          animate={{ width: PUSH_PAGE_ON_HOVER ? sidebarWidth : pinnedWidth }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          style={{ flexShrink: 0, height: "100vh" }}
        />
      )}

      <motion.div
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        onMouseEnter={() => !isMobile && setHovered(true)}
        onMouseLeave={() => !isMobile && setHovered(false)}
        style={{
          background: C.navy,
          height: "100vh",
          position: "fixed",
          top: 0, left: 0, zIndex: 1200,
          display: "flex", flexDirection: "column",
          overflowX: "hidden", flexShrink: 0,
          boxShadow: mobileOpen || isFlyout ? "4px 0 24px rgba(0,0,0,.3)" : "none",
          visibility: isMobile && !mobileOpen ? "hidden" : "visible",
        }}
      >
      {/* ── Logo (fixed top) ── */}
      <div style={{
        flexShrink: 0,
        padding: effectiveCollapsed ? "20px 0" : "22px 20px 18px",
        borderBottom: "1px solid rgba(255,255,255,.08)",
        display: "flex", alignItems: "center",
        justifyContent: effectiveCollapsed ? "center" : "space-between",
        gap: 10, position: "relative",
      }}>
        {!effectiveCollapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: "linear-gradient(135deg,#7c3aed,#4f6ef7)",
              display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
            }}>
              <GraduationCap size={20} color="#fff" />
              <div style={{
                width: 8, height: 8, borderRadius: "50%", background: C.teal,
                position: "absolute", bottom: -1, right: -1, border: "2px solid " + C.navy,
              }} />
            </div>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, whiteSpace: "nowrap" }}>PCA Pvt. Ltd</div>
              <div style={{ color: "rgba(255,255,255,.45)", fontSize: 11, whiteSpace: "nowrap" }}>{logo}</div>
            </div>
          </div>
        )}
        {effectiveCollapsed && (
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg,#7c3aed,#4f6ef7)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <GraduationCap size={18} color="#fff" />
          </div>
        )}
        <button
          type="button"
          aria-label={effectiveCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => { if (isMobile) onMobileClose?.(); else setCollapsed(!collapsed); }}
          style={{
            background: "rgba(255,255,255,.1)", border: "none", borderRadius: 8,
            width: 28, height: 28, cursor: "pointer", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            ...(effectiveCollapsed && !isMobile
              ? { position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)" }
              : {}),
          }}
        >
          <motion.div animate={{ rotate: effectiveCollapsed ? 0 : 180 }} transition={{ duration: 0.25 }}>
            <ChevronDown size={14} color="rgba(255,255,255,.7)" />
          </motion.div>
        </button>
      </div>

      {/* ── Nav (scrollable middle) ── */}
      <nav style={{
        flex: 1,
        overflowY: "auto",      // ✅ scroll the nav independently
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch", // ✅ smooth scroll on iOS
        padding: "12px 0",
      }}>
        {navGroups.map(group => (
          <div key={group.section}>
            {!effectiveCollapsed && (
              <div style={{
                color: "rgba(255,255,255,.35)", fontSize: 10, fontWeight: 700,
                letterSpacing: 1.2, padding: "12px 20px 4px", whiteSpace: "nowrap",
              }}>
                {group.section}
              </div>
            )}
            {effectiveCollapsed && <div style={{ height: 6 }} />}
            {group.items.map(item => <NavButton key={item.id} item={item} />)}
          </div>
        ))}
      </nav>

      {/* ── Logout (always pinned at bottom) ── */}
      <div style={{
        flexShrink: 0,
        borderTop: "1px solid rgba(255,255,255,.08)",
        padding: "8px 0",
      }}>
        <button
          type="button"
          onClick={onLogout}
          title={effectiveCollapsed ? "Logout" : ""}
          aria-label="Logout"
          style={{
            width: "100%", display: "flex", alignItems: "center",
            gap: effectiveCollapsed ? 0 : 12,
            padding: effectiveCollapsed ? "12px 0" : "12px 20px",
            justifyContent: effectiveCollapsed ? "center" : "flex-start",
            background: "transparent", border: "none", cursor: "pointer",
            color: "rgba(239,68,68,.85)", transition: "all .15s",
          }}
        >
          <LogOut size={18} />
          {!effectiveCollapsed && (
            <span style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: "nowrap" }}>
              Logout
            </span>
          )}
        </button>
      </div>
    </motion.div>
    </>
  );
}

export { Sidebar };