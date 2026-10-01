import { useState, useEffect, useRef } from "react";
import { C } from "../../shared/runtime";
import { Avatar } from "../../components/common/Avatar";
import { api } from "../../services/apiClient";
import { me } from "../../services/auth.service";

function ProfilePage({ role, userData }) {
  const isAdmin = role === "admin";
  const [tab, setTab]         = useState("Edit Profile");
  const [profile, setProfile] = useState(userData || {});
  const [editForm, setEditForm] = useState(userData || {});
  const [saved, setSaved]     = useState(false);
  const [pwForm, setPwForm]   = useState({ current:"", newPw:"", confirm:"" });
  const [pwError, setPwError] = useState("");
  const [apiError, setApiError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [saving, setSaving]   = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [preview, setPreview] = useState("");
  const fileRef = useRef(null);

 const mediaBase = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");

  // Build avatar URL — keep preview until we have a confirmed backend URL
  const getAvatarSrc = () => {
    if (preview) return preview;
    if (!profile?.avatar) return "";
    if (profile.avatar.startsWith("http")) return profile.avatar;
   return mediaBase + (profile.avatar.startsWith("/") ? "" : "/") + profile.avatar;
  };

  const avatarSrc = getAvatarSrc();

  useEffect(() => {
    me().then(u => {
      const merged = { ...(userData || {}), ...u };
      setProfile(merged);
      setEditForm(merged);
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setApiError("");
    try {
      const r = await api.patch("/profile", {
        name:    editForm.name,
        email:   editForm.email,
        phone:   editForm.phone,
        address: editForm.address,
      });
      const updated = { ...profile, ...r.data };
      setProfile(updated);
      setEditForm(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setApiError(e.message || "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg","image/png","image/webp"].includes(file.type)) {
      setApiError("Please select a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setApiError("Profile image must be 5 MB or smaller.");
      return;
    }

    // Keep the selected file local until the user confirms with Save Photo.
    const local = URL.createObjectURL(file);
    setPreview(local);
    setPendingPhoto(file);
    setApiError("");
  };

  const handlePhotoSave = async () => {
    if (!pendingPhoto || uploading) return;
    setUploading(true);
    setApiError("");
    try {
      const form = new FormData();
      form.append("avatar", pendingPhoto);
      const r = await api.upload("/profile/avatar", form);
      const updated = r.data;
      // Update profile with new avatar path from server
      setProfile(p => ({ ...p, ...updated }));
      setEditForm(f => ({ ...f, ...updated }));
      setPendingPhoto(null);
      setPreview("");
    } catch (err) {
      setPreview(""); // clear broken preview
      setApiError(err.message || "Unable to upload profile image.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handlePwSave = async () => {
    if (changingPassword) return;
    if (!pwForm.current) { setPwError("Enter current password"); return; }
    if (pwForm.newPw.length < 8) { setPwError("New password must be at least 8 characters"); return; }
    if (pwForm.newPw !== pwForm.confirm) { setPwError("Passwords do not match"); return; }
    setChangingPassword(true);
    setPwError("");
    try {
      await api.post("/profile/password", {
        currentPassword: pwForm.current,
        newPassword:     pwForm.newPw,
      });
      setPwForm({ current:"", newPw:"", confirm:"" });
      setApiError("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setPwError(e.message || "Unable to change password.");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="pf-page" style={{ padding:28 }}>
      <style>{`
.pf-page { min-width: 0; max-width: 100%; box-sizing: border-box; overflow-x: clip; }
.pf-layout { display: flex; gap: 24px; align-items: flex-start; }
.pf-left { width: 300px; flex-shrink: 0; }
.pf-right { flex: 1; min-width: 0; }

@media (max-width: 768px) {
  .pf-page { padding: 14px !important; }
  .pf-layout { flex-direction: column; align-items: stretch; gap: 16px; }
  .pf-left { width: 100% !important; flex-shrink: 1; }
  .pf-right { width: 100%; flex: none; }
  .pf-card { padding: 18px !important; }
  .pf-tabs > button { flex: 1 1 auto; }
  .pf-save-row > button { width: 100%; }
}
`}</style>

      {/* ✅ FIXED: apiError now spans full width above the two columns */}
      {apiError && (
        <div style={{ background:"#fee2e2", color:"#dc2626", borderRadius:10,
          padding:"10px 16px", fontSize:13, marginBottom:16 }}>
          ⚠️ {apiError}
        </div>
      )}

      <div className="pf-layout">

        {/* Left Card */}
        <div className="pf-left">
          <div style={{ borderRadius:18, overflow:"hidden", boxShadow:"0 4px 20px rgba(0,0,0,.1)" }}>
            <div style={{ background:"linear-gradient(135deg,#4f6ef7,#7c3aed)", padding:"36px 24px 24px",
              display:"flex", flexDirection:"column", alignItems:"center" }}>

              {/* Avatar click to upload */}
              <button
                type="button"
                onClick={() => !uploading && fileRef.current?.click()}
                title="Change profile photo"
                style={{ position:"relative", width:80, height:80, borderRadius:"50%",
                  border:"3px solid "+C.teal, overflow:"hidden", marginBottom:14,
                  padding:0, background:"transparent", cursor:uploading?"wait":"pointer" }}
              >
                <Avatar name={profile.name} size={80} src={avatarSrc} />
                <span style={{ position:"absolute", inset:0, display:"grid", placeItems:"center",
                  background:"rgba(0,0,0,.45)", color:"white", fontSize:10, fontWeight:700,
                  // ✅ FIXED: always show overlay text on hover via opacity transition
                  opacity: uploading ? 1 : 0,
                  transition:"opacity .15s" }}>
                  {uploading ? "Uploading…" : "Change"}
                </span>
              </button>

              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarChange}
                style={{ display:"none" }}
              />

              <button
                type="button"
                onClick={() => !uploading && fileRef.current?.click()}
                disabled={uploading}
                style={{ marginTop:2, border:0, background:"transparent", color:"rgba(255,255,255,.9)",
                  fontSize:12, fontWeight:700, cursor:uploading?"wait":"pointer", textDecoration:"underline" }}
              >
                {pendingPhoto ? "Change photo" : "Upload photo"}
              </button>
              <button
                type="button"
                onClick={handlePhotoSave}
                disabled={uploading || !pendingPhoto}
                style={{ marginTop:8, border:0, borderRadius:8, background:C.teal, color:"#fff",
                  padding:"7px 14px", fontSize:12, fontWeight:700,
                  cursor:uploading?"wait":pendingPhoto?"pointer":"not-allowed",
                  opacity:uploading || !pendingPhoto ? .55 : 1 }}
              >
                {uploading ? "Saving…" : "Save Photo"}
              </button>

              <div style={{ color:"#fff", fontSize:18, fontWeight:700, textAlign:"center", overflowWrap:"anywhere" }}>{profile.name}</div>
              <div style={{ color:"rgba(255,255,255,.7)", fontSize:12, marginTop:4 }}>{profile.role}</div>
            </div>

            <div style={{ background:"#fff" }}>
              {[["Email", profile.email], ["Phone", profile.phone], ["Address", profile.address]].map(([l,v]) => (
                <div key={l} style={{ display:"flex", justifyContent:"space-between", gap:12,
                  padding:"12px 16px", borderBottom:"1px solid "+C.border, fontSize:13 }}>
                  <span style={{ color:C.muted, flexShrink:0 }}>{l}</span>
                  <span style={{ fontWeight:600, textAlign:"right", maxWidth:"70%", minWidth:0, overflowWrap:"anywhere" }}>{v || "—"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Form */}
        <div className="pf-right">
          <div className="pf-card" style={{ background:"#fff", borderRadius:14, padding:28, boxShadow:"0 2px 8px rgba(0,0,0,.06)" }}>

            {/* Tabs */}
            <div className="pf-tabs" style={{ display:"flex", gap:10, marginBottom:24, flexWrap:"wrap" }}>
              {(isAdmin ? ["Edit Profile","Change Password"] : ["Profile Details"]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTab(t); setPwError(""); setApiError(""); }}
                  style={{ padding:"9px 20px", borderRadius:8,
                    border: t===tab ? "none" : "1.5px solid "+C.border,
                    cursor:"pointer", fontWeight:700, fontSize:13,
                    background: t===tab ? C.accent : "#fff",
                    color: t===tab ? "#fff" : C.text,
                    boxShadow: t===tab ? "0 4px 12px rgba(79,110,247,.18)" : "none" }}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Edit Profile Tab */}
            {(tab === "Edit Profile" || !isAdmin) && (
              <>
                <div style={{ fontWeight:700, fontSize:17, marginBottom:20 }}>Edit Profile</div>
                {[
                  ["Full Name", "name"],
                  ["Email",     "email"],
                  ["Phone",     "phone"],
                  ["Address",   "address"],
                ].map(([label, key]) => (
                  <div key={key} style={{ marginBottom:16 }}>
                    <label style={{ fontSize:13, fontWeight:600, display:"block", marginBottom:6 }}>{label}</label>
                    <input
                      value={editForm[key] || ""}
                      onChange={e => setEditForm({ ...editForm, [key]: e.target.value })}
                      style={{ width:"100%", padding:"11px 14px", borderRadius:10,
                        border:"1.5px solid "+C.border, fontSize:13, outline:"none", boxSizing:"border-box" }}
                      onFocus={e => e.target.style.borderColor = C.accent}
                      onBlur={e => e.target.style.borderColor = C.border}
                    />
                  </div>
                ))}
                {isAdmin && (
                  <div className="pf-save-row" style={{ display:"flex", justifyContent:"flex-end", marginTop:24,
                    paddingTop:18, borderTop:"1px solid "+C.border }}>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleSave}
                      style={{ background: saved ? C.teal : C.accent,
                        color:"#fff", border:"none", borderRadius:10, padding:"12px 28px",
                        fontSize:14, fontWeight:700, cursor: saving ? "wait" : "pointer",
                        opacity: saving ? 0.75 : 1 }}
                    >
                      {saving ? "Saving…" : saved ? "✓ Changes Saved!" : "Save Changes"}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Change Password Tab */}
            {isAdmin && tab === "Change Password" && (
              <>
                <div style={{ fontWeight:700, fontSize:17, marginBottom:20 }}>Change Password</div>
                {[
                  ["Current Password", "current"],
                  ["New Password",     "newPw"],
                  ["Confirm Password", "confirm"],
                ].map(([label, key]) => (
                  <div key={key} style={{ marginBottom:16 }}>
                    <label style={{ fontSize:13, fontWeight:600, display:"block", marginBottom:6 }}>{label}</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={pwForm[key]}
                      onChange={e => { setPwForm({ ...pwForm, [key]: e.target.value }); setPwError(""); }}
                      style={{ width:"100%", padding:"11px 14px", borderRadius:10,
                        border:"1.5px solid "+(pwError ? "#dc2626" : C.border),
                        fontSize:13, outline:"none", boxSizing:"border-box" }}
                      onFocus={e => e.target.style.borderColor = C.accent}
                      onBlur={e => e.target.style.borderColor = pwError ? "#dc2626" : C.border}
                    />
                  </div>
                ))}
                {pwError && (
                  <div style={{ background:"#fee2e2", color:"#dc2626", borderRadius:8,
                    padding:"9px 14px", fontSize:13, marginBottom:16 }}>
                    ⚠️ {pwError}
                  </div>
                )}
                <button
                  type="button"
                  disabled={changingPassword}
                  onClick={handlePwSave}
                  style={{ marginTop:4, background: C.accent, color:"#fff", border:"none",
                    borderRadius:10, padding:"12px 28px", fontSize:14, fontWeight:700,
                    // ✅ FIXED: was changingPassword?.75 (broken) → changingPassword ? 0.75 : 1
                    cursor: changingPassword ? "wait" : "pointer",
                    opacity: changingPassword ? 0.75 : 1 }}
                >
                  {changingPassword ? "Updating…" : "Update Password"}
                </button>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

export { ProfilePage };