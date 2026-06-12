import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const isTransfer = (c) => /transfer/i.test(c ?? '');

const COLORS = ['#6ea8fe', '#3dd68c', '#ffa657', '#b794f4', '#c9a84c', '#f05252', '#67e8f9', '#a78bfa', '#f0883e', '#4ade80', '#fb7185', '#34d399'];

function analyse(transactions) {
  const byMonth = {};
  const catTotals = {};
  for (const t of transactions) {
    const m = (t.date ?? '').slice(0, 7);
    if (!m) continue;
    byMonth[m] ??= { income: 0, spend: 0, transfers: 0 };
    const amt = t.amount ?? 0;
    if (isTransfer(t.category)) { byMonth[m].transfers += Math.abs(amt); continue; }
    if (amt > 0) byMonth[m].income += amt;
    else {
      byMonth[m].spend += Math.abs(amt);
      const cat = t.category || 'Other';
      catTotals[cat] = (catTotals[cat] ?? 0) + Math.abs(amt);
    }
  }

  const months = Object.keys(byMonth).sort();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const complete = months.filter((m) => m !== currentMonth);
  const n = Math.max(complete.length, 1);

  const avg = {
    income: complete.reduce((s, m) => s + byMonth[m].income, 0) / n,
    spend: complete.reduce((s, m) => s + byMonth[m].spend, 0) / n,
  };
  avg.net = avg.income - avg.spend;

  // Category averages: exclude the partial current month so averages are honest.
  const catAvg = {};
  for (const t of transactions) {
    const m = (t.date ?? '').slice(0, 7);
    if (m === currentMonth || (t.amount ?? 0) >= 0 || isTransfer(t.category)) continue;
    const cat = t.category || 'Other';
    catAvg[cat] = (catAvg[cat] ?? 0) + Math.abs(t.amount) / n;
  }
  const categories = Object.entries(catAvg)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount], i) => ({
      category,
      amount,
      pct: avg.spend ? (amount / avg.spend) * 100 : 0,
      color: COLORS[i % COLORS.length],
    }));

  const chart = months.map((m) => ({
    month: new Date(`${m}-15`).toLocaleString('en-US', { month: 'short' }),
    Income: Math.round(byMonth[m].income),
    Spending: Math.round(byMonth[m].spend),
    partial: m === currentMonth,
  }));

  const thisMonth = byMonth[currentMonth] ?? { income: 0, spend: 0 };

  return { avg, categories, chart, thisMonth, nMonths: n };
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-card2)', border: '1px solid var(--border-light)', borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ fontSize: 12, color: p.color, fontFamily: 'var(--font-mono)' }}>
          {p.name}: {fmt(p.value)}
        </div>
      ))}
    </div>
  );
};

export default function MonthlyView({ transactions }) {
  if (!transactions?.length) {
    return <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>No transaction history yet.</div>;
  }
  const { avg, categories, chart, thisMonth, nMonths } = analyse(transactions);
  const monthProgress = new Date().getDate() / 30;
  const pace = thisMonth.spend / Math.max(monthProgress, 0.1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Average month summary */}
      <div style={{ display: 'flex', gap: 12 }}>
        {[
          { label: 'Avg Money In / mo', value: avg.income, color: 'var(--green)' },
          { label: 'Avg Money Out / mo', value: avg.spend, color: 'var(--orange)', sub: 'real spending, excl. transfers' },
          { label: 'Avg Net / mo', value: avg.net, color: avg.net >= 0 ? 'var(--green)' : 'var(--red)', signed: true },
          {
            label: 'This Month Pace', value: pace, color: pace > avg.spend ? 'var(--red)' : 'var(--green)',
            sub: pace > avg.spend ? `tracking ${fmt(pace - avg.spend)} over your average` : `tracking ${fmt(avg.spend - pace)} under your average`,
          },
        ].map((c) => (
          <div key={c.label} className="card" style={{ flex: 1 }}>
            <div className="label">{c.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: c.color, marginTop: 6 }}>
              {c.signed && c.value >= 0 ? '+' : c.signed ? '−' : ''}{fmt(Math.abs(c.value))}
            </div>
            {c.sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* Month-to-month trend */}
      <div className="card">
        <div className="card-header">
          <span className="label">Month to Month — Income vs Real Spending</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>current month is partial · transfers excluded</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chart} barGap={4}>
            <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Legend formatter={(v) => <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{v}</span>} iconType="circle" iconSize={8} />
            <ReferenceLine y={avg.spend} stroke="var(--gold-dim)" strokeDasharray="4 4" />
            <Bar dataKey="Income" fill="#3dd68c" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Spending" fill="#ffa657" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* What an average month is spent on */}
      <div className="card">
        <div className="card-header">
          <span className="label">What We Spend On — Average Month ({nMonths} complete months)</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>{fmt(avg.spend)} / mo</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {categories.map((c) => (
            <div key={c.category}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{c.category}</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {fmt(c.amount)} <span style={{ color: 'var(--text-muted)' }}>· {c.pct.toFixed(0)}%</span>
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(c.pct, 100)}%`, height: '100%', borderRadius: 3, background: c.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
