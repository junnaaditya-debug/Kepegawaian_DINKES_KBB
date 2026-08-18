import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";

const PAGE_WIDTH = 841.89; // A4 landscape
const PAGE_HEIGHT = 595.28;
const MARGIN = 36;

interface TableReportOptions {
  title: string;
  subtitle?: string;
  columns: { label: string; width: number }[];
  rows: (string | number | null)[][];
  generatedBy?: string;
}

/** Renders a simple landscape tabular report, paginating rows across pages as needed. */
export async function buildTableReportPdf(opts: TableReportOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const rowHeight = 18;
  const headerHeight = 22;
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = drawHeader(page, fontBold, font, opts.title, opts.subtitle);

  y = drawTableHeader(page, fontBold, opts.columns, y, headerHeight);

  for (const row of opts.rows) {
    if (y - rowHeight < MARGIN + 20) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = drawHeader(page, fontBold, font, opts.title, opts.subtitle);
      y = drawTableHeader(page, fontBold, opts.columns, y, headerHeight);
    }
    let x = MARGIN;
    row.forEach((cell, i) => {
      const text = cell === null || cell === undefined ? "-" : String(cell);
      page.drawText(truncate(text, opts.columns[i].width, font, 8), {
        x,
        y: y - rowHeight + 5,
        size: 8,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      x += opts.columns[i].width;
    });
    y -= rowHeight;
  }

  drawFooter(page, font, opts.generatedBy);

  return doc.save();
}

function drawHeader(page: PDFPage, fontBold: PDFFont, font: PDFFont, title: string, subtitle?: string): number {
  const { height } = page.getSize();
  page.drawText("PEMERINTAH KABUPATEN BANDUNG BARAT", { x: MARGIN, y: height - MARGIN, size: 10, font: fontBold });
  page.drawText("DINAS KESEHATAN", { x: MARGIN, y: height - MARGIN - 13, size: 10, font: fontBold });
  page.drawText(title, { x: MARGIN, y: height - MARGIN - 32, size: 13, font: fontBold });
  if (subtitle) {
    page.drawText(subtitle, { x: MARGIN, y: height - MARGIN - 47, size: 9, font });
  }
  page.drawLine({
    start: { x: MARGIN, y: height - MARGIN - 55 },
    end: { x: page.getWidth() - MARGIN, y: height - MARGIN - 55 },
    thickness: 1,
    color: rgb(0.2, 0.2, 0.2),
  });
  return height - MARGIN - 70;
}

function drawTableHeader(page: PDFPage, fontBold: PDFFont, columns: { label: string; width: number }[], y: number, headerHeight: number): number {
  let x = MARGIN;
  page.drawRectangle({
    x: MARGIN,
    y: y - headerHeight + 6,
    width: columns.reduce((s, c) => s + c.width, 0),
    height: headerHeight,
    color: rgb(0.9, 0.93, 0.98),
  });
  columns.forEach((col) => {
    page.drawText(col.label, { x: x + 2, y: y - headerHeight + 12, size: 8, font: fontBold, color: rgb(0.1, 0.15, 0.35) });
    x += col.width;
  });
  return y - headerHeight;
}

function drawFooter(page: PDFPage, font: PDFFont, generatedBy?: string) {
  const text = `Dicetak otomatis oleh SIMPEG-DINKES KBB pada ${new Date().toLocaleString("id-ID")}${generatedBy ? ` oleh ${generatedBy}` : ""}.`;
  page.drawText(text, { x: MARGIN, y: MARGIN - 15, size: 7, font, color: rgb(0.4, 0.4, 0.4) });
}

function truncate(text: string, widthPt: number, font: PDFFont, size: number): string {
  const maxChars = Math.max(4, Math.floor(widthPt / (size * 0.55)));
  return text.length > maxChars ? text.slice(0, maxChars - 1) + "…" : text;
}
