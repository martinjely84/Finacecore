import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import AccountCard from '../components/AccountCard';
import NetWorthCard from '../components/NetWorthCard';
import SpendingChart from '../components/SpendingChart';
import TransactionsList from '../components/TransactionsList';
import RecurringMonitor from '../components/RecurringMonitor';
import ChatBot from '../components/ChatBot';

const STORAGE_KEY = 'financecore_tabs';

function applyTab(tab, { accounts, spending, transactions }) {
  if (!tab || tab.id === 'overview') return { accounts, spending, transactions };

  const cats = (tab.categories ?? []).map((c) => c.toLowerCase());
  const types = (tab.accountTypes ?? []).map((t) => t.toLowerCase());
  const search = (tab.search ?? '').toLowerCase();

  const matchCat = (c) => cats.length === 0 || cats.includes((c ?? '').toLowerCase());

  const fAccounts = types.length ? accounts.filter((a) => types.includes(a.type)) : accounts;
  const fSpending = spending.filter((s) => matchCat(s.category));
  const fTransactions = transactions.filter((t) => {
    const catOk = matchCat(t.category);
    const searchOk = !search || (t.merchant ?? '').toLowerCase().includes(search);
    return catOk && searchOk;
  });

  return {
    accounts: fAccounts,
    spending: fSpending.length ? fSpending : spending,
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

  const current = tabs.find((t) => t.id === activeTab);
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
    { id: 'bills', name: 'Bills & Subscriptions', description: 'Recurring charges, utilities & insurance' },
    ...tabs,
  ];
  const isBills = activeTab === 'bills';
  const headerTab = isBills ? allTabs[1] : current;

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
                {!['overview', 'bills'].includes(t.id) && (
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

        {isBills ? (
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
