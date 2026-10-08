import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, Search, motion } from "../../shared/ui";
import { C } from "../../shared/runtime";
import { Portal } from "../common/Portal";

export function MultiSelectDropdown({
  label,
  icon: Icon,
  options,
  selectedIds,
  onChange,
  disabled = false,
  placeholder = "Select...",
  emptyText = "No options available",
  getId = option => option?._id || option?.id,
  getLabel = option => option?.name || "Unnamed",
  getSecondary = () => "",
  accent = C.accent,
  single = false,
  searchable = true,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rect, setRect] = useState(null);
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const updateRect = useCallback(() => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
  }, []);

  useEffect(() => {
    const handleOutsideClick = event => {
      const inTrigger = wrapperRef.current?.contains(event.target);
      const inMenu = menuRef.current?.contains(event.target);
      if (!inTrigger && !inMenu) {
        setOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Keep the floating menu attached to its field while the page/modal scrolls or resizes
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [open, updateRect]);

  const toggleOpen = () => {
    if (disabled) return;
    if (open) {
      setOpen(false);
      return;
    }
    updateRect();
    setOpen(true);
  };

  const selected = Array.isArray(selectedIds) ? selectedIds.map(String) : [];
  const safeOptions = Array.isArray(options) ? options : [];
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = safeOptions.filter(option => {
    const optionLabel = String(getLabel(option) || "").toLowerCase();
    const secondaryLabel = String(getSecondary(option) || "").toLowerCase();
    return !normalizedQuery || optionLabel.includes(normalizedQuery) || secondaryLabel.includes(normalizedQuery);
  });

  const selectedOption = single && selected.length
    ? safeOptions.find(option => String(getId(option)) === selected[0])
    : null;

  const allFilteredSelected =
    filteredOptions.length > 0 &&
    filteredOptions.every(option => selected.includes(String(getId(option))));

  const toggleOption = id => {
    const value = String(id);
    if (single) {
      onChange(selected.includes(value) ? [] : [value]);
      setOpen(false);
      setQuery("");
      return;
    }
    onChange(
      selected.includes(value)
        ? selected.filter(item => item !== value)
        : [...selected, value]
    );
  };

  const toggleAll = () => {
    const filteredIds = filteredOptions.map(option => String(getId(option)));
    if (!filteredIds.length) return;

    onChange(
      allFilteredSelected
        ? selected.filter(id => !filteredIds.includes(id))
        : Array.from(new Set([...selected, ...filteredIds]))
    );
  };

  // Keep the menu fully on screen: open upward when there is not enough room
  // below, and shrink the options list to the space available.
  const spaceBelow = rect ? window.innerHeight - rect.bottom - 12 : 0;
  const spaceAbove = rect ? rect.top - 12 : 0;
  const openUp = spaceBelow < 260 && spaceAbove > spaceBelow;
  const optionsMaxHeight = Math.max(100, Math.min(220, (openUp ? spaceAbove : spaceBelow) - 100));

  return (
    <div ref={wrapperRef} style={{ marginBottom: 16, position: "relative" }}>
      <label style={styles.label}>
        {Icon && <Icon size={14} color={accent} aria-hidden="true" />}
        {label}
      </label>

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggleOpen}
        style={{
          ...styles.trigger,
          borderColor: open ? accent : C.border,
          background: disabled ? "#f8fafc" : "#fff",
          color: selected.length ? C.text : C.muted,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <span>
          {disabled
            ? "Loading..."
            : single
              ? (selectedOption ? getLabel(selectedOption) : placeholder)
              : selected.length
                ? `${selected.length} ${label.toLowerCase()} selected`
                : placeholder}
        </span>
        <span aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>

      <Portal>
        <AnimatePresence>
          {open && !disabled && rect && (
            <motion.div
              ref={menuRef}
              role="listbox"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                ...styles.menu,
                left: rect.left,
                width: rect.width,
                ...(openUp
                  ? { bottom: window.innerHeight - rect.top + 6 }
                  : { top: rect.bottom + 6 }),
              }}
            >
              {searchable && (
                <div style={styles.searchRow}>
                  <Search size={14} color={C.muted} aria-hidden="true" />
                  <input
                    type="search"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder={`Search ${label.toLowerCase()}...`}
                    aria-label={`Search ${label.toLowerCase()}`}
                    autoFocus
                    style={styles.searchInput}
                  />
                </div>
              )}

              {!single && filteredOptions.length > 0 && (
                <button type="button" onClick={toggleAll} style={styles.selectAll}>
                  {allFilteredSelected ? "Unselect All" : "Select All"}
                </button>
              )}

              <div style={{ ...styles.options, maxHeight: optionsMaxHeight }}>
                {!filteredOptions.length ? (
                  <div style={styles.emptyState}>
                    {safeOptions.length ? "No matching results" : emptyText}
                  </div>
                ) : (
                  filteredOptions.map(option => {
                    const id = String(getId(option));
                    const checked = selected.includes(id);
                    const secondary = getSecondary(option);

                    return (
                      <button
                        key={id}
                        type="button"
                        role="option"
                        aria-selected={checked}
                        onClick={() => toggleOption(id)}
                        style={{
                          ...styles.option,
                          background: checked ? `${accent}0d` : "transparent",
                        }}
                      >
                        <span style={{ ...styles.checkmark, color: accent }} aria-hidden="true">
                          {checked ? "✓" : ""}
                        </span>
                        <span>
                          <strong>{getLabel(option)}</strong>
                          {secondary && <small style={styles.secondary}>{secondary}</small>}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Portal>
    </div>
  );
}

const styles = {
  label: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    marginBottom: 7,
    color: "#172554",
    fontSize: 13,
    fontWeight: 700,
  },
  trigger: {
    width: "100%",
    minHeight: 44,
    padding: "8px 12px",
    border: "1.5px solid",
    borderRadius: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    fontSize: 13,
    boxSizing: "border-box",
  },
  menu: {
    position: "fixed",
    zIndex: 10020,
    overflow: "hidden",
    background: "#fff",
    border: "1px solid #dbe4ff",
    borderRadius: 13,
    boxShadow: "0 18px 40px rgba(15,23,42,.16)",
  },
  searchRow: {
    display: "flex",
    gap: 7,
    padding: 9,
    borderBottom: "1px solid #eef2f7",
  },
  searchInput: { width: "100%", border: 0, outline: 0 },
  selectAll: {
    width: "100%",
    padding: 10,
    border: 0,
    borderBottom: "1px solid #eef2f7",
    background: "#f8fafc",
    textAlign: "left",
    cursor: "pointer",
  },
  options: { maxHeight: 220, overflowY: "auto", padding: 6 },
  emptyState: { padding: 18, textAlign: "center", color: C.muted },
  option: {
    width: "100%",
    display: "flex",
    gap: 10,
    padding: "9px 8px",
    border: 0,
    borderRadius: 9,
    textAlign: "left",
    cursor: "pointer",
  },
  checkmark: { width: 18, flexShrink: 0 },
  secondary: { display: "block", color: C.muted },
};