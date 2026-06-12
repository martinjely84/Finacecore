import { useState, useRef, useEffect } from 'react';

const SUGGESTIONS = [
  "What's my biggest spending category this month?",
  "Add a dining tab to my dashboard",
  "Make a credit cards view",
  "Any tips to increase savings?",
];

export default function ChatBot({ financialContext, onCreateTab }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I\'m your FinanceCore AI advisor. Ask me anything about your finances.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(text) {
    const userMsg = text || input.trim();
    if (!userMsg || loading) return;
    setInput('');
    const newMessages = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    const apiMessages = newMessages
      .filter(m => m.role !== 'assistant' || newMessages.indexOf(m) > 0)
      .map(m => ({ role: m.role, content: m.content }));

    let assistantText = '';
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
    const updateLast = (content) =>
      setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, context: financialContext }),
      });
      if (!res.ok || !res.body) throw new Error(`Server error (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // Process only complete lines; keep the partial tail in the buffer.
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue; // skips ':' keepalive comments
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const { text, error, tab } = JSON.parse(json);
            if (error) { assistantText += `\n⚠️ ${error}`; }
            if (tab) { onCreateTab?.(tab); }
            if (text) { assistantText += text; }
            updateLast(assistantText);
          } catch {}
        }
      }
      if (!assistantText.trim()) {
        updateLast('Hmm, the connection dropped before I could answer. Please try again — shorter questions usually come back faster.');
      }
    } catch (err) {
      updateLast(
        (assistantText ? assistantText + '\n\n' : '') +
        `⚠️ The connection was interrupted (${err.message}). Please try asking again.`
      );
    }
    setLoading(false);
    inputRef.current?.focus();
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed',
          bottom: 28,
          right: 28,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--gold), var(--gold-dim))',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          boxShadow: '0 4px 24px rgba(201,168,76,0.35)',
          zIndex: 200,
          transition: 'transform 0.15s ease',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        title="AI Financial Advisor"
      >
        {open ? '✕' : '✦'}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: 92,
          right: 28,
          width: 380,
          height: 520,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 200,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--bg-card2)',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--gold), var(--gold-dim))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15,
            }}>✦</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>AI Financial Advisor</div>
              <div style={{ fontSize: 11, color: 'var(--green)' }}>● Online · Claude Opus 4.8</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: m.role === 'user' ? 'linear-gradient(135deg, var(--gold-dim), var(--gold))' : 'var(--bg-hover)',
                  color: m.role === 'user' ? '#000' : 'var(--text-primary)',
                  fontSize: 13,
                  lineHeight: 1.5,
                  fontWeight: m.role === 'user' ? 500 : 400,
                }}>
                  {m.content || (loading && i === messages.length - 1 ? (
                    <span style={{ opacity: 0.6 }}>●●●</span>
                  ) : '')}
                </div>
              </div>
            ))}
            {/* Suggestions */}
            {messages.length === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} onClick={() => send(s)} style={{
                    background: 'var(--bg-card2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    color: 'var(--text-secondary)',
                    fontSize: 12,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.1s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold-dim)'; e.currentTarget.style.color = 'var(--gold)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 8,
            background: 'var(--bg-card2)',
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Ask about your finances…"
              style={{
                flex: 1,
                background: 'var(--bg-hover)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '8px 12px',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--gold-dim)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--gold)',
                color: '#000',
                fontWeight: 600,
                fontSize: 13,
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                opacity: loading || !input.trim() ? 0.5 : 1,
              }}
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </>
  );
}
