import { useState } from "react";
import { motion, Eye, EyeOff, GraduationCap, Mail, LockKeyhole, Users, GraduationCap as StudentIcon } from "../../shared/ui";
import { login } from "../../services/auth.service";
import { setAccessToken } from "../../services/apiClient";

export function LoginPage({ onLogin, onForgot }) {
  const [loginAs, setLoginAs] = useState("staff"); // "staff" | "student"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const data = await login(email.trim(), password);
      const role = String(data.user?.role || "").toLowerCase();
      const isStudentAccount = role === "student";
      const matchesSelection = loginAs === "student" ? isStudentAccount : !isStudentAccount;

      if (!matchesSelection) {
        setAccessToken("");
        setError("Invalid email or password.");
        return;
      }

      onLogin(data.user);
    } catch (err) {
      setError(err.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="edumanage-login-page">
      <div className="edumanage-login-overlay" aria-hidden="true" />

      <motion.section
        className="edumanage-login-card"
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        aria-label="PCA Pvt. Ltd sign in"
      >
        <div className="edumanage-login-logo" aria-hidden="true">
          <GraduationCap size={34} strokeWidth={2.2} />
        </div>

        <div className="edumanage-login-heading">
          <h1>Welcome back</h1>
          <p>{loginAs === "staff" ? "Sign in to the staff portal." : "Sign in to the student portal."}</p>
        </div>

        <div style={{ marginBottom: 18 }}>
         <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => setLoginAs("staff")}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "12px 10px", borderRadius: 12, cursor: "pointer",
                border: loginAs === "staff" ? "1.5px solid #6d4cff" : "1.5px solid #d9dfeb",
                background: loginAs === "staff" ? "rgba(109,76,255,.08)" : "#fff",
                color: loginAs === "staff" ? "#5b3df5" : "#5b6478",
                fontWeight: 700, fontSize: 14, transition: "all .15s",
              }}
            >
              <Users size={17} /> Staff
            </button>
            <button
              type="button"
              onClick={() => setLoginAs("student")}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "12px 10px", borderRadius: 12, cursor: "pointer",
                border: loginAs === "student" ? "1.5px solid #6d4cff" : "1.5px solid #d9dfeb",
                background: loginAs === "student" ? "rgba(109,76,255,.08)" : "#fff",
                color: loginAs === "student" ? "#5b3df5" : "#5b6478",
                fontWeight: 700, fontSize: 14, transition: "all .15s",
              }}
            >
              <StudentIcon size={17} /> Student
            </button>
          </div>
        </div>

        {error && (
          <div className="edumanage-login-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={submit} noValidate>
          <label className="edumanage-login-label" htmlFor="login-email">
            Email address
          </label>
          <div className="edumanage-login-input-wrap">
            <Mail className="edumanage-login-input-icon" size={19} aria-hidden="true" />
            <input
              id="login-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="username"
              placeholder="you@school.edu"
              autoFocus
            />
          </div>

          <label className="edumanage-login-label" htmlFor="login-password">
            Password
          </label>
          <div className="edumanage-login-input-wrap">
            <LockKeyhole className="edumanage-login-input-icon" size={19} aria-hidden="true" />
            <input
              id="login-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
            />
            <button
              type="button"
              className="edumanage-password-toggle"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>

          <div className="edumanage-login-forgot-row">
            <button type="button" onClick={onForgot} className="edumanage-login-forgot">
              Forgot password?
            </button>
          </div>

          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.995 }}
            disabled={loading}
            type="submit"
            className="edumanage-login-submit"
          >
            {loading ? "Signing in…" : "Sign in"}
          </motion.button>
        </form>

        <p className="edumanage-login-footer">Protected school portal • Authorized users only</p>
      </motion.section>
    </main>
  );
}