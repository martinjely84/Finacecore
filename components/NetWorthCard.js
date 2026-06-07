const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
const fmtPct = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

export default function NetWorthCard({ netWorth }) {
  if (!netWorth) return null;
  const up = netWorth.change30d >= 0;
  return (
    <div className="card" style={{ background: 'linear-gradient(135deg, #111118 0%, #16161f 100%)', borderColor: 'var(--gold-dim)' }}>
      <div className="card-header">
        <span className="label">Net Worth</span>
        <span className={`badge ${up ? 'badge-green' : 'badge-red'}`}>
          {up ? '▲' : '▼'} {fmtPct(Math.abs(netWorth.changePct))} 30d
        </span>
      </div>
      <div className="value-lg gold">{fmt(netWorth.total)}</div>
      <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
        <div>
          <div className="label">Assets</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600, color: 'var(--green)', marginTop: 4 }}>
            {fmt(netWorth.assets)}
          </div>
        </div>
        <div>
          <div className="label">Liabilities</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600, color: 'var(--red)', marginTop: 4 }}>
            {fmt(netWorth.liabilities)}
          </div>
        </div>
        <div>
          <div className="label">30-Day Change</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600, color: up ? 'var(--green)' : 'var(--red)', marginTop: 4 }}>
            {up ? '+' : ''}{fmt(netWorth.change30d)}
          </div>
        </div>
      </div>
    </div>
  );
}
