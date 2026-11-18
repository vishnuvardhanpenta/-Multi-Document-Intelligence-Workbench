import path from 'node:path';
import pdf from 'pdf-parse';

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell.trim()); cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && input[i + 1] === '\n') i += 1;
      row.push(cell.trim());
      if (row.some(value => value.length)) rows.push(row);
      row = []; cell = '';
    } else cell += char;
  }
  if (quoted) throw new Error('CSV has an unclosed quoted field.');
  row.push(cell.trim());
  if (row.some(value => value.length)) rows.push(row);
  const expectedColumns = rows[0]?.length ?? 0;
  if (expectedColumns < 2) throw new Error('CSV must contain at least two columns.');
  const malformedRow = rows.findIndex(record => record.length !== expectedColumns);
  if (malformedRow >= 0) throw new Error(`CSV row ${malformedRow + 1} has ${rows[malformedRow].length} columns; expected ${expectedColumns}.`);
  return rows;
}

function csvToEvidence(input: string): string {
  return parseCsvRows(input).map((row, index) => {
    if (index === 0 && /^(field|key|name)$/i.test(row[0] ?? '') && /^(value|data)$/i.test(row[1] ?? '')) return '';
    if (row.length < 2) return row[0] ?? '';
    return `${row[0]}: ${row.slice(1).join(', ')}`;
  }).filter(Boolean).join('\n');
}

export async function extractDocumentText(filename: string, buffer: Buffer): Promise<string> {
  const extension = path.extname(filename).toLowerCase();
  if (extension === '.pdf') {
    if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('File does not have a valid PDF signature.');
    return (await pdf(buffer)).text;
  }
  if (extension === '.txt' || extension === '.csv') {
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
    catch { throw new Error('File is not valid UTF-8 text.'); }
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) throw new Error('Text file contains binary or unsupported control characters.');
    return extension === '.csv' ? csvToEvidence(text) : text;
  }
  throw new Error('Unsupported format. Use PDF, TXT, or CSV.');
}
