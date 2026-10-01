/**
 * Helpers shared by the Fees and Salary pages:
 *  - monthKey:        "Sep 2026", "september 2026", "2026-09" → "2026-09" (so spellings compare equal)
 *  - monthSortValue:  number you can sort by to find the most recent month
 *  - latestByKey:     keep only the most recent record for each person
 */
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function monthKey(value) {
  const s = String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) return "";
  const iso = s.match(/^((?:19|20)\d{2})[-/](\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}`;
  const year = (s.match(/\b(?:19|20)\d{2}\b/) || [])[0];
  const idx = MONTHS.findIndex((m) => new RegExp(`\\b${m}`).test(s));
  if (year && idx >= 0) return `${year}-${String(idx + 1).padStart(2, "0")}`;
  return s;
}

export function monthSortValue(month, createdAt) {
  const m = monthKey(month).match(/^(\d{4})-(\d{2})$/);
  if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, 1);
  const t = createdAt ? new Date(createdAt).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

/** items → Map(key → item with the highest sortOf(item)); first item wins ties. */
export function latestByKey(items, keyOf, sortOf) {
  const best = new Map();
  for (const item of items) {
    const k = keyOf(item);
    const cur = best.get(k);
    if (!cur || sortOf(item) > sortOf(cur)) best.set(k, item);
  }
  return best;
}

export const normType = (t) => String(t ?? "").trim().toLowerCase();
