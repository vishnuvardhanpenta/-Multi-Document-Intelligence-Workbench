export type Fact = { label: string; value: string; evidence: string };
export type Source = { documentId: number; filename: string; excerpt: string };
export type Finding = { category: 'agreement' | 'discrepancy' | 'missing' | 'observation'; title: string; detail: string; sources: Source[] };
export type AnalysisResult = { summary: string; factsByDocument: Record<string, Fact[]>; findings: Finding[]; interpretationNote: string };
export type DocumentRecord = { id: number; filename: string; mimeType: string; size: number; uploadedAt: string; extractedText: string; textTruncated: boolean; facts: Fact[] };
