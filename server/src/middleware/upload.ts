import fs from "fs";
import path from "path";
import multer from "multer";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 10);

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error("Tipe file tidak didukung. Gunakan PDF, JPG, PNG, atau WEBP."));
      return;
    }
    cb(null, true);
  },
});

export { UPLOAD_DIR };
