/**
 * Reads CSV as Excel and Google Sheets save it: quoted fields with "" escapes, commas and line breaks
 * inside quotes, CRLF or LF line ends, an optional UTF-8 BOM. Blank lines are dropped.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (s[i + 1] === '"') field += s[i++];
      else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      rows.push([...row, field]);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) rows.push([...row, field]);
  return rows.filter((r) => r.some((f) => f.trim()));
}

type Cell = string | number | null;

/** A CSV file for spreadsheets: UTF-8 with a BOM (so Excel keeps ₱ and accents) and CRLF line ends. */
export function toCsv(rows: Cell[][]): string {
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function csvCell(value: Cell) {
  if (value === null) return "";
  if (typeof value === "number") return String(value);
  // Text a spreadsheet would run as a formula (CSV injection) is kept as text with a leading '.
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
