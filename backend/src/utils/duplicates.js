// Shared by the fee and payroll duplicate guards.
const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

/** "Sep 2026", "september 2026", "2026-09" → "2026-09" so different spellings compare equal. */
export function monthKey(value){
  const s=String(value??'').trim().toLowerCase().replace(/\s+/g,' ');
  if(!s) return '';
  const iso=s.match(/^((?:19|20)\d{2})[-/](\d{1,2})$/);
  if(iso) return `${iso[1]}-${iso[2].padStart(2,'0')}`;
  const year=(s.match(/\b(?:19|20)\d{2}\b/)||[])[0];
  const idx=MONTHS.findIndex(m=>new RegExp(`\\b${m}`).test(s));
  if(year&&idx>=0) return `${year}-${String(idx+1).padStart(2,'0')}`;
  return s;
}
export const normType=t=>String(t??'').trim().toLowerCase();
