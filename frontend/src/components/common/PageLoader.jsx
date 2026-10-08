import { useEffect, useState } from "react";
import "./PageLoader.css";

export default function PageLoader() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="loader-screen">
      <div className="loader-logo">PCA</div>
      <div className="loader-bar"><span /></div>
      <p className="loader-title">PCA Pvt. Ltd.</p>
      <p className="loader-sub">
        {slow
          ? "Waking up the server, this can take up to a minute…"
          : "Loading your workspace…"}
      </p>
    </div>
  );
}