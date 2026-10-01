import { useState } from "react";
import { motion, Mail, ArrowLeft, ShieldCheck, Phone } from "../../shared/ui";
import { forgotPassword } from "../../services/auth.service";

export function ForgotPasswordPage({ onBack, onResetToken }) {
  const [email, setEmail]     = useState("");
  const [phone, setPhone]     = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError]     = useState("");
  const [otp, setOtp]         = useState("");
  const [awaitingOtp, setAwaitingOtp] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setError(""); setMessage("");
    if (!email.trim()) { setError("Enter your email address."); return; }
    if (awaitingOtp) {
      if (!/^\d{6}$/.test(otp)) { setError("Enter the 6-digit verification code."); return; }
      onResetToken({ email: email.trim().toLowerCase(), otp });
      return;
    }
    setLoading(true);
    try {
      const result = await forgotPassword(email.trim());
      setMessage(result.message);
      if (result.devOtp) onResetToken({ email: email.trim().toLowerCase(), otp: result.devOtp });
      else setAwaitingOtp(true);
    } catch (err) {
      setError(err.message || "Unable to process your request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="edumanage-login-page">
      <div className="edumanage-login-overlay" aria-hidden="true" />

      <motion.section
        className="edumanage-login-card"
        initial={{ opacity:0, y:18, scale:0.985 }}
        animate={{ opacity:1, y:0,  scale:1 }}
        transition={{ duration:0.3, ease:"easeOut" }}
      >
        {/* Logo */}
        <div className="edumanage-login-logo" aria-hidden="true">
          <ShieldCheck size={34} strokeWidth={2.2} />
        </div>

        {/* Heading with back arrow */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
          <button
            type="button"
            onClick={onBack}
            style={{ border:0, background:"transparent", cursor:"pointer",
              color:"#9ca3af", padding:4, borderRadius:8,
              display:"flex", alignItems:"center" }}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="edumanage-login-heading" style={{ marginBottom:0 }}>
            <h1 style={{ fontSize:26 }}>Forgot password?</h1>
            <p>We'll help you securely regain access.</p>
          </div>
        </div>

        {/* Success message */}
        {message && (
          <div style={{ background:"#ecfdf5", border:"1px solid #a7f3d0",
            color:"#047857", borderRadius:10, padding:12,
            fontSize:13, marginBottom:18 }}>
            {message}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="edumanage-login-error" role="alert">{error}</div>
        )}

        <form onSubmit={submit} noValidate>

          {/* ── Email field — same style as LoginPage ── */}
          <label className="edumanage-login-label" htmlFor="forgot-email">
            Email address
          </label>
          <div className="edumanage-login-input-wrap">
            <Mail className="edumanage-login-input-icon" size={19} aria-hidden="true" />
            <input
              id="forgot-email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              placeholder="you@school.edu"
              autoFocus
            />
          </div>

          {awaitingOtp && (
            <>
              <label className="edumanage-login-label" htmlFor="forgot-otp">Verification code</label>
              <div className="edumanage-login-input-wrap">
                <ShieldCheck className="edumanage-login-input-icon" size={19} aria-hidden="true" />
                <input
                  id="forgot-otp"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                />
              </div>
            </>
          )}

          {/* ── Mobile number field — same style ── */}
          <label className="edumanage-login-label" htmlFor="forgot-phone">
            Mobile number
          </label>
          <div className="edumanage-login-input-wrap">
            <Phone className="edumanage-login-input-icon" size={19} aria-hidden="true" />
            <input
              id="forgot-phone"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              type="tel"
              autoComplete="tel"
              placeholder="+1 000 000 0000"
            />
          </div>

          {/* ── Submit button — same hover as LoginPage ── */}
          <motion.button
            whileHover={{ y:-1 }}
            whileTap={{ scale:0.995 }}
            disabled={loading}
            type="submit"
            className="edumanage-login-submit"
            style={{ marginTop:8 }}
          >
            {loading ? "Sending…" : awaitingOtp ? "Continue" : "Send Code"}
          </motion.button>
        </form>

        {/* Back link */}
        <div style={{ textAlign:"center", marginTop:18 }}>
          <button
            type="button"
            onClick={onBack}
            style={{ border:0, background:"transparent", color:"#4f6ef7",
              fontSize:13, fontWeight:650, cursor:"pointer" }}
          >
            Back to sign in
          </button>
        </div>

        {/* Footer note */}
        <div style={{ display:"flex", gap:8, alignItems:"center",
          justifyContent:"center", marginTop:24, color:"#9ca3af", fontSize:11 }}>
          <ShieldCheck size={14} />
          Verification codes expire after 10 minutes
        </div>
      </motion.section>
    </main>
  );
}