import * as XLSX from "xlsx";

/** Parses the first sheet of an .xlsx/.csv buffer into an array of row objects keyed by header. */
export function parseSheetToRows(buffer: ArrayBuffer): Record<string, string>[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  return rows.map((row) => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key.trim().toLowerCase().replace(/\s+/g, "_")] = String(value ?? "").trim();
    }
    return normalized;
  });
}

export function buildWorkbook(sheets: { name: string; headers: string[]; rows: (string | number | null)[][] }[]): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const data = [sheet.headers, ...sheet.rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, ws, sheet.name.slice(0, 31));
  }
  const out = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return out as ArrayBuffer;
}
