import type { AnalysisResult, DocumentRecord, Fact, Finding } from '../shared/types.js';

const labels: Array<[string, RegExp]> = [
  ['Company', /(?:company|business|legal name)\s*[:,-]?\s*([A-Z][\w &.,'-]{2,60})/i],
  ['Applicant', /(?:applicant|director|contact)\s*[:,-]?\s*([A-Z][\w .'-]{2,60})/i],
  ['Address', /(?:registered address|address)\s*[:,-]?\s*([^\n,]{5,90})/i],
  ['Licence', /(?:licen[cs]e|registration)(?: number| no\.)?\s*[:#,-]?\s*([A-Z0-9/-]{4,30})/i],
  ['Revenue', /(?:annual )?revenue\s*[:,-]?\s*([\$₹€£]?[\d,.]+\s*(?:million|m|k|crore|lakhs?)?)/i],
  ['Loan amount', /(?:loan|facility) amount\s*[:,-]?\s*([\$₹€£]?[\d,.]+\s*(?:million|m|k|crore|lakhs?)?)/i],
  ['Date', /(?:date|issued|valid until|expiry)\s*[:,-]?\s*(\d{1,4}[/-]\d{1,2}[/-]\d{1,4}|\w+\s+\d{1,2},?\s+\d{4})/i],
];

export function extractFacts(text: string): Fact[] {
  const facts: Fact[] = [];
  for (const [label, pattern] of labels) {
    const match = text.match(pattern);
    if (match?.[1]) facts.push({ label, value: match[1].trim().replace(/[.,;]+$/, ''), evidence: match[0].trim() });
  }
  return facts;
}

const key = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
export function analyzeDocuments(documents: DocumentRecord[], prompt: string): AnalysisResult {
  const grouped: Record<string, Fact[]> = Object.fromEntries(documents.map(d => [String(d.id), d.facts]));
  const byLabel = new Map<string, Array<{ doc: DocumentRecord; fact: Fact }>>();
  for (const doc of documents) for (const fact of doc.facts) {
    const bucket = byLabel.get(key(fact.label)) ?? [];
    bucket.push({ doc, fact }); byLabel.set(key(fact.label), bucket);
  }
  const findings: Finding[] = [];
  for (const items of byLabel.values()) {
    if (items.length < 2) continue;
    const unique = new Set(items.map(item => key(item.fact.value)));
    const category = unique.size > 1 ? 'discrepancy' : 'agreement';
    findings.push({ category, title: `${items[0].fact.label} ${category === 'agreement' ? 'matches' : 'differs'}`,
      detail: items.map(({ doc, fact }) => `${doc.filename}: ${fact.value}`).join(' · '),
      sources: items.map(({ doc, fact }) => ({ documentId: doc.id, filename: doc.filename, excerpt: fact.evidence })) });
  }
  const mentioned = /date|deadline|expiry/i.test(prompt) ? ['Date'] : [];
  for (const label of mentioned) if (!byLabel.has(key(label))) findings.push({ category: 'missing', title: `${label} not found`, detail: `No ${label.toLowerCase()} was extracted from the uploaded documents.`, sources: documents.map(d => ({ documentId: d.id, filename: d.filename, excerpt: 'No matching evidence found' })) });
  for (const doc of documents) if (doc.facts.length === 0) findings.push({ category: 'observation', title: 'No structured facts extracted', detail: `Review ${doc.filename}; the mock extractor did not recognize any supported fields.`, sources: [{ documentId: doc.id, filename: doc.filename, excerpt: doc.extractedText.slice(0, 180) }] });
  return { summary: `${documents.length} document${documents.length === 1 ? '' : 's'} reviewed for: “${prompt}”. Found ${findings.filter(f => f.category === 'discrepancy').length} potential discrepancy(ies), ${findings.filter(f => f.category === 'agreement').length} matching field(s), and ${findings.filter(f => f.category === 'missing').length} prompted missing field(s).`, factsByDocument: grouped, findings, interpretationNote: 'Facts above are pattern-extracted from text and include the matched evidence. Findings are deterministic demo interpretations, not verified legal or financial conclusions.' };
}
