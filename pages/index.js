import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import UserTabs from '../components/UserTabs';
import AccountCard from '../components/AccountCard';
import NetWorthCard from '../components/NetWorthCard';
import SpendingChart from '../components/SpendingChart';
import TransactionsList from '../components/TransactionsList';
import ChatBot from '../components/ChatBot';

export default function Dashboard() {
  const [activeUser, setActiveUser] = useState('martin');
  const [data, setData] = useState({ accounts: [], netWorth: null, spending: [] });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/accounts?user=${activeUser}`).then(r => r.json()),
      fetch(`/api/transactions?user=${activeUser}`).then(r => r.json()),
    ]).then(([accountData, txData]) => {
      setData(accountData);
      setTransactions(txData.transactions ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [activeUser]);

  const financialContext = {
    user: activeUser,
    netWorth: data.netWorth,
    accounts: data.accounts?.map(a => ({ name: a.name, type: a.type, balance: a.balance })),
    topSpending: data.spending?.slice(0, 5),
  };

  return (
    <Layout>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <UserTabs active={activeUser} onChange={setActiveUser} />

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-muted)', fontSize: 14 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>◌</div>
              Loading financial data…
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Net Worth */}
            <NetWorthCard netWorth={data.netWorth} />

            {/* Accounts grid */}
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

            {/* Spending + Transactions */}
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
