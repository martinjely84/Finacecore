import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: 'var(--bg-card2)',
      border: '1px solid var(--border-light)',
      borderRadius: 8,
      padding: '10px 14px',
    }}>
      <div style={{ fontWeight: 600, fontSize: 13 }}>{d.category}</div>
      <div style={{ color: d.color, fontFamily: 'var(--font-mono)', fontSize: 15, marginTop: 2 }}>{fmt(d.amount)}</div>
    </div>
  );
};

export default function SpendingChart({ spending, periodLabel = '30d' }) {
  if (!spending?.length) {
    return (
      <div className="card" style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No spending in this period.
      </div>
    );
  }
  const total = spending.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="card" style={{ height: 420, display: 'flex', flexDirection: 'column' }}>
      <div className="card-header">
        <span className="label">Spending by Category</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
          {fmt(total)} / {periodLabel}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={190}>
        <PieChart>
          <Pie
            data={spending}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            dataKey="amount"
          >
            {spending.map((entry, i) => (
              <Cell key={i} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {/* Legend as a clean ranked list instead of recharts' overlapping wrap */}
      <div style={{ flex: 1, overflowY: 'auto', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {spending.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, padding: '2px 4px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', minWidth: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.category}</span>
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', flexShrink: 0, marginLeft: 8 }}>
              {fmt(s.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
