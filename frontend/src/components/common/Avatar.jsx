import { useState } from "react";
import { avatarColor, initials } from "../../shared/runtime";

function Avatar({ name, size = 36, src }) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: avatarColor(name),
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: size * 0.36, fontWeight: 700,
      flexShrink: 0, overflow: "hidden",
    }}>
      {src && !imgFailed
        ? <img
            src={src}
            alt={name || "avatar"}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={() => setImgFailed(true)}
          />
        : <span>{initials(name)}</span>
      }
    </div>
  );
}

export { Avatar };