# Multi-Document Intelligence Workbench

A local full-stack demo for uploading several documents, extracting a small set of facts, and comparing those facts with traceable evidence. All included sample data is synthetic.

## Quick start

Requirements: Node.js 24+ and npm (the server uses Node's built-in SQLite module).

1. Copy `.env.example` to `.env` and adjust values if needed.
2. Install dependencies with `npm install`.
3. Start both services with `npm run dev`.
4. Open http://127.0.0.1:5173 and upload files from `samples/`.

The API uses port 3001 by default and SQLite creates `workbench.sqlite` on first run. `npm run build` produces the frontend bundle; `npm start` runs the API and serves that bundle when `dist/` exists. `npm test` runs the included automated test.

## Deploying to Render

Create a Node Web Service from this repository with build command `npm ci && npm run build` and start command `npm start`. Render supplies `PORT`; the server listens on all network interfaces and serves the React build and API from the same origin. The free web service filesystem is ephemeral, so the SQLite database and uploaded analysis records can reset after a restart or redeploy. Use a persistent database/storage setup before relying on deployed records.

## Architecture

- `src/client`: React + TypeScript single-page interface, file upload, prompt entry, provenance display, and copy action.
- `src/server`: Express + TypeScript API, in-memory upload handling, PDF/text/CSV ingestion, extraction, analysis, and SQLite persistence.
- `src/shared/types.ts`: shared contracts for facts, sources, findings, and documents.
- `src/server/analysis.ts`: separate deterministic extractor and comparison function. It retains document IDs and matched evidence rather than concatenating sources into a single prompt.
- `samples/`: synthetic application and accounts examples with an intentional licence and revenue mismatch.

## Assumptions and completed functionality

- Supported inputs are PDF, TXT, and CSV. PDF text extraction uses `pdf-parse`; scanned/image-only PDFs need OCR and return a readable error.
- The analysis implementation is a deterministic mock, so no LLM credentials or network calls are required. It recognizes a focused set of common fields and compares matching labels across documents.
- Users can upload up to 10 files per request, 10 MB each by default, list them, remove them, issue a natural language instruction, see per-document extracted facts and sourced findings, and copy the structured JSON output.
- Uploads are held in memory only and extracted text/facts are saved to SQLite. The demo does not persist original uploaded file bytes.
- The request prompt is recorded with each result; analysis is re-run over all currently stored documents.

## AI and decision disclosure

This reference implementation was created with Codex. The implementation decisions made here include using a deterministic mock analyzer, keeping each uploaded document as an independent database row, using extracted evidence excerpts for provenance, and storing uploads in memory rather than on disk. The app runtime makes no external LLM calls. A candidate adapting this project should disclose the AI development tools they actually used and identify which architectural and implementation decisions they made personally.

## Known limitations

- The mock recognizer uses simple patterns and is not robust to arbitrary layouts, languages, OCR artifacts, or ambiguous values.
- CSV files are ingested as text, not interpreted as typed tables. There is no image OCR, chunking, background job queue, auth, or per-user data isolation.
- Database rows store extracted content without a retention policy. The app is intended for local synthetic-data evaluation only, not real customer or banking documents.
- Local development uses the Vite API proxy. In production the frontend calls the same-origin API, and the server binds to all interfaces for the host proxy.

## Security considerations

- File names are reduced to basenames and are never used as disk paths. The server uses memory storage, a format allowlist, file/count limits, prompt validation, text truncation, and parameterized SQL.
- Never upload real customer/banking data to this demo. For production, add authentication and authorization, tenant-scoped database access, malware scanning, stronger content validation, encrypted storage, data deletion/retention controls, rate limits, audit logging, secret management, and privacy review.
- Do not treat extracted facts or generated interpretations as authoritative. Evidence excerpts are shown so a reviewer can verify them against the source.

## Productionisation

Replace the mock analyzer behind the analysis module with a provider adapter that requests schema-constrained JSON, validates it, and preserves document IDs and quoted source spans. Add OCR for image/scanned documents, page-aware chunking and retrieval for large files, asynchronous processing, retries and observability, authentication, tenant isolation, encrypted object storage, retention/deletion workflows, and a comprehensive test suite. Keep evidence-grounding checks and human review for high-impact decisions.

## Automated test

`src/server/analysis.test.ts` verifies that revenue is extracted, conflicting values are flagged, and each value remains associated with its originating document. Run it with `npm test`.

## Submission checklist

- Complete source code: this repository.
- Setup instructions and `.env.example`: included.
- Synthetic sample files: `samples/application.txt` and `samples/accounts.csv`.
- Database schema: initialized in `src/server/db.ts` on startup.
- Automated test: `src/server/analysis.test.ts`.
- Commit history: initialize a Git repository and create clear, descriptive commits during the exercise. No commit history is fabricated by this starter.
