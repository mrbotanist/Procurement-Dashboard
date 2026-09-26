import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Local-disk file storage. Keys are relative paths under STORAGE_DIR, so an
// S3/R2 implementation can replace these three functions later.

export const MAX_FILE_BYTES = 20 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  txt: "text/plain",
};

const root = () => path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_DIR || "./storage");

export class StorageError extends Error {}

export function checkUpload(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED[ext]) throw new StorageError(`${file.name}: only PDF, images, Excel, Word, CSV or text files are allowed.`);
  if (file.size > MAX_FILE_BYTES) throw new StorageError(`${file.name} is larger than 20 MB.`);
  if (file.size === 0) throw new StorageError(`${file.name} is empty.`);
  return { ext, mimeType: ALLOWED[ext] };
}

export function safeName(name: string) {
  const base = path.basename(name).replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, "-");
  return base.slice(-120) || "file";
}

/** Saves an uploaded file and returns its storage key. */
export async function saveUpload(file: File, folder: string) {
  const { mimeType } = checkUpload(file);
  const now = new Date();
  const key = path.posix.join(folder.replace(/[^\w-]/g, "_"), `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`, `${randomUUID()}-${safeName(file.name)}`);
  const full = path.join(root(), key);
  await mkdir(/*turbopackIgnore: true*/ path.dirname(full), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ full, Buffer.from(await file.arrayBuffer()));
  return { storageKey: key, size: file.size, mimeType, fileName: safeName(file.name) };
}

/** Reads a stored file. Seed documents have no file on disk; they get a generated placeholder. */
export async function readStored(key: string, fileName: string): Promise<{ body: Buffer; mimeType: string } | null> {
  const full = path.join(root(), key);
  if (!full.startsWith(root() + path.sep)) return null; // path traversal guard
  try {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    return { body: await readFile(/*turbopackIgnore: true*/ full), mimeType: ALLOWED[ext] ?? "application/octet-stream" };
  } catch {
    if (key.startsWith("seed/")) return { body: placeholderPdf(fileName), mimeType: "application/pdf" };
    return null;
  }
}

/** Minimal one-page PDF saying this is sample data. */
function placeholderPdf(fileName: string): Buffer {
  const text = `Sample document: ${fileName.replace(/[()\\]/g, "")}`;
  const stream = `BT /F1 16 Tf 72 720 Td (${text}) Tj 0 -28 Td /F1 11 Tf (Created by the seed script. Upload the real file from the PO or Documents screen.) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}
