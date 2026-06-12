import { useState, useEffect, useRef } from 'react';

const CACHE_KEY = 'financecore_review';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // auto-refresh daily

// Minimal markdown: ## headings, **bold**, - bullets.
function renderMarkdown(md) {
  return md.split('\n').map((line, i) => {
    const bold = (s) =>
      s.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={j} style={{ color: 'var(--gold-light)' }}>{part.slice(2, -2)}</strong>
          : part
      );
    if (line.startsWith('## ')) {
      return (
        <div key={i} style={{ fontSize: 15, fontWeight: 700, marginTop: i === 0 ? 0 : 22, marginBottom: 8, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
          {line.slice(3)}
        </div>
      );
    }
    if (/^\s*[-•]\s/.test(line)) {
      return (
        <div key={i} style={{ display: 'flex', gap: 8, padding: '3px 0 3px 8px', fontSize: 13, lineHeight: 1.55 }}>
          <span style={{ color: 'var(--gold)', flexShrink: 0 }}>•</span>
          <span>{bold(line.replace(/^\s*[-•]\s/, ''))}</span>
        </div>
      );
    }
    if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
    return <div key={i} style={{ fontSize: 13, lineHeight: 1.6, padding: '2px 0' }}>{bold(line)}</div>;
  });
}

export default function ReviewTab() {
  const [review, setReview] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const startedRef = useRef(false);

  async function runReview() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/review', { method: 'POST' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setReview(data.review);
      setGeneratedAt(data.generatedAt);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
    } catch (e) {
      setError(e.message);
    }
    setRunning(false);
  }

  // Proactive: run automatically on first open (or when the cache is stale).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached?.review && Date.now() - new Date(cached.generatedAt).getTime() < MAX_AGE_MS) {
        setReview(cached.review);
        setGeneratedAt(cached.generatedAt);
        return;
      }
    } catch {}
    runReview();
  }, []);

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {generatedAt ? `Generated ${new Date(generatedAt).toLocaleString()}` : running ? 'Reviewing your live data…' : ''}
        </div>
        <button
          onClick={runReview}
          disabled={running}
          style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid var(--gold-dim)',
            background: 'rgba(201,168,76,0.12)', color: 'var(--gold)',
            fontWeight: 600, fontSize: 13, cursor: running ? 'wait' : 'pointer',
            opacity: running ? 0.6 : 1,
          }}
        >
          {running ? '✦ Reviewing…' : '↻ Refresh Review'}
        </button>
      </div>

      {running && !review && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 14, opacity: 0.5 }}>✦</div>
          <div style={{ fontSize: 14 }}>Your advisor is reviewing every account, recurring payment, and spending category…</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Usually takes 15–30 seconds.</div>
        </div>
      )}

      {error && (
        <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)', fontSize: 13 }}>
          Review failed: {error} — try Refresh.
        </div>
      )}

      {review && (
        <div className="card" style={{ padding: 28, opacity: running ? 0.5 : 1 }}>
          {renderMarkdown(review)}
        </div>
      )}
    </div>
  );
}
