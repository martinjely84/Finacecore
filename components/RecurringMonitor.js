const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n));

const TYPE_META = {
  bill: { label: 'Bills & Utilities', icon: '🧾', color: 'var(--orange)' },
  subscription: { label: 'Subscriptions', icon: '🔁', color: 'var(--purple)' },
  income: { label: 'Recurring Income', icon: '💵', color: 'var(--green)' },
};

function SummaryCard({ label, amount, color, sub }) {
  return (
    <div className="card" style={{ flex: 1 }}>
      <div className="label">{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color, marginTop: 6 }}>
        {fmt(amount)}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function Row({ item }) {
  const meta = TYPE_META[item.type] ?? TYPE_META.bill;
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px', borderRadius: 8, transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', background: meta.color, flexShrink: 0,
        }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{item.merchant}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
            {item.category}{item.lastSeen ? ` · last ${item.lastSeen}` : ''}
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 14, color: item.type === 'income' ? 'var(--green)' : 'var(--text-primary)' }}>
          {fmt(item.amount)}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
          {item.frequency}
          {item.monthlyAmount && item.frequency !== 'monthly' ? ` · ≈${fmt(item.monthlyAmount)}/mo` : ''}
        </div>
      </div>
    </div>
  );
}

function Section({ type, items }) {
  const meta = TYPE_META[type];
  const list = items.filter((i) => i.type === type).sort((a, b) => b.amount - a.amount);
  return (
    <div className="card">
      <div className="card-header">
        <span className="label">{meta.icon} {meta.label}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{list.length}</span>
      </div>
      {list.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '8px 12px' }}>
          {type === 'bill'
            ? 'No recurring bills detected yet. Utilities & insurance will appear here as more transaction history syncs from your bank.'
            : 'None detected yet.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {list.map((item, i) => <Row key={i} item={item} />)}
        </div>
      )}
    </div>
  );
}

export default function RecurringMonitor({ data, loading }) {
  if (loading) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>◌</div>
        Scanning for recurring charges…
      </div>
    );
  }
  const { items = [], totals = {} } = data || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <SummaryCard label="Monthly Income" amount={totals.income} color="var(--green)" sub="recurring deposits" />
        <SummaryCard label="Monthly Bills" amount={totals.bills} color="var(--orange)" sub="utilities, insurance, rent" />
        <SummaryCard label="Subscriptions" amount={totals.subscriptions} color="var(--purple)" sub="recurring services" />
      </div>

      <Section type="bill" items={items} />
      <Section type="subscription" items={items} />
      <Section type="income" items={items} />

      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
        Detected automatically from your bank activity via Era. Ask the AI advisor to dig into any charge.
      </div>
    </div>
  );
}
