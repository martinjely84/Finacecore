const TYPE_ICONS = {
  checking: '🏦',
  savings: '💰',
  investment: '📈',
  retirement: '🏖️',
  credit: '💳',
  loan: '🏠',
};

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

export default function AccountCard({ account }) {
  const isNeg = account.balance < 0;
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{TYPE_ICONS[account.type] ?? '🏦'}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{account.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{account.institution} ••{account.last4}</div>
          </div>
        </div>
        <span className={`badge ${isNeg ? 'badge-red' : 'badge-green'}`}>
          {account.type}
        </span>
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 22,
        fontWeight: 700,
        color: isNeg ? 'var(--red)' : 'var(--text-primary)',
        letterSpacing: '-0.02em',
      }}>
        {fmt(account.balance)}
      </div>
    </div>
  );
}
