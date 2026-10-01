import { useEffect, useState } from "react";

const HOVER_QUERY = "(hover: hover) and (pointer: fine)";

export default function useCanHover() {
  const [canHover, setCanHover] = useState(() =>
    typeof window !== "undefined" && window.matchMedia ? window.matchMedia(HOVER_QUERY).matches : false
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia(HOVER_QUERY);
    const onChange = event => setCanHover(event.matches);
    setCanHover(mediaQuery.matches);
    if (mediaQuery.addEventListener) mediaQuery.addEventListener("change", onChange);
    else mediaQuery.addListener(onChange);
    return () => {
      if (mediaQuery.removeEventListener) mediaQuery.removeEventListener("change", onChange);
      else mediaQuery.removeListener(onChange);
    };
  }, []);

  return canHover;
}