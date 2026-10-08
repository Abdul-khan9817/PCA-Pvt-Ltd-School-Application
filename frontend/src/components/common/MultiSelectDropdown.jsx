import { useState, useRef, useEffect, useMemo, memo, useCallback } from "react";
import { ChevronDown, Search, X, Check } from "../../shared/ui";
import { C } from "../../shared/runtime";
import { Portal } from "./Portal";


function MultiSelectDropdownInner({
  label,
  options = [],
  selectedIds = [],
  onChange,
  placeholder = "Select...",
  loading = false,
  emptyText = "No options available"
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rect, setRect] = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const updateRect = useCallback(() => {
    if (triggerRef.current) {
      setRect(triggerRef.current.getBoundingClientRect());
    }
  }, []);

  const openPanel = () => {
    updateRect();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;

    const handleClick = e => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        panelRef.current && !panelRef.current.contains(e.target)
      ) {
        setOpen(false);
        setQuery("");
      }
    };
    const handleKey = e => {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    const handleReposition = () => updateRect();

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [open, updateRect]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedOptions = useMemo(
    () => options.filter(o => selectedSet.has(o.id)),
    [options, selectedSet]
  );
  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const toggle = id => {
    onChange(
      selectedSet.has(id)
        ? selectedIds.filter(x => x !== id)
        : [...selectedIds, id]
    );
  };

  const removeChip = (id, e) => {
    e.stopPropagation();
    onChange(selectedIds.filter(x => x !== id));
  };

  // Keep the panel fully inside the screen: open upward when there is not
  // enough room below, and shrink the options list to the space available.
  const spaceBelow = rect ? window.innerHeight - rect.bottom - 12 : 0;
  const spaceAbove = rect ? rect.top - 12 : 0;
  const openUp = spaceBelow < 260 && spaceAbove > spaceBelow;
  const listMaxHeight = Math.max(100, Math.min(200, (openUp ? spaceAbove : spaceBelow) - 100));

  return (
    <div style={{ marginBottom: 14 }}>
      <label
        style={{
          fontSize: 13,
          fontWeight: 600,
          display: "block",
          marginBottom: 6
        }}
      >
        {label}
      </label>

      {/* Control */}
      <div
        ref={triggerRef}
        onClick={() => (open ? setOpen(false) : openPanel())}
        style={{
          width: "100%",
          minHeight: 42,
          padding: "8px 12px",
          borderRadius: 10,
          border: "1.5px solid " + (open ? C.accent : C.border),
          background: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          boxSizing: "border-box"
        }}
      >
        <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {selectedOptions.length === 0 && (
            <span style={{ fontSize: 13, color: C.muted, padding: "2px 0" }}>
              {placeholder}
            </span>
          )}

          {selectedOptions.slice(0, 4).map(o => (
            <span
              key={o.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: "#eef2ff",
                color: C.accent,
                fontSize: 12,
                fontWeight: 600,
                padding: "3px 6px 3px 9px",
                borderRadius: 7
              }}
            >
              {o.label}
              <span
                onClick={e => removeChip(o.id, e)}
                style={{ display: "flex", cursor: "pointer", padding: 2, borderRadius: 5 }}
              >
                <X size={11} />
              </span>
            </span>
          ))}

          {selectedOptions.length > 4 && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.muted,
                background: "#f4f6fb",
                padding: "3px 8px",
                borderRadius: 7
              }}
            >
              +{selectedOptions.length - 4} more
            </span>
          )}
        </div>

        <ChevronDown
          size={16}
          color={C.muted}
          style={{
            flexShrink: 0,
            transition: "transform .15s ease",
            transform: open ? "rotate(180deg)" : "none"
          }}
        />
      </div>

      {/* Panel — portaled, positioned from the trigger's rect */}
      {open && rect && (
        <Portal>
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              ...(openUp
                ? { bottom: window.innerHeight - rect.top + 6 }
                : { top: rect.bottom + 6 }),
              left: rect.left,
              width: rect.width,
              zIndex: 10000,
              background: "#fff",
              border: "1.5px solid " + C.border,
              borderRadius: 12,
              boxShadow: "0 12px 28px rgba(30,42,74,.16)",
              overflow: "hidden"
            }}
          >
            <div style={{ padding: 8, borderBottom: "1px solid " + C.border }}>
              <div style={{ position: "relative" }}>
                <Search
                  size={13}
                  color={C.muted}
                  style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }}
                />
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={`Search ${label.toLowerCase()}...`}
                  style={{
                    width: "100%",
                    padding: "7px 10px 7px 28px",
                    borderRadius: 8,
                    border: "1px solid " + C.border,
                    fontSize: 13,
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 12px",
                background: "#f8fafc",
                fontSize: 11.5,
                color: C.muted,
                fontWeight: 600
              }}
            >
              <span>{selectedIds.length} selected</span>
              <div style={{ display: "flex", gap: 12 }}>
                <span
                  onClick={() => onChange(filtered.map(o => o.id))}
                  style={{ color: C.accent, cursor: "pointer" }}
                >
                  Select all
                </span>
                <span onClick={() => onChange([])} style={{ color: C.muted, cursor: "pointer" }}>
                  Clear
                </span>
              </div>
            </div>

            <div style={{ maxHeight: listMaxHeight, overflowY: "auto", padding: "4px 0" }}>
              {loading && (
                <div style={{ padding: 16, textAlign: "center", fontSize: 13, color: C.muted }}>
                  Loading...
                </div>
              )}

              {!loading && filtered.length === 0 && (
                <div style={{ padding: 16, textAlign: "center", fontSize: 13, color: C.muted }}>
                  {options.length === 0 ? emptyText : "No matches"}
                </div>
              )}

              {!loading &&
                filtered.map(o => {
                  const checked = selectedSet.has(o.id);
                  return (
                    <div
                      key={o.id}
                      onClick={() => toggle(o.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 12px",
                        cursor: "pointer",
                        fontSize: 13
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <span
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 5,
                          border: "1.5px solid " + (checked ? C.accent : C.border),
                          background: checked ? C.accent : "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0
                        }}
                      >
                        {checked && <Check size={11} color="#fff" />}
                      </span>
                      <span style={{ flex: 1, color: C.text }}>{o.label}</span>
                      {o.meta && <span style={{ fontSize: 11.5, color: C.muted }}>{o.meta}</span>}
                    </div>
                  );
                })}
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}

export const MultiSelectDropdown = memo(MultiSelectDropdownInner);