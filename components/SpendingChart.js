import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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

export default function SpendingChart({ spending }) {
  if (!spending?.length) return null;
  const total = spending.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="card" style={{ height: 340 }}>
      <div className="card-header">
        <span className="label">Spending by Category</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
          {fmt(total)} / 30d
        </span>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={spending}
            cx="50%"
            cy="45%"
            innerRadius={65}
            outerRadius={95}
            paddingAngle={2}
            dataKey="amount"
          >
            {spending.map((entry, i) => (
              <Cell key={i} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value, entry) => (
              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{entry.payload.category}</span>
            )}
            iconType="circle"
            iconSize={8}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
