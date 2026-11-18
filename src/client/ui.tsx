import { useEffect, useRef, useState } from 'react';
import type { AnalysisResult, DocumentRecord } from '../shared/types.js';

const API = '/api';
const fmt = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
export default function App() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [prompt, setPrompt] = useState('Compare the company, licence, and revenue values across all documents. Flag inconsistencies and anything missing.');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  async function refresh() {
    const response = await fetch(`${API}/documents`);
    if (response.ok) setDocuments(await response.json());
  }
  useEffect(() => { refresh().catch(() => setError('Could not connect to the API. Start the server with npm run dev.')); }, []);
  async function upload(files: FileList | File[]) {
    if (!files.length) return;
    setBusy(true); setError('');
    try {
      const body = new FormData(); Array.from(files).forEach(file => body.append('files', file));
      const response = await fetch(`${API}/documents`, { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Upload failed');
      setResult(null); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed'); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  }
  async function remove(id: number) {
    await fetch(`${API}/documents/${id}`, { method: 'DELETE' }); setResult(null); await refresh();
  }
  async function analyze() {
    setBusy(true); setError('');
    try {
      const response = await fetch(`${API}/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? 'Analysis failed'); setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Analysis failed'); }
    finally { setBusy(false); }
  }
  async function copy() { if (result) await navigator.clipboard.writeText(JSON.stringify(result, null, 2)); }
  return <main className="shell">
    <header className="topbar"><a className="brand" href="#">WREN<span className="brand-sub"> / INTELLIGENCE</span></a></header>
    <section className="hero"><div className="eyebrow">MULTI-DOCUMENT INTELLIGENCE</div><h1>Find the signal<br/><em>between the lines.</em></h1><p>Bring your documents together. Ask a focused question. Get sourced insights you can trace back to the page.</p></section>
    <div className="workspace">
      <section className="panel source-panel">
        <div className="section-title"><span className="step">01</span><div><h2>Source documents</h2><p>PDF, TXT or CSV · Up to 10 MB each</p></div></div>
        <div className={`dropzone ${drag ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); void upload(e.dataTransfer.files); }}>
          <div className="upload-icon">↑</div><strong>Drop files here to begin</strong><span>or <button className="text-button" onClick={() => inputRef.current?.click()}>browse your files</button></span>
          <input ref={inputRef} type="file" multiple accept=".pdf,.txt,.csv,application/pdf,text/plain,text/csv" hidden onChange={e => e.target.files && void upload(e.target.files)} />
        </div>
        <div className="file-header"><span>UPLOADED FILES</span><span>{documents.length.toString().padStart(2, '0')}</span></div>
        {documents.length ? <div className="file-list">{documents.map(doc => <div className="file-row" key={doc.id}>
          <span className="file-type">{doc.filename.split('.').pop()?.toUpperCase()}</span>
          <div className="file-info"><strong>{doc.filename}</strong><small>{fmt(doc.size)} · {doc.facts?.length ?? 0} facts extracted</small>
            {doc.textTruncated && <small className="truncate-note">Text capped at 200,000 characters</small>}
            {doc.facts?.length ? <details className="fact-preview"><summary>View extracted facts</summary><ul>{doc.facts.map((fact, i) => <li key={`${fact.label}-${i}`}><b>{fact.label}:</b> {fact.value}<small>Evidence: “{fact.evidence}”</small></li>)}</ul></details> : <small className="no-facts">No supported facts recognized</small>}
          </div>
          <span className="status-dot" title="Processed"/><button className="remove" aria-label={`Remove ${doc.filename}`} onClick={() => void remove(doc.id)}>×</button>
        </div>)}</div> : <div className="empty-files">Your uploaded documents will appear here.</div>}
        <div className="privacy"><span>◇</span><p>Files are processed locally for this demo. Use synthetic documents only.</p></div>
      </section>
      <section className="panel prompt-panel">
        <div className="section-title"><span className="step">02</span><div><h2>Set your instruction</h2><p>Tell the workbench what to look for</p><small className="llm-disclosure">Google Gemini LLM analysis · Uploaded text is sent to Google</small></div></div>
        <label htmlFor="prompt">ANALYSIS INSTRUCTION</label><textarea id="prompt" value={prompt} onChange={e => setPrompt(e.target.value)} maxLength={1000} placeholder="e.g. Compare financial figures and highlight mismatches…"/><div className="char-count">{prompt.length} / 1,000</div>
        <div className="suggestions"><span>TRY AN EXAMPLE</span>{['Find name and address mismatches', 'Extract dates and obligations'].map(text => <button key={text} onClick={() => setPrompt(text)}>{text} <span>↗</span></button>)}</div>
        <button className="analyze" onClick={() => void analyze()} disabled={busy || documents.length === 0 || prompt.trim().length < 5}>{busy ? 'Working…' : 'Run analysis'} <span>→</span></button>
      </section>
    </div>
    {error && <div className="error" role="alert">{error}<button onClick={() => setError('')}>×</button></div>}
    <section className="results panel">
      <div className="results-head"><div className="section-title"><span className="step">03</span><div><h2>Analysis results</h2><p>Findings with evidence from your source documents</p></div></div>{result && <button className="copy" onClick={() => void copy()}>Copy results ↗</button>}</div>
      {!result ? <div className="results-empty"><span>✳</span><p>Your analysis will appear here.<br/><small>Upload documents and run an instruction to get started.</small></p></div> : <div className="result-body"><p className="summary">{result.summary}</p><div className="legend"><span className="pill discrepancy">Discrepancy</span><span className="pill agreement">Agreement</span><span className="pill missing">Missing</span><span className="pill observation">Observation</span></div>{result.findings.length ? <div className="findings">{result.findings.map((finding, i) => <article className="finding" key={`${finding.title}-${i}`}><span className={`pill ${finding.category}`}>{finding.category}</span><div className="finding-copy"><h3>{finding.title}</h3><p>{finding.detail}</p><div className="evidence">{finding.sources.map((source, j) => <span key={`${source.documentId}-${j}`}><b>{source.filename}</b> · “{source.excerpt}”</span>)}</div></div></article>)}</div> : <p className="none">No comparison findings were generated for these inputs.</p>}<p className="interpretation">{result.interpretationNote}</p></div>}
    </section>
  </main>;
}
