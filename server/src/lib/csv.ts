export type CsvValue = string | number | boolean | null | undefined;

// Spreadsheet apps execute cells starting with these as formulas (CSV injection).
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && FORMULA_PREFIX.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** RFC 4180 CSV with CRLF line endings. */
export function toCsv<C extends string>(columns: readonly C[], rows: Array<Partial<Record<C, CsvValue>>>): string {
  const lines = [columns.join(","), ...rows.map((row) => columns.map((c) => csvCell(row[c])).join(","))];
  return `${lines.join("\r\n")}\r\n`;
}
