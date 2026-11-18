import type { AnalysisResult, DocumentRecord, Fact, Finding } from '../shared/types.js';

const labels: Array<[string, RegExp]> = [
  ['Company', /(?:company|business|legal name)\s*[:,-]?\s*([A-Z][\w &.,'-]{2,60})/i],
  ['Applicant', /(?:applicant|director|contact)\s*[:,-]?\s*([A-Z][\w .'-]{2,60})/i],
  ['Address', /(?:registered address|address)\s*[:,-]?\s*([^\n]{5,90})/i],
  ['Licence', /(?:licen[cs]e|registration)(?: number| no\.)?\s*[:#,-]?\s*([A-Z0-9/-]{4,30})/i],
  ['Revenue', /(?:annual )?revenue\s*[:,-]?\s*([\$₹€£]?[\d,.]+\s*(?:million|m|k|crore|lakhs?)?)/i],
  ['Loan amount', /(?:loan|facility) amount\s*[:,-]?\s*([\$₹€£]?[\d,.]+\s*(?:million|m|k|crore|lakhs?)?)/i],
  ['Date', /(?:date|issued|valid until|expiry)\s*[:,-]?\s*(\d{1,4}[/-]\d{1,2}[/-]\d{1,4}|\w+\s+\d{1,2},?\s+\d{4})/i],
  ['Obligation', /(?:obligation|repayment terms?|payment terms?)\s*[:,-]?\s*([^\n.]{3,160})/i],
];

const requestedLabels: Array<[string[], string]> = [
  [['company', 'business', 'legal name'], 'Company'],
  [['applicant', 'director', 'contact'], 'Applicant'],
  [['address'], 'Address'], [['licence', 'license', 'registration'], 'Licence'],
  [['revenue', 'financial', 'finance', 'amount', 'loan', 'facility'], 'Revenue'],
  [['loan', 'facility'], 'Loan amount'], [['date', 'deadline', 'expiry', 'issued'], 'Date'],
  [['obligation', 'repayment', 'payment terms'], 'Obligation'],
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
function fieldsRequested(prompt: string): Set<string> {
  const normalized = prompt.toLowerCase();
  const requested = new Set<string>();
  for (const [terms, label] of requestedLabels) if (terms.some(term => normalized.includes(term))) requested.add(key(label));
  if (/\bnames?\b/.test(normalized)) { requested.add(key('Company')); requested.add(key('Applicant')); }
  if (normalized.includes('financial position') || normalized.includes('financial values')) requested.add(key('Loan amount'));
  if (!requested.size || /\ball\b|everything|all information/.test(normalized)) {
    for (const [label] of labels) requested.add(key(label));
  }
  return requested;
}

export function analyzeDocuments(documents: DocumentRecord[], prompt: string): AnalysisResult {
  const grouped: Record<string, Fact[]> = Object.fromEntries(documents.map(d => [String(d.id), d.facts]));
  const wanted = fieldsRequested(prompt);
  const wantsMissing = /missing|incomplete|absent|not provided|anything missing/i.test(prompt);
  const byLabel = new Map<string, Array<{ doc: DocumentRecord; fact: Fact }>>();
  for (const doc of documents) for (const fact of doc.facts) {
    const bucket = byLabel.get(key(fact.label)) ?? [];
    bucket.push({ doc, fact }); byLabel.set(key(fact.label), bucket);
  }
  const findings: Finding[] = [];
  for (const [label, items] of byLabel) {
    if (!wanted.has(label)) continue;
    if (items.length < 2) continue;
    const unique = new Set(items.map(item => key(item.fact.value)));
    const category = unique.size > 1 ? 'discrepancy' : 'agreement';
    findings.push({ category, title: `${items[0].fact.label} ${category === 'agreement' ? 'matches' : 'differs'}`,
      detail: items.map(({ doc, fact }) => `${doc.filename}: ${fact.value}`).join(' · '),
      sources: items.map(({ doc, fact }) => ({ documentId: doc.id, filename: doc.filename, excerpt: fact.evidence })) });
  }
  if (wantsMissing) for (const doc of documents) for (const fieldKey of wanted) {
    if (doc.facts.some(fact => key(fact.label) === fieldKey)) continue;
    const label = labels.find(([name]) => key(name) === fieldKey)?.[0] ?? fieldKey;
    findings.push({ category: 'missing', title: `${label} not found in ${doc.filename}`, detail: `No ${label.toLowerCase()} was extracted from this document.`, sources: [{ documentId: doc.id, filename: doc.filename, excerpt: 'No matching evidence found' }] });
  }
  for (const doc of documents) if (doc.facts.length === 0) findings.push({ category: 'observation', title: 'No structured facts extracted', detail: `Review ${doc.filename}; the mock extractor did not recognize any supported fields.`, sources: [{ documentId: doc.id, filename: doc.filename, excerpt: doc.extractedText.slice(0, 180) }] });
  const counts = { discrepancy: findings.filter(f => f.category === 'discrepancy').length, agreement: findings.filter(f => f.category === 'agreement').length, missing: findings.filter(f => f.category === 'missing').length };
  const summary = `${documents.length} document${documents.length === 1 ? '' : 's'} reviewed for: “${prompt}”. Found ${counts.discrepancy} potential discrepancy(ies), ${counts.agreement} matching field(s), and ${counts.missing} missing field(s).`;
  return { summary, factsByDocument: grouped, findings, interpretationNote: 'Extracted facts are shown per document with supporting text. Findings compare only fields relevant to the instruction when recognized; otherwise the demo compares all supported fields. This deterministic mock is not a verified legal or financial conclusion.' };
}
