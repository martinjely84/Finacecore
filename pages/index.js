import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import AccountCard from '../components/AccountCard';
import NetWorthCard from '../components/NetWorthCard';
import SpendingChart from '../components/SpendingChart';
import TransactionsList from '../components/TransactionsList';
import ChatBot from '../components/ChatBot';

export default function Dashboard() {
  const [data, setData] = useState({ accounts: [], netWorth: null, spending: [] });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch('/api/accounts').then(r => r.json()),
      fetch('/api/transactions').then(r => r.json()),
    ]).then(([accountData, txData]) => {
      if (accountData.error) setError(accountData.error);
      setData(accountData);
      setTransactions(txData.transactions ?? []);
      setLoading(false);
    }).catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const financialContext = {
    household: 'Martin Ely (joint accounts)',
    netWorth: data.netWorth,
    accounts: data.accounts?.map(a => ({ name: a.name, type: a.type, balance: a.balance })),
    topSpending: data.spending?.slice(0, 8),
    recentTransactions: transactions?.slice(0, 15),
  };

  return (
    <Layout>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Household Overview</h1>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            Joint accounts · live from Era Context
          </div>
        </div>

        {loading ? (
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
            <NetWorthCard netWorth={data.netWorth} />

            <div>
              <div className="label" style={{ marginBottom: 12 }}>Accounts</div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 12,
              }}>
                {data.accounts?.map(acc => (
                  <AccountCard key={acc.id} account={acc} />
                ))}
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '340px 1fr',
              gap: 20,
            }}>
              <SpendingChart spending={data.spending} />
              <TransactionsList transactions={transactions} />
            </div>
          </div>
        )}
      </div>

      <ChatBot financialContext={financialContext} />
    </Layout>
  );
}
