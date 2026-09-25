// Minimal RFC 4180-ish CSV serialization -- good enough for Excel/Sheets
// import without pulling in a dependency for something this small.
function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers, ...rows].map((row) =>
    row.map((cell) => escapeCsvCell(cell === null || cell === undefined ? "" : String(cell))).join(",")
  );
  // CRLF line endings and a leading BOM: what Excel expects for a clean
  // open (no mangled column splitting, no "-" turning into a formula issue).
  return "﻿" + lines.join("\r\n");
}
