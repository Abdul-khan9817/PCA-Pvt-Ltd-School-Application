/**
 * Standard printable documents (A4 PDF):
 *   - buildFeeReceipt / downloadFeeReceipt  → student fee receipt / invoice
 *   - buildPayslip    / downloadPayslip     → staff salary payslip
 *   - buildClassFeeReport / downloadClassFeeReport → class-wise student fee list (clickable contents)
 *
 * Set VITE_SCHOOL_NAME / VITE_SCHOOL_ADDRESS in frontend/.env to brand them.
 * The rupee sign is not available in the standard PDF fonts, so amounts are
 * printed as "Rs. 1,234".
 */
import { PDFDoc, PAGE } from "./pdf.js";

const ENV = (typeof import.meta !== "undefined" && import.meta.env) || {};
export const SCHOOL = {
  name: ENV.VITE_SCHOOL_NAME || "PCA Pvt. Ltd",
  address: ENV.VITE_SCHOOL_ADDRESS || "",
};

/* Palette (matches the app theme) */
const NAVY = "#1e2a4a";
const ACCENT = "#4f6ef7";
const TEXT = "#111827";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const SOFT = "#f8fafc";
const HEAD_BG = "#eef2ff";
const STATUS_COLORS = {
  PAID: "#10b981",
  PARTIAL: "#0284c7",
  PENDING: "#d97706",
  OVERDUE: "#ef4444",
};

const MARGIN = 40;
const RIGHT = PAGE.width - MARGIN;
const CONTENT_W = PAGE.width - MARGIN * 2;

/* ───────────── helpers ───────────── */

export const money = (n) =>
  "Rs. " + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const fmtDate = (value) => {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

/** "29 Sep 2026, 03:23 PM" */
const fmtDateTime = (value) => {
  if (!value || value === "—") return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${date}, ${time}`;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "July 2026" / "Jul 2026" → "July 2026". Anything else (e.g. "1500") → month of the fallback date. */
const cleanMonth = (month, fallbackDate) => {
  const m = String(month || "").trim().match(/^([A-Za-z]{3,9})\.?\s*,?\s*(\d{4})$/);
  if (m) {
    const idx = MONTHS.findIndex((n) => n.toLowerCase().startsWith(m[1].toLowerCase().slice(0, 3)));
    if (idx >= 0) return `${MONTHS[idx]} ${m[2]}`;
  }
  const d = fallbackDate ? new Date(fallbackDate) : null;
  return d && !Number.isNaN(d.getTime()) ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : "";
};

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const below1000 = (n) => {
  let s = "";
  if (n >= 100) { s += ONES[Math.floor(n / 100)] + " Hundred"; n %= 100; if (n) s += " "; }
  if (n >= 20) { s += TENS[Math.floor(n / 10)]; if (n % 10) s += " " + ONES[n % 10]; }
  else if (n > 0) s += ONES[n];
  return s;
};

/** 1234567 → "Rupees Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Only" (Indian grouping) */
export function amountInWords(value) {
  let n = Math.round(Math.abs(Number(value) || 0));
  if (n === 0) return "Rupees Zero Only";
  const parts = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(below1000(crore) + " Crore");
  if (lakh) parts.push(below1000(lakh) + " Lakh");
  if (thousand) parts.push(below1000(thousand) + " Thousand");
  if (n) parts.push(below1000(n));
  return "Rupees " + parts.join(" ") + " Only";
}

const safeName = (s) => String(s || "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");

const monthCode = (month) => {
  const m = String(month || "").match(/([A-Za-z]{3})[a-z]*\s*(\d{4})?/);
  return m ? (m[1] + (m[2] || "")).toUpperCase() : "NA";
};

/* ───────────── shared layout pieces ───────────── */

function header(doc, { title, subtitle }) {
  doc.rect(0, 0, PAGE.width, 92, { fill: NAVY });
  doc.rect(0, 92, PAGE.width, 4, { fill: ACCENT });
  doc.text(SCHOOL.name, MARGIN, 44, { size: 20, bold: true, color: "#ffffff" });
  if (SCHOOL.address) doc.text(SCHOOL.address, MARGIN, 62, { size: 9, color: "#c7d2fe" });
  doc.text(title, RIGHT, 44, { size: 18, bold: true, color: "#ffffff", align: "right" });
  if (subtitle) doc.text(subtitle, RIGHT, 62, { size: 9.5, color: "#c7d2fe", align: "right" });
}

/** Two-column label/value card. rows: [[label, value], ...] */
function infoCard(doc, { x, y, w, heading, rows }) {
  const rowH = 17;
  const h = 30 + rows.length * rowH;
  doc.rect(x, y, w, h, { fill: SOFT, stroke: BORDER });
  doc.text(heading, x + 12, y + 17, { size: 8.5, bold: true, color: MUTED });
  doc.line(x + 12, y + 23, x + w - 12, y + 23);
  rows.forEach(([label, value], i) => {
    const ry = y + 39 + i * rowH;
    doc.text(label, x + 12, ry, { size: 9.5, color: MUTED });
    doc.text(doc.fit(value || "-", w - 24 - 82, 9.5, true), x + 94, ry, { size: 9.5, bold: true, color: TEXT });
  });
  return h;
}

function statusChip(doc, label, x, y) {
  const color = STATUS_COLORS[String(label).toUpperCase()] || MUTED;
  const text = String(label).toUpperCase();
  const w = doc.textWidth(text, 8.5, true) + 16;
  doc.rect(x, y, w, 15, { fill: color });
  doc.text(text, x + w / 2, y + 10.8, { size: 8.5, bold: true, color: "#ffffff", align: "center" });
  return w;
}

function footer(doc, { leftSign, rightSign, note }) {
  const y = 742;
  doc.line(MARGIN, y, MARGIN + 170, y, { color: MUTED, width: 0.7 });
  doc.line(RIGHT - 170, y, RIGHT, y, { color: MUTED, width: 0.7 });
  doc.text(leftSign, MARGIN, y + 13, { size: 9, color: MUTED });
  doc.text(rightSign, RIGHT, y + 13, { size: 9, color: MUTED, align: "right" });
  doc.line(MARGIN, 790, RIGHT, 790);
  doc.text(note, PAGE.width / 2, 806, { size: 8, color: MUTED, align: "center" });
  doc.text(`Generated on ${fmtDate(new Date())}`, PAGE.width / 2, 819, { size: 8, color: MUTED, align: "center" });
}

/* ═════════════════════ FEE RECEIPT ═════════════════════ */

/**
 * @param {object} data
 *  student: { name, roll, cls, fatherName }
 *  month:   "September 2026"
 *  items:   [{ type, amount, paid, status, dueDate, paymentMethod, transactionId, paidAt, notes, _id }]
 */
export function buildFeeReceipt(data) {
  const { student = {}, month = "", items = [] } = data;
  const doc = new PDFDoc({ title: `Fee Receipt - ${student.name || "Student"} - ${month}` });

  const totalAmount = items.reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const totalPaid = items.reduce((s, f) => s + (Number(f.paid) || 0), 0);
  const balance = Math.max(0, totalAmount - totalPaid);
  const overallStatus =
    totalAmount > 0 && totalPaid >= totalAmount ? "Paid"
      : totalPaid > 0 ? "Partial"
        : items.some((f) => f.status === "Overdue") ? "Overdue" : "Pending";

  const idTail = String(items[0]?._id || "").slice(-6).toUpperCase() || "000000";
  const receiptNo = `FEE-${monthCode(month)}-${idTail}`;
  const dueDates = items.map((f) => f.dueDate).filter(Boolean).sort();
  const paidDates = items.filter((f) => Number(f.paid) > 0).map((f) => f.paidAt).filter(Boolean).sort();
  const withMethod = items.find((f) => f.paymentMethod);
  const withTxn = items.find((f) => f.transactionId);
  const withNotes = items.find((f) => f.notes);

  header(doc, {
    title: totalPaid > 0 ? "FEE RECEIPT" : "FEE INVOICE",
    subtitle: `No. ${receiptNo}`,
  });

  /* Student + receipt details */
  const gap = 14;
  const cardW = (CONTENT_W - gap) / 2;
  const cardY = 116;
  const h1 = infoCard(doc, {
    x: MARGIN, y: cardY, w: cardW, heading: "STUDENT DETAILS",
    rows: [
      ["Name", student.name || "-"],
      ["Roll No. / ID", student.roll || "-"],
      ["Class", student.cls || "-"],
      ["Parent / Guardian", student.fatherName || "-"],
    ],
  });
  infoCard(doc, {
    x: MARGIN + cardW + gap, y: cardY, w: cardW, heading: "RECEIPT DETAILS",
    rows: [
      ["Fee Period", month || "-"],
      ["Due Date", dueDates.length ? fmtDate(dueDates[0]) : "-"],
      ["Date Issued", fmtDate(paidDates.length ? paidDates[paidDates.length - 1] : new Date())],
      ["Status", ""],
    ],
  });
  // status chip drawn over the blank "Status" row
  statusChip(doc, overallStatus, MARGIN + cardW + gap + 94, cardY + 39 + 3 * 17 - 11);

  /* Fee table */
  let y = cardY + h1 + 26;
  const cols = {
    no: MARGIN + 12,
    type: MARGIN + 40,
    total: MARGIN + 300,
    paid: MARGIN + 380,
    balance: MARGIN + 452,
    status: RIGHT - 10,
  };
  doc.rect(MARGIN, y, CONTENT_W, 26, { fill: HEAD_BG, stroke: BORDER });
  const th = { size: 8.5, bold: true, color: NAVY };
  doc.text("#", cols.no, y + 17, th);
  doc.text("FEE TYPE", cols.type, y + 17, th);
  doc.text("TOTAL", cols.total, y + 17, { ...th, align: "right" });
  doc.text("PAID", cols.paid, y + 17, { ...th, align: "right" });
  doc.text("BALANCE", cols.balance, y + 17, { ...th, align: "right" });
  doc.text("STATUS", cols.status, y + 17, { ...th, align: "right" });
  y += 26;

  items.forEach((f, i) => {
    const amt = Number(f.amount) || 0;
    const paid = Number(f.paid) || 0;
    const bal = Math.max(0, amt - paid);
    doc.rect(MARGIN, y, CONTENT_W, 24, { fill: i % 2 ? SOFT : "#ffffff", stroke: BORDER });
    doc.text(String(i + 1), cols.no, y + 16, { size: 9.5, color: MUTED });
    doc.text(doc.fit(f.type || "Fee", 200, 9.5, true), cols.type, y + 16, { size: 9.5, bold: true, color: TEXT });
    doc.text(money(amt), cols.total, y + 16, { size: 9.5, color: TEXT, align: "right" });
    doc.text(money(paid), cols.paid, y + 16, { size: 9.5, color: "#059669", align: "right" });
    doc.text(money(bal), cols.balance, y + 16, { size: 9.5, color: bal > 0 ? "#dc2626" : TEXT, align: "right" });
    const st = String(f.status || (paid >= amt && amt > 0 ? "Paid" : paid > 0 ? "Partial" : "Pending")).toUpperCase();
    doc.text(st, cols.status, y + 16, { size: 8.5, bold: true, color: STATUS_COLORS[st] || MUTED, align: "right" });
    y += 24;
  });

  // totals row
  doc.rect(MARGIN, y, CONTENT_W, 28, { fill: "#f1f5f9", stroke: BORDER });
  doc.text("TOTAL", cols.type, y + 18, { size: 10, bold: true, color: NAVY });
  doc.text(money(totalAmount), cols.total, y + 18, { size: 10, bold: true, color: TEXT, align: "right" });
  doc.text(money(totalPaid), cols.paid, y + 18, { size: 10, bold: true, color: "#059669", align: "right" });
  doc.text(money(balance), cols.balance, y + 18, { size: 10, bold: true, color: balance > 0 ? "#dc2626" : TEXT, align: "right" });
  y += 28 + 22;

  /* Amount in words */
  doc.rect(MARGIN, y, CONTENT_W, 40, { fill: "#f0fdf4", stroke: "#bbf7d0" });
  doc.text("AMOUNT RECEIVED", MARGIN + 12, y + 16, { size: 8.5, bold: true, color: "#166534" });
  doc.text(money(totalPaid), RIGHT - 12, y + 17, { size: 12, bold: true, color: "#15803d", align: "right" });
  doc.text(doc.fit(amountInWords(totalPaid), CONTENT_W - 24, 9.5, false), MARGIN + 12, y + 32, { size: 9.5, color: TEXT });
  y += 40 + 22;

  /* Payment details */
  doc.text("PAYMENT DETAILS", MARGIN, y, { size: 8.5, bold: true, color: MUTED });
  doc.line(MARGIN, y + 6, RIGHT, y + 6);
  y += 24;
  const detail = (label, value, x) => {
    doc.text(label, x, y, { size: 9.5, color: MUTED });
    doc.text(doc.fit(value || "-", cardW - 110, 9.5, true), x + 96, y, { size: 9.5, bold: true, color: TEXT });
  };
  detail("Payment Method", withMethod?.paymentMethod, MARGIN);
  detail("Transaction ID", withTxn?.transactionId, MARGIN + cardW + gap);
  y += 20;
  detail("Paid On", paidDates.length ? fmtDate(paidDates[paidDates.length - 1]) : "-", MARGIN);
  detail("Balance Due", money(balance), MARGIN + cardW + gap);
  if (withNotes?.notes) {
    y += 20;
    doc.text("Remarks", MARGIN, y, { size: 9.5, color: MUTED });
    const lines = doc.wrap(withNotes.notes, CONTENT_W - 96, 9.5, false).slice(0, 3);
    lines.forEach((ln, i) => doc.text(ln, MARGIN + 96, y + i * 13, { size: 9.5, color: TEXT }));
  }

  footer(doc, {
    leftSign: "Parent / Guardian Signature",
    rightSign: "Authorised Signatory",
    note: "This is a computer-generated document. Fees once paid are non-refundable unless stated otherwise.",
  });
  return doc;
}

export function downloadFeeReceipt(data) {
  const doc = buildFeeReceipt(data);
  doc.save(`Fee-Receipt_${safeName(data.student?.name) || "Student"}_${safeName(data.month) || "Fees"}.pdf`);
}

/* ═════════════════════ CLASS-WISE FEE REPORT ═════════════════════ */

/**
 * All students grouped by class — built for thousands of students.
 *  - Page 1 (+more if many classes): clickable CONTENTS → tap a class to jump to it
 *  - Each class starts on its own page; long classes continue on the next page
 *  - Every page: "Back to contents" link + "Page X of N"; PDF bookmarks per class
 * The caller passes classes already sorted (classes ascending, students by roll ascending).
 *
 * @param {object} data
 *  periodLabel: "September 2026" | "Latest month of each student"
 *  classes: [{ name: "Class 1", students: [{ name, roll, types, total, paid, status }] }]
 */
export function buildClassFeeReport(data) {
  const { periodLabel = "", classes = [] } = data;
  const title = `Fee Report - Class wise${periodLabel ? " - " + periodLabel : ""}`;
  const doc = new PDFDoc({ title });

  const BOTTOM = PAGE.height - 52;
  const ROW_H = 20;
  const TOC_ROW = 28;
  const TOC_FIRST_Y = 196;
  const TOC_NEXT_Y = 50;
  const GREEN = "#059669";
  const RED = "#dc2626";
  const cols = {
    no: MARGIN + 8,
    name: MARGIN + 32,
    roll: MARGIN + 168,
    type: MARGIN + 204,
    total: MARGIN + 330,
    paid: MARGIN + 388,
    balance: MARGIN + 446,
    status: RIGHT - 8,
  };

  const prepared = classes.map((c) => {
    const list = c.students || [];
    return {
      name: c.name,
      list,
      total: list.reduce((s, x) => s + (Number(x.total) || 0), 0),
      paid: list.reduce((s, x) => s + (Number(x.paid) || 0), 0),
    };
  });
  const grand = prepared.reduce(
    (g, c) => ({ students: g.students + c.list.length, total: g.total + c.total, paid: g.paid + c.paid }),
    { students: 0, total: 0, paid: 0 }
  );

  /* contents pages needed */
  const cap1 = Math.floor((BOTTOM - TOC_FIRST_Y) / TOC_ROW);
  const cap2 = Math.floor((BOTTOM - TOC_NEXT_Y) / TOC_ROW);
  const tocCount = prepared.length <= cap1 ? 1 : 1 + Math.ceil((prepared.length - cap1) / cap2);
  for (let i = 1; i < tocCount; i++) doc.addPage();

  const slimBar = () => {
    doc.rect(0, 0, PAGE.width, 26, { fill: NAVY });
    doc.text(SCHOOL.name, MARGIN, 17, { size: 10, bold: true, color: "#ffffff" });
    doc.text(title, RIGHT, 17, { size: 8.5, color: "#c7d2fe", align: "right" });
  };

  const tableHead = (y) => {
    doc.rect(MARGIN, y, CONTENT_W, 22, { fill: "#f1f5f9", stroke: BORDER });
    const th = { size: 7.5, bold: true, color: NAVY };
    doc.text("NO.", cols.no, y + 14.5, th);
    doc.text("STUDENT", cols.name, y + 14.5, th);
    doc.text("ROLL", cols.roll, y + 14.5, th);
    doc.text("FEE TYPE", cols.type, y + 14.5, th);
    doc.text("TOTAL", cols.total, y + 14.5, { ...th, align: "right" });
    doc.text("PAID", cols.paid, y + 14.5, { ...th, align: "right" });
    doc.text("BALANCE", cols.balance, y + 14.5, { ...th, align: "right" });
    doc.text("STATUS", cols.status, y + 14.5, { ...th, align: "right" });
    return y + 22;
  };

  const newClassPage = (cls, continued) => {
    doc.addPage();
    slimBar();
    doc.rect(MARGIN, 40, CONTENT_W, 30, { fill: HEAD_BG, stroke: BORDER });
    doc.text(cls.name + (continued ? " (continued)" : ""), MARGIN + 12, 60, { size: 12.5, bold: true, color: NAVY });
    const n = cls.list.length;
    doc.text(`${n} student${n === 1 ? "" : "s"}`, RIGHT - 12, 59.5, { size: 9, color: MUTED, align: "right" });
    return tableHead(78);
  };

  /* ── class pages ── */
  const startPage = [];
  prepared.forEach((cls) => {
    let y = newClassPage(cls, false);
    startPage.push(doc.pages.length - 1);

    cls.list.forEach((st, i) => {
      if (y + ROW_H > BOTTOM) y = newClassPage(cls, true);
      const total = Number(st.total) || 0;
      const paid = Number(st.paid) || 0;
      const bal = Math.max(0, total - paid);
      doc.rect(MARGIN, y, CONTENT_W, ROW_H, { fill: i % 2 ? SOFT : "#ffffff", stroke: BORDER });
      const ty = y + 13.5;
      doc.text(String(i + 1), cols.no, ty, { size: 8.5, color: MUTED });
      doc.text(doc.fit(st.name || "Student", 130, 8.5, true), cols.name, ty, { size: 8.5, bold: true, color: TEXT });
      doc.text(doc.fit(String(st.roll || "-"), 32, 8.5, false), cols.roll, ty, { size: 8.5, color: TEXT });
      doc.text(doc.fit(st.types || "-", 86, 8, false), cols.type, ty, { size: 8, color: MUTED });
      doc.text(money(total), cols.total, ty, { size: 8.5, color: TEXT, align: "right" });
      doc.text(money(paid), cols.paid, ty, { size: 8.5, color: GREEN, align: "right" });
      doc.text(money(bal), cols.balance, ty, { size: 8.5, color: bal > 0 ? RED : TEXT, align: "right" });
      const status = String(st.status || "Pending").toUpperCase();
      doc.text(status, cols.status, ty, { size: 7.5, bold: true, color: STATUS_COLORS[status] || MUTED, align: "right" });
      y += ROW_H;
    });

    if (y + 24 > BOTTOM) y = newClassPage(cls, true);
    const cb = Math.max(0, cls.total - cls.paid);
    doc.rect(MARGIN, y, CONTENT_W, 24, { fill: "#f1f5f9", stroke: BORDER });
    doc.text("CLASS TOTAL", cols.name, y + 15.5, { size: 8.5, bold: true, color: NAVY });
    doc.text(money(cls.total), cols.total, y + 15.5, { size: 8.5, bold: true, color: TEXT, align: "right" });
    doc.text(money(cls.paid), cols.paid, y + 15.5, { size: 8.5, bold: true, color: GREEN, align: "right" });
    doc.text(money(cb), cols.balance, y + 15.5, { size: 8.5, bold: true, color: cb > 0 ? RED : TEXT, align: "right" });
  });

  /* ── contents pages (drawn last, when every class's page number is known) ── */
  let ti = 0;
  for (let p = 0; p < tocCount; p++) {
    doc.setPage(p);
    let y;
    let cap;
    if (p === 0) {
      header(doc, { title: "FEE REPORT", subtitle: periodLabel || "Class wise" });
      doc.rect(MARGIN, 112, CONTENT_W, 50, { fill: SOFT, stroke: BORDER });
      const stats = [
        ["CLASSES", String(prepared.length)],
        ["STUDENTS", grand.students.toLocaleString("en-IN")],
        ["TOTAL FEES", money(grand.total)],
        ["COLLECTED", money(grand.paid)],
        ["OUTSTANDING", money(Math.max(0, grand.total - grand.paid))],
      ];
      const sw = CONTENT_W / stats.length;
      stats.forEach(([label, value], i) => {
        const cx = MARGIN + sw * i + sw / 2;
        doc.text(label, cx, 130, { size: 7.5, bold: true, color: MUTED, align: "center" });
        doc.text(value, cx, 148, { size: 10, bold: true, color: i === 4 ? RED : i === 3 ? GREEN : NAVY, align: "center" });
      });
      doc.text("CONTENTS", MARGIN, 184, { size: 9, bold: true, color: MUTED });
      doc.text("Tap or click a class to open its student list", RIGHT, 184, { size: 8.5, color: MUTED, align: "right" });
      y = TOC_FIRST_Y;
      cap = cap1;
    } else {
      slimBar();
      doc.text("CONTENTS (continued)", MARGIN, 44, { size: 9, bold: true, color: MUTED });
      y = TOC_NEXT_Y;
      cap = cap2;
    }
    for (let r = 0; r < cap && ti < prepared.length; r++, ti++) {
      const cls = prepared[ti];
      const target = startPage[ti];
      const bal = Math.max(0, cls.total - cls.paid);
      doc.rect(MARGIN, y, CONTENT_W, TOC_ROW, { fill: ti % 2 ? SOFT : "#ffffff", stroke: BORDER });
      doc.text(cls.name, MARGIN + 12, y + 18, { size: 10.5, bold: true, color: NAVY });
      doc.text(`${cls.list.length} student${cls.list.length === 1 ? "" : "s"}`, MARGIN + 190, y + 18, { size: 9, color: MUTED });
      doc.text(`Balance ${money(bal)}`, RIGHT - 84, y + 18, { size: 9, color: bal > 0 ? RED : GREEN, align: "right" });
      doc.text(`Page ${target + 1}`, RIGHT - 12, y + 18, { size: 9, bold: true, color: ACCENT, align: "right" });
      doc.link(MARGIN, y, CONTENT_W, TOC_ROW, target);
      y += TOC_ROW;
    }
  }

  /* ── footers + bookmarks ── */
  const total = doc.pages.length;
  const generated = fmtDate(new Date());
  for (let i = 0; i < total; i++) {
    doc.setPage(i);
    doc.line(MARGIN, PAGE.height - 40, RIGHT, PAGE.height - 40);
    doc.text(`Generated on ${generated}`, MARGIN, PAGE.height - 24, { size: 8, color: MUTED });
    if (i >= tocCount) {
      doc.text("Back to contents", PAGE.width / 2, PAGE.height - 24, { size: 8.5, bold: true, color: ACCENT, align: "center" });
      doc.link(PAGE.width / 2 - 50, PAGE.height - 34, 100, 16, 0);
    }
    doc.text(`Page ${i + 1} of ${total}`, RIGHT, PAGE.height - 24, { size: 8, color: MUTED, align: "right" });
  }
  doc.bookmark("Contents", 0);
  prepared.forEach((c, i) => doc.bookmark(`${c.name} (${c.list.length})`, startPage[i]));

  return doc;
}

export function downloadClassFeeReport(data) {
  const doc = buildClassFeeReport(data);
  doc.save(`Fee-Report_Class-wise_${safeName(data.periodLabel) || "Fees"}.pdf`);
}

/* ═════════════════════ PAYSLIP ═════════════════════ */

/**
 * @param {object} data
 *  employee: { name, designation, email, phone }
 *  month, basic, allowances, deductions, net, status, paidOn, paymentMethod, transactionId
 */
export function buildPayslip(data) {
  const { employee = {} } = data;
  const month = cleanMonth(data.month, data.paidOn);
  const basic = Number(data.basic) || 0;
  const allowances = Number(data.allowances) || 0;
  const deductions = Number(data.deductions) || 0;
  const gross = basic + allowances;
  const net = data.net !== undefined && data.net !== null && data.net !== "" ? Number(data.net) || 0 : gross - deductions;
  const status = data.status || "Pending";

  const doc = new PDFDoc({ title: `Payslip - ${employee.name || "Staff"} - ${month}` });
  header(doc, { title: "PAYSLIP", subtitle: month ? `For the month of ${month}` : "" });

  const gap = 14;
  const cardW = (CONTENT_W - gap) / 2;
  const cardY = 116;
  const h1 = infoCard(doc, {
    x: MARGIN, y: cardY, w: cardW, heading: "EMPLOYEE DETAILS",
    rows: [
      ["Name", employee.name || "-"],
      ["Designation", employee.designation || "-"],
      ["Email", employee.email || "-"],
      ["Phone", employee.phone || "-"],
    ],
  });
  infoCard(doc, {
    x: MARGIN + cardW + gap, y: cardY, w: cardW, heading: "PAYMENT DETAILS",
    rows: [
      ["Pay Period", month || "-"],
      ["Status", ""],
      ["Paid On", fmtDateTime(data.paidOn)],
      ["Method / Ref", [data.paymentMethod, data.transactionId].filter(Boolean).join(" / ") || "-"],
    ],
  });
  statusChip(doc, status, MARGIN + cardW + gap + 94, cardY + 39 + 17 - 11);

  /* Earnings | Deductions */
  let y = cardY + h1 + 26;
  const tableRow = (x, w, label, value, { bold = false, fill = "#ffffff", color = TEXT } = {}, top) => {
    doc.rect(x, top, w, 26, { fill, stroke: BORDER });
    if (label === null) return; // intentionally blank row (keeps both columns aligned)
    doc.text(label, x + 12, top + 17, { size: 9.5, bold, color: bold ? NAVY : TEXT });
    doc.text(money(value), x + w - 12, top + 17, { size: 9.5, bold, color, align: "right" });
  };
  const leftX = MARGIN;
  const rightX = MARGIN + cardW + gap;

  doc.rect(leftX, y, cardW, 26, { fill: HEAD_BG, stroke: BORDER });
  doc.text("EARNINGS", leftX + 12, y + 17, { size: 8.5, bold: true, color: NAVY });
  doc.text("AMOUNT", leftX + cardW - 12, y + 17, { size: 8.5, bold: true, color: NAVY, align: "right" });
  doc.rect(rightX, y, cardW, 26, { fill: HEAD_BG, stroke: BORDER });
  doc.text("DEDUCTIONS", rightX + 12, y + 17, { size: 8.5, bold: true, color: NAVY });
  doc.text("AMOUNT", rightX + cardW - 12, y + 17, { size: 8.5, bold: true, color: NAVY, align: "right" });
  y += 26;

  tableRow(leftX, cardW, "Basic Salary", basic, {}, y);
  tableRow(leftX, cardW, "Allowances", allowances, { fill: SOFT, color: "#059669" }, y + 26);
  tableRow(leftX, cardW, "Gross Earnings", gross, { bold: true, fill: "#f1f5f9" }, y + 52);
  tableRow(rightX, cardW, "Deductions", deductions, { color: "#dc2626" }, y);
  tableRow(rightX, cardW, null, 0, { fill: SOFT }, y + 26);
  tableRow(rightX, cardW, "Total Deductions", deductions, { bold: true, fill: "#f1f5f9", color: "#dc2626" }, y + 52);
  y += 78 + 26;

  /* Net pay */
  doc.rect(MARGIN, y, CONTENT_W, 62, { fill: NAVY });
  doc.text("NET PAY", MARGIN + 18, y + 26, { size: 9, bold: true, color: "#c7d2fe" });
  doc.text(money(net), RIGHT - 18, y + 30, { size: 20, bold: true, color: "#ffffff", align: "right" });
  doc.text(doc.fit(amountInWords(net), CONTENT_W - 36, 9.5, false), MARGIN + 18, y + 48, { size: 9.5, color: "#e0e7ff" });
  y += 62 + 18;

  doc.text(`Net Pay = Gross Earnings (${money(gross)}) - Total Deductions (${money(deductions)})`, MARGIN, y, { size: 8.5, color: MUTED });

  footer(doc, {
    leftSign: "Employee Signature",
    rightSign: "Authorised Signatory",
    note: "This is a computer-generated payslip and does not require a physical signature.",
  });
  return doc;
}

export function downloadPayslip(data) {
  const doc = buildPayslip(data);
  doc.save(`Payslip_${safeName(data.employee?.name) || "Staff"}_${safeName(cleanMonth(data.month, data.paidOn)) || "Salary"}.pdf`);
}