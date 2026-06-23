const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.abs(n));

const COLORS = ['#6ea8fe', '#3dd68c', '#ffa657', '#b794f4', '#c9a84c', '#f05252', '#67e8f9', '#a78bfa', '#f0883e', '#4ade80'];

export default function MerchantBreakdown({ transactions, label = 'By Merchant' }) {
  if (!transactions?.length) return null;

  const expenses = transactions.filter((t) => (t.amount ?? 0) < 0 && !/transfer/i.test(t.category ?? ''));
  if (!expenses.length) return null;

  const byMerchant = {};
  for (const t of expenses) {
    const key = t.merchant || 'Unknown';
    byMerchant[key] = (byMerchant[key] ?? 0) + Math.abs(t.amount);
  }

  const sorted = Object.entries(byMerchant).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="card">
      <div className="card-header">
        <span className="label">{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>{fmt(total)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map(([merchant, amount], i) => {
          const pct = total ? (amount / total) * 100 : 0;
          return (
            <div key={merchant}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0, display: 'inline-block' }} />
                  {merchant}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {fmt(amount)} <span style={{ color: 'var(--text-muted)' }}>· {pct.toFixed(0)}%</span>
                </span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', borderRadius: 3, background: COLORS[i % COLORS.length] }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
