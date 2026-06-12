import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import AccountCard from '../components/AccountCard';
import NetWorthCard from '../components/NetWorthCard';
import SpendingChart from '../components/SpendingChart';
import TransactionsList from '../components/TransactionsList';
import RecurringMonitor from '../components/RecurringMonitor';
import ReviewTab from '../components/ReviewTab';
import ChatBot from '../components/ChatBot';

const STORAGE_KEY = 'financecore_tabs';

const CHART_COLORS = ['#6ea8fe', '#3dd68c', '#ffa657', '#b794f4', '#c9a84c', '#f05252', '#67e8f9', '#a78bfa', '#f0883e', '#4ade80'];

// Auto-generated tabs for each month of the current year, up to today.
function buildMonthTabs() {
  const now = new Date();
  const year = now.getFullYear();
  const tabs = [];
  for (let m = 0; m <= now.getMonth(); m++) {
    const last = new Date(year, m + 1, 0).getDate();
    const mm = String(m + 1).padStart(2, '0');
    tabs.push({
      id: `month-${year}-${mm}`,
      name: new Date(year, m, 1).toLocaleString('en-US', { month: 'short' }),
      description: `${new Date(year, m, 1).toLocaleString('en-US', { month: 'long' })} ${year} — transactions & spending`,
      categories: [],
      accountTypes: [],
      search: '',
      fromDate: `${year}-${mm}-01`,
      toDate: `${year}-${mm}-${String(last).padStart(2, '0')}`,
      minAmount: 0,
      direction: 'all',
      builtin: true,
    });
  }
  return tabs;
}

function applyTab(tab, { accounts, spending, transactions }) {
  if (!tab || tab.id === 'overview') return { accounts, spending, transactions };

  const cats = (tab.categories ?? []).map((c) => c.toLowerCase());
  const types = (tab.accountTypes ?? []).map((t) => t.toLowerCase());
  const search = (tab.search ?? '').toLowerCase();
  const fromDate = tab.fromDate || '';
  const toDate = tab.toDate || '';
  const minAmount = tab.minAmount || 0;
  const direction = tab.direction || 'all';

  const matchCat = (c) => cats.length === 0 || cats.includes((c ?? '').toLowerCase());

  const fAccounts = types.length ? accounts.filter((a) => types.includes(a.type)) : accounts;
  const fSpending = spending.filter((s) => matchCat(s.category));
  const fTransactions = transactions.filter((t) => {
    if (!matchCat(t.category)) return false;
    if (search && !(t.merchant ?? '').toLowerCase().includes(search)) return false;
    if (fromDate && (t.date ?? '') < fromDate) return false;
    if (toDate && (t.date ?? '') > toDate) return false;
    if (minAmount && Math.abs(t.amount ?? 0) < minAmount) return false;
    if (direction === 'expenses' && (t.amount ?? 0) > 0) return false;
    if (direction === 'income' && (t.amount ?? 0) < 0) return false;
    return true;
  });

  // Date-scoped tabs (e.g. month tabs): derive the spending chart from that
  // period's actual transactions instead of the global 30-day chart.
  let outSpending = fSpending.length ? fSpending : spending;
  if ((fromDate || toDate) && cats.length === 0) {
    const byCat = {};
    for (const t of fTransactions) {
      if ((t.amount ?? 0) >= 0) continue;
      const cat = t.category || 'Other';
      byCat[cat] = (byCat[cat] ?? 0) + Math.abs(t.amount);
    }
    outSpending = Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount], i) => ({ category, amount, color: CHART_COLORS[i % CHART_COLORS.length] }));
  }

  return {
    accounts: fAccounts,
    spending: outSpending,
    transactions: fTransactions,
  };
}

export default function Dashboard() {
  const [data, setData] = useState({ accounts: [], netWorth: null, spending: [] });
  const [transactions, setTransactions] = useState([]);
  const [recurring, setRecurring] = useState(null);
  const [recurringLoading, setRecurringLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  // Load saved tabs
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(saved)) setTabs(saved);
    } catch {}
  }, []);

  // Persist tabs
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs)); } catch {}
  }, [tabs]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch('/api/accounts').then((r) => r.json()),
      fetch('/api/transactions').then((r) => r.json()),
    ]).then(([accountData, txData]) => {
      if (accountData.error) setError(accountData.error);
      setData(accountData);
      setTransactions(txData.transactions ?? []);
      setLoading(false);
    }).catch((e) => { setError(e.message); setLoading(false); });

    fetch('/api/recurring')
      .then((r) => r.json())
      .then((d) => { setRecurring(d); setRecurringLoading(false); })
      .catch(() => setRecurringLoading(false));
  }, []);

  function handleCreateTab(tab) {
    setTabs((prev) => (prev.some((t) => t.id === tab.id) ? prev : [...prev, tab]));
    setActiveTab(tab.id);
  }

  function deleteTab(id) {
    setTabs((prev) => prev.filter((t) => t.id !== id));
    setActiveTab((cur) => (cur === id ? 'overview' : cur));
  }

  const monthTabs = buildMonthTabs();
  const current = [...tabs, ...monthTabs].find((t) => t.id === activeTab);
  const view = applyTab(current, { accounts: data.accounts ?? [], spending: data.spending ?? [], transactions });

  const financialContext = {
    household: 'Martin Ely (joint accounts)',
    netWorth: data.netWorth,
    accounts: data.accounts?.map((a) => ({ name: a.name, type: a.type, balance: a.balance })),
    topSpending: data.spending?.slice(0, 8),
    recentTransactions: transactions?.slice(0, 15),
    existingTabs: tabs.map((t) => t.name),
  };

  const allTabs = [
    { id: 'overview', name: 'Overview', description: 'Everything' },
    { id: 'review', name: '✦ Monthly Review', description: 'Full proactive review by your AI advisor' },
    { id: 'bills', name: 'Bills & Subscriptions', description: 'Recurring charges, utilities & insurance' },
    ...monthTabs,
    ...tabs,
  ];
  const isReview = activeTab === 'review';
  const isBills = activeTab === 'bills';
  const headerTab = allTabs.find((t) => t.id === activeTab && t.id !== 'overview') || current;

  return (
    <Layout>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {headerTab ? headerTab.name : 'Household Overview'}
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            {headerTab?.description || 'Joint accounts · live from Era Context'}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          {allTabs.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <div
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${isActive ? 'var(--gold)' : 'var(--border)'}`,
                  background: isActive ? 'rgba(201,168,76,0.12)' : 'var(--bg-card)',
                  color: isActive ? 'var(--gold)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 400, fontSize: 14,
                  transition: 'all 0.15s ease',
                }}
              >
                {t.name}
                {!['overview', 'review', 'bills'].includes(t.id) && !t.builtin && (
                  <span
                    onClick={(e) => { e.stopPropagation(); deleteTab(t.id); }}
                    style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1 }}
                    title="Remove tab"
                  >×</span>
                )}
              </div>
            );
          })}
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>
            ✦ Ask the AI to add a tab
          </span>
        </div>

        {isReview ? (
          <ReviewTab />
        ) : isBills ? (
          <RecurringMonitor data={recurring} loading={recurringLoading} />
        ) : loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-muted)', fontSize: 14 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>◌</div>
              Loading live financial data…
            </div>
          </div>
        ) : error ? (
          <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>
            Couldn’t load Era data: {error}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {!current && <NetWorthCard netWorth={data.netWorth} />}

            <div>
              <div className="label" style={{ marginBottom: 12 }}>Accounts</div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 12,
              }}>
                {view.accounts.map((acc) => (
                  <AccountCard key={acc.id} account={acc} />
                ))}
                {view.accounts.length === 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No accounts match this tab.</div>
                )}
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '340px 1fr',
              gap: 20,
            }}>
              <SpendingChart spending={view.spending} />
              <TransactionsList transactions={view.transactions} />
            </div>
          </div>
        )}
      </div>

      <ChatBot financialContext={financialContext} onCreateTab={handleCreateTab} />
    </Layout>
  );
}
