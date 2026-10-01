/**
 * Spread a new "total paid" figure across the fee types of one student + month.
 *
 * rows: [{ amount, paid }]  — `paid` is what each fee type has already collected
 *       (already capped to `amount`). Returns NEW row objects with `paid` updated.
 *
 * - Paying more  → the extra fills the first fee types that still have a balance.
 * - Paying less  → the difference (a correction) is taken off the last fee types first.
 * Fee types that are already fully paid are never disturbed by a new payment.
 */
export function allocatePayment(rows, targetPaid) {
  const out = rows.map((r) => ({ ...r }));
  const current = out.reduce((sum, r) => sum + r.paid, 0);
  if (targetPaid > current) {
    let extra = targetPaid - current;
    for (const r of out) {
      const add = Math.min(r.amount - r.paid, extra);
      r.paid += add;
      extra -= add;
    }
  } else if (targetPaid < current) {
    let cut = current - targetPaid;
    for (let i = out.length - 1; i >= 0; i--) {
      const take = Math.min(out[i].paid, cut);
      out[i].paid -= take;
      cut -= take;
    }
  }
  return out;
}

/** Paid / Partial / Overdue / Pending for a fee line. Overdue is kept only while nothing is paid. */
export function feeStatus({ amount, paid }, previousStatus) {
  if (amount > 0 && paid >= amount) return "Paid";
  if (paid > 0) return "Partial";
  return previousStatus === "Overdue" ? "Overdue" : "Pending";
}
