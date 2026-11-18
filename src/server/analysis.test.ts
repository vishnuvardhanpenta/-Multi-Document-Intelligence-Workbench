import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDocuments, extractFacts } from './analysis.js';

test('extracts revenue and identifies conflicting values with provenance', () => {
  const aFacts = extractFacts('Company: Northstar Foods Ltd\nAnnual revenue: $1.2 million');
  const bFacts = extractFacts('Company: Northstar Foods Ltd\nAnnual revenue: $900,000');
  assert.equal(aFacts.find(f => f.label === 'Revenue')?.value, '$1.2 million');
  const result = analyzeDocuments([
    { id: 1, filename: 'application.txt', mimeType: 'text/plain', size: 10, uploadedAt: '', extractedText: '', facts: aFacts },
    { id: 2, filename: 'accounts.csv', mimeType: 'text/csv', size: 10, uploadedAt: '', extractedText: '', facts: bFacts },
  ], 'Compare revenue');
  const mismatch = result.findings.find(f => f.title === 'Revenue differs');
  assert.ok(mismatch);
  assert.deepEqual(mismatch.sources.map(s => s.filename), ['application.txt', 'accounts.csv']);
});
