const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n));

const CAT_COLORS = {
  Income: 'var(--green)',
  Groceries: '#3dd68c',
  Dining: 'var(--orange)',
  Shopping: 'var(--purple)',
  Gas: 'var(--gold)',
  Entertainment: 'var(--blue)',
  Utilities: '#67e8f9',
  Healthcare: '#a78bfa',
};

export default function TransactionsList({ transactions }) {
  if (!transactions?.length) return null;
  return (
    <div className="card">
      <div className="card-header">
        <span className="label">Recent Transactions</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{transactions.length} items</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 460, overflowY: 'auto' }}>
        {transactions.map((tx) => {
          const isIncome = tx.amount > 0;
          const catColor = CAT_COLORS[tx.category] ?? 'var(--text-muted)';
          return (
            <div
              key={tx.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 8,
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: catColor,
                  flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{tx.merchant}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                    {tx.date} · <span style={{ color: catColor }}>{tx.category}</span>
                  </div>
                </div>
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                fontSize: 14,
                color: isIncome ? 'var(--green)' : 'var(--text-primary)',
              }}>
                {isIncome ? '+' : '-'}{fmt(tx.amount)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
