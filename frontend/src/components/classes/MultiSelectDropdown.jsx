import { useEffect, useRef, useState } from "react";
import { AnimatePresence, Search, motion } from "../../shared/ui";
import { C } from "../../shared/runtime";

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
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = event => {
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const selected = Array.isArray(selectedIds) ? selectedIds.map(String) : [];
  const safeOptions = Array.isArray(options) ? options : [];
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = safeOptions.filter(option => {
    const optionLabel = String(getLabel(option) || "").toLowerCase();
    const secondaryLabel = String(getSecondary(option) || "").toLowerCase();
    return !normalizedQuery || optionLabel.includes(normalizedQuery) || secondaryLabel.includes(normalizedQuery);
  });

  const allFilteredSelected =
    filteredOptions.length > 0 &&
    filteredOptions.every(option => selected.includes(String(getId(option))));

  const toggleOption = id => {
    const value = String(id);
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

  return (
    <div ref={wrapperRef} style={{ marginBottom: 16, position: "relative" }}>
      <label style={styles.label}>
        {Icon && <Icon size={14} color={accent} aria-hidden="true" />}
        {label}
      </label>

      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen(value => !value)}
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
            : selected.length
              ? `${selected.length} ${label.toLowerCase()} selected`
              : placeholder}
        </span>
        <span aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>

      <AnimatePresence>
        {open && !disabled && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={styles.menu}
          >
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

            {filteredOptions.length > 0 && (
              <button type="button" onClick={toggleAll} style={styles.selectAll}>
                {allFilteredSelected ? "Unselect All" : "Select All"}
              </button>
            )}

            <div style={styles.options}>
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
    position: "absolute",
    zIndex: 10020,
    left: 0,
    right: 0,
    top: "100%",
    marginTop: 6,
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
