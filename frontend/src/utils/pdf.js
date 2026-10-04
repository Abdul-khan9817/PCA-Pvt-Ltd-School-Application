/**
 * Minimal, dependency-free PDF writer.
 *
 * Why not a library? The project ships without jsPDF/pdf-lib, and the built-in
 * PDF fonts (Helvetica) are all a clean "standard" receipt / payslip needs.
 * Everything here runs in the browser and produces a real .pdf file.
 *
 * Coordinates: origin is the TOP-LEFT of the page, units are PDF points
 * (1/72 in). `y` for text is the text baseline.
 *
 * Text is limited to the Latin-1 / WinAnsi character set that the standard
 * PDF fonts support. The rupee sign (₹) is not part of that set, so callers
 * should write "Rs." (see `documents.js`).
 *
 * Multi-page helpers:
 *   addPage()                     → start a new page (becomes the current page)
 *   setPage(i)                    → go back and draw on page i (0-based)
 *   link(x, y, w, h, pageIndex)   → clickable area that jumps to another page
 *   bookmark(title, pageIndex)    → entry in the PDF viewer's bookmarks sidebar
 */

export const PAGE = { width: 595.28, height: 841.89 }; // A4

/* Helvetica advance widths (1/1000 em) for ASCII 32..126 */
const W_REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
/* Helvetica-Bold advance widths for ASCII 32..126 */
const W_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/* Map characters the standard fonts cannot draw to safe equivalents. */
const REPLACEMENTS = {
  "\u2013": "-", "\u2014": "-", "\u2212": "-",
  "\u2018": "'", "\u2019": "'", "\u201C": '"', "\u201D": '"',
  "\u2026": "...", "\u20B9": "Rs.", "\u00A0": " ", "\u2192": "->",
};

/** Reduce a string to characters representable in WinAnsi (as char codes < 256). */
function sanitize(input) {
  let out = "";
  for (const ch of String(input ?? "")) {
    if (REPLACEMENTS[ch] !== undefined) { out += REPLACEMENTS[ch]; continue; }
    if (ch === "\u2022") { out += "\u0095"; continue; } // bullet (WinAnsi 0x95)
    const code = ch.codePointAt(0);
    if ((code >= 32 && code <= 126) || (code >= 161 && code <= 255)) out += ch;
    else if (code === 9 || code === 10 || code === 13) out += " ";
    else out += "?";
  }
  return out;
}

const charWidth = (ch, bold) => {
  const code = ch.charCodeAt(0);
  const table = bold ? W_BOLD : W_REGULAR;
  return code >= 32 && code <= 126 ? table[code - 32] : 556;
};

/** Escape a sanitized string for use inside a PDF literal string. */
function pdfString(str) {
  let out = "(";
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    const code = str.charCodeAt(i);
    if (c === "\\" || c === "(" || c === ")") out += "\\" + c;
    else if (code > 126 || code < 32) out += "\\" + code.toString(8).padStart(3, "0");
    else out += c;
  }
  return out + ")";
}

const num = (n) => {
  const s = Number(n).toFixed(2);
  return s.replace(/\.?0+$/, "") || "0";
};

function rgb(hex) {
  const h = String(hex || "#000000").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0");
  const n = parseInt(full.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => num(v / 255)).join(" ");
}

export class PDFDoc {
  constructor({ title = "Document", author = "PCA Pvt. Ltd" } = {}) {
    this.title = sanitize(title);
    this.author = sanitize(author);
    this.pages = [];      // drawing operations, one array per page
    this.pageLinks = [];  // clickable areas, one array per page
    this.outline = [];    // bookmarks: { title, page }
    this.current = -1;
    this.addPage();
  }

  addPage() {
    this.pages.push([]);
    this.pageLinks.push([]);
    this.current = this.pages.length - 1;
    return this;
  }

  /** Make page `index` (0-based) the current page so it can be drawn on. */
  setPage(index) {
    if (index >= 0 && index < this.pages.length) this.current = index;
    return this;
  }

  get ops() {
    return this.pages[this.current];
  }

  /** Clickable rectangle on the current page that jumps to page `pageIndex`. */
  link(x, y, w, h, pageIndex) {
    this.pageLinks[this.current].push({ x, y, w, h, target: pageIndex });
    return this;
  }

  /** Add an entry to the PDF bookmarks sidebar. */
  bookmark(title, pageIndex) {
    this.outline.push({ title: sanitize(title), page: pageIndex });
    return this;
  }

  /** Width of `str` in points at the given font size. */
  textWidth(str, size = 10, bold = false) {
    const s = sanitize(str);
    let w = 0;
    for (let i = 0; i < s.length; i++) w += charWidth(s[i], bold);
    return (w * size) / 1000;
  }

  /** Split text into lines that fit `maxWidth`. */
  wrap(str, maxWidth, size = 10, bold = false) {
    const words = sanitize(str).split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = "";
    for (const word of words) {
      const test = cur ? cur + " " + word : word;
      if (this.textWidth(test, size, bold) <= maxWidth || !cur) cur = test;
      else { lines.push(cur); cur = word; }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [""];
  }

  /** Shorten `str` with "..." so it fits `maxWidth`. */
  fit(str, maxWidth, size = 10, bold = false) {
    let s = sanitize(str);
    if (this.textWidth(s, size, bold) <= maxWidth) return s;
    while (s.length > 1 && this.textWidth(s + "...", size, bold) > maxWidth) s = s.slice(0, -1);
    return s + "...";
  }

  text(str, x, y, { size = 10, bold = false, color = "#000000", align = "left" } = {}) {
    const s = sanitize(str);
    if (!s) return this;
    const w = this.textWidth(s, size, bold);
    const px = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
    this.ops.push(
      `BT /${bold ? "F2" : "F1"} ${num(size)} Tf ${rgb(color)} rg ${num(px)} ${num(PAGE.height - y)} Td ${pdfString(s)} Tj ET`
    );
    return this;
  }

  rect(x, y, w, h, { fill, stroke, lineWidth = 0.6 } = {}) {
    const parts = [];
    if (fill) parts.push(`${rgb(fill)} rg`);
    if (stroke) parts.push(`${rgb(stroke)} RG ${num(lineWidth)} w`);
    const op = fill && stroke ? "B" : fill ? "f" : stroke ? "S" : "n";
    parts.push(`${num(x)} ${num(PAGE.height - y - h)} ${num(w)} ${num(h)} re ${op}`);
    this.ops.push(parts.join(" "));
    return this;
  }

  line(x1, y1, x2, y2, { color = "#e5e7eb", width = 0.6 } = {}) {
    this.ops.push(
      `${rgb(color)} RG ${num(width)} w ${num(x1)} ${num(PAGE.height - y1)} m ${num(x2)} ${num(PAGE.height - y2)} l S`
    );
    return this;
  }

  /** Serialise to PDF bytes. */
  toBytes() {
    const objects = []; // index 0 => object 1
    const add = (body) => { objects.push(body); return objects.length; };

    const catalogId = add(""); // placeholders filled below
    const pagesId = add("");
    const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const d = new Date();
    const p2 = (n) => String(n).padStart(2, "0");
    const stamp = `D:${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
    const infoId = add(
      `<< /Title ${pdfString(this.title)} /Author ${pdfString(this.author)} /Producer ${pdfString("PCA Pvt. Ltd")} /CreationDate (${stamp}) >>`
    );

    // Reserve ids first so bookmarks / links can point at pages that come later.
    const outlineRootId = this.outline.length ? add("") : 0;
    const outlineIds = this.outline.map(() => add(""));
    const pageInfo = this.pages.map((_, i) => ({
      contentId: add(""),
      pageId: add(""),
      annotIds: this.pageLinks[i].map(() => add("")),
    }));
    const dest = (pageIndex) => {
      const t = pageInfo[Math.min(Math.max(pageIndex, 0), pageInfo.length - 1)];
      return `[${t.pageId} 0 R /XYZ 0 ${num(PAGE.height)} 0]`;
    };

    this.pages.forEach((ops, i) => {
      const info = pageInfo[i];
      const stream = ops.join("\n");
      objects[info.contentId - 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
      this.pageLinks[i].forEach((l, k) => {
        const y1 = PAGE.height - l.y - l.h;
        objects[info.annotIds[k] - 1] =
          `<< /Type /Annot /Subtype /Link /Rect [${num(l.x)} ${num(y1)} ${num(l.x + l.w)} ${num(y1 + l.h)}] /Border [0 0 0] /Dest ${dest(l.target)} >>`;
      });
      objects[info.pageId - 1] =
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(PAGE.width)} ${num(PAGE.height)}] ` +
        `/Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${info.contentId} 0 R` +
        (info.annotIds.length ? ` /Annots [${info.annotIds.map((a) => `${a} 0 R`).join(" ")}]` : "") +
        ` >>`;
    });

    if (outlineRootId) {
      objects[outlineRootId - 1] =
        `<< /Type /Outlines /First ${outlineIds[0]} 0 R /Last ${outlineIds[outlineIds.length - 1]} 0 R /Count ${outlineIds.length} >>`;
      this.outline.forEach((o, i) => {
        objects[outlineIds[i] - 1] =
          `<< /Title ${pdfString(o.title)} /Parent ${outlineRootId} 0 R` +
          (i > 0 ? ` /Prev ${outlineIds[i - 1]} 0 R` : "") +
          (i < outlineIds.length - 1 ? ` /Next ${outlineIds[i + 1]} 0 R` : "") +
          ` /Dest ${dest(o.page)} >>`;
      });
    }

    objects[catalogId - 1] =
      `<< /Type /Catalog /Pages ${pagesId} 0 R` +
      (outlineRootId ? ` /Outlines ${outlineRootId} 0 R /PageMode /UseOutlines` : "") +
      ` >>`;
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageInfo.map((p) => `${p.pageId} 0 R`).join(" ")}] /Count ${pageInfo.length} >>`;

    let out = "%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n";
    const offsets = [];
    objects.forEach((body, i) => {
      offsets.push(out.length);
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xrefAt = out.length;
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach((o) => { out += `${String(o).padStart(10, "0")} 00000 n \n`; });
    out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;

    // Every character is < 256, so a 1:1 char -> byte conversion is exact.
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
    return bytes;
  }

  /** Trigger a browser download of the PDF. */
  save(filename = "document.pdf") {
    const blob = new Blob([this.toBytes()], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}