import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod';
import { db } from './db.js';
import { analyzeDocuments, extractFacts } from './analysis.js';
import { extractDocumentText } from './parsers.js';
import type { DocumentRecord, Fact } from '../shared/types.js';

const app = express();
const port = Number(process.env.PORT ?? 3001);
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://127.0.0.1:5173' }));
app.use(express.json({ limit: '32kb' }));
const maxBytes = Number(process.env.MAX_UPLOAD_MB ?? 10) * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes, files: 10 } });
const documentFromRow = (row: Record<string, unknown>): DocumentRecord => ({
  id: Number(row.id), filename: String(row.filename), mimeType: String(row.mime_type), size: Number(row.size),
  uploadedAt: String(row.uploaded_at), extractedText: String(row.extracted_text),
  textTruncated: Number(row.text_truncated) === 1, facts: JSON.parse(String(row.facts_json)) as Fact[],
});
const listDocuments = (): DocumentRecord[] => (db.prepare('SELECT * FROM documents ORDER BY id DESC').all() as Record<string, unknown>[]).map(documentFromRow);

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/documents', (_req, res) => res.json(listDocuments().map(({ extractedText: _text, ...doc }) => doc)));
app.post('/api/documents', upload.array('files', 10), async (req, res) => {
  const files = (req.files ?? []) as Express.Multer.File[];
  if (!files.length) return res.status(400).json({ error: 'Choose at least one file.' });
  const allowed = new Set(['.pdf', '.txt', '.csv']);
  const added: DocumentRecord[] = [];
  for (const file of files) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.has(ext)) return res.status(415).json({ error: `${file.originalname}: unsupported format. Use PDF, TXT, or CSV.` });
    if (file.size === 0) return res.status(400).json({ error: `${file.originalname}: file is empty.` });
    try {
      const raw = await extractDocumentText(file.originalname, file.buffer);
      const normalizedText = raw.replace(/\u0000/g, '').trim();
      const textTruncated = normalizedText.length > 200_000;
      const extractedText = normalizedText.slice(0, 200_000);
      if (!extractedText) return res.status(422).json({ error: `${file.originalname}: no readable text found. Scanned PDFs need OCR.` });
      const facts: Fact[] = extractFacts(extractedText);
      const info = { filename: path.basename(file.originalname).slice(0, 180), mime_type: file.mimetype || 'application/octet-stream', size: file.size, uploaded_at: new Date().toISOString(), extracted_text: extractedText, facts_json: JSON.stringify(facts), text_truncated: Number(textTruncated) };
      const inserted = db.prepare('INSERT INTO documents (filename,mime_type,size,uploaded_at,extracted_text,facts_json,text_truncated) VALUES (@filename,@mime_type,@size,@uploaded_at,@extracted_text,@facts_json,@text_truncated)').run(info);
      added.push({ id: Number(inserted.lastInsertRowid), filename: info.filename, mimeType: info.mime_type, size: info.size, uploadedAt: info.uploaded_at, extractedText, textTruncated, facts });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Could not read this file';
      return res.status(422).json({ error: `${file.originalname}: ${detail}` });
    }
  }
  return res.status(201).json(added.map(({ extractedText: _text, ...doc }) => doc));
});
app.delete('/api/documents/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid document id.' });
  const result = db.prepare('DELETE FROM documents WHERE id = ?').run(id);
  return result.changes ? res.status(204).end() : res.status(404).json({ error: 'Document not found.' });
});
app.post('/api/analyze', (req, res) => {
  const input = z.object({ prompt: z.string().trim().min(5).max(1000) }).safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: 'Enter an instruction between 5 and 1,000 characters.' });
  const documents = listDocuments();
  if (!documents.length) return res.status(400).json({ error: 'Upload documents before starting an analysis.' });
  const result = analyzeDocuments(documents, input.data.prompt);
  db.prepare('INSERT INTO analyses (prompt,result_json,created_at) VALUES (?,?,?)').run(input.data.prompt, JSON.stringify(result), new Date().toISOString());
  return res.json(result);
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof multer.MulterError) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? `File exceeds ${process.env.MAX_UPLOAD_MB ?? 10} MB.` : 'Upload limit reached (maximum 10 files).' });
  console.error(error);
  return res.status(500).json({ error: 'Unexpected server error. Please retry.' });
});
const clientDist = path.resolve('dist');
if (fs.existsSync(clientDist)) app.use(express.static(clientDist));
app.listen(port, '0.0.0.0', () => console.log(`Workbench API listening on port ${port}`));
