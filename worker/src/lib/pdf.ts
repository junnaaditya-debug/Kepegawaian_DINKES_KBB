import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";

export interface PdfColumn {
  header: string;
  width: number; // points
  key: string;
}

export interface PdfTableOptions {
  title: string;
  subtitle?: string;
  columns: PdfColumn[];
  rows: Record<string, string | number | null | undefined>[];
  generatedBy?: string;
}

const PAGE_WIDTH = 841.89; // A4 landscape
const PAGE_HEIGHT = 595.28;
const MARGIN = 36;
const ROW_HEIGHT = 20;
const HEADER_HEIGHT = 24;

function truncate(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && font.widthOfTextAtSize(out + "…", size) > maxWidth) {
    out = out.slice(0, -1);
  }
  return out + "…";
}

export async function buildTablePdf(opts: PdfTableOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const usableWidth = PAGE_WIDTH - MARGIN * 2;
  const totalColWidth = opts.columns.reduce((s, c) => s + c.width, 0);
  const scale = totalColWidth > usableWidth ? usableWidth / totalColWidth : 1;
  const cols = opts.columns.map((c) => ({ ...c, width: c.width * scale }));

  let page: PDFPage;
  let y: number;
  let pageNum = 0;

  function drawHeader(newPage: PDFPage) {
    let x = MARGIN;
    newPage.drawRectangle({ x: MARGIN, y: PAGE_HEIGHT - MARGIN - HEADER_HEIGHT, width: usableWidth, height: HEADER_HEIGHT, color: rgb(0.13, 0.31, 0.53) });
    for (const col of cols) {
      newPage.drawText(truncate(col.header, fontBold, 9, col.width - 6), {
        x: x + 3,
        y: PAGE_HEIGHT - MARGIN - HEADER_HEIGHT + 8,
        size: 9,
        font: fontBold,
        color: rgb(1, 1, 1),
      });
      x += col.width;
    }
  }

  function newPage() {
    pageNum++;
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawText(opts.title, { x: MARGIN, y: PAGE_HEIGHT - MARGIN + 14, size: 14, font: fontBold });
    if (opts.subtitle) {
      page.drawText(opts.subtitle, { x: MARGIN, y: PAGE_HEIGHT - MARGIN, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
    }
    drawHeader(page);
    y = PAGE_HEIGHT - MARGIN - HEADER_HEIGHT - ROW_HEIGHT + 6;
  }

  newPage();

  opts.rows.forEach((row, idx) => {
    if (y < MARGIN + 30) newPage();
    if (idx % 2 === 1) {
      page.drawRectangle({ x: MARGIN, y: y - 5, width: usableWidth, height: ROW_HEIGHT, color: rgb(0.95, 0.96, 0.98) });
    }
    let x = MARGIN;
    for (const col of cols) {
      const value = row[col.key];
      const text = value == null ? "" : String(value);
      page.drawText(truncate(text, font, 8.5, col.width - 6), { x: x + 3, y, size: 8.5, font, color: rgb(0.1, 0.1, 0.1) });
      x += col.width;
    }
    y -= ROW_HEIGHT;
  });

  const pages = doc.getPages();
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  pages.forEach((p, i) => {
    p.drawText(`Dicetak: ${now} UTC${opts.generatedBy ? ` oleh ${opts.generatedBy}` : ""} — Halaman ${i + 1}/${pages.length}`, {
      x: MARGIN,
      y: MARGIN - 20,
      size: 8,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
  });

  return doc.save();
}
