/**
 * Era Context MCP client — https://context.era.app
 * All calls are server-side only (pages/api routes).
 */

const ERA_BASE = 'https://context.era.app';
const ERA_TOKEN = process.env.ERA_API_KEY;

async function eraFetch(path, opts = {}) {
  const res = await fetch(`${ERA_BASE}${path}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${ERA_TOKEN}`,
      'Content-Type': 'application/json',
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Era API ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getAccounts(userId) {
  try {
    const data = await eraFetch(`/v1/accounts?user_id=${userId}`);
    return data.accounts ?? data ?? [];
  } catch {
    return getMockAccounts(userId);
  }
}

export async function getTransactions(userId, { limit = 50, since } = {}) {
  try {
    const params = new URLSearchParams({ user_id: userId, limit });
    if (since) params.set('since', since);
    const data = await eraFetch(`/v1/transactions?${params}`);
    return data.transactions ?? data ?? [];
  } catch {
    return getMockTransactions(userId);
  }
}

export async function getNetWorth(userId) {
  try {
    return await eraFetch(`/v1/net-worth?user_id=${userId}`);
  } catch {
    return getMockNetWorth(userId);
  }
}

export async function getSpendingByCategory(userId, period = '30d') {
  try {
    const data = await eraFetch(`/v1/spending/categories?user_id=${userId}&period=${period}`);
    return data.categories ?? data ?? [];
  } catch {
    return getMockSpending(userId);
  }
}

// ── Demo / fallback data ──────────────────────────────────────────────────────

function getMockAccounts(userId) {
  const byUser = {
    martin: [
      { id: 'a1', name: 'Chase Checking', type: 'checking', balance: 12847.33, currency: 'USD', institution: 'Chase', last4: '4821' },
      { id: 'a2', name: 'Fidelity Brokerage', type: 'investment', balance: 94200.00, currency: 'USD', institution: 'Fidelity', last4: '7703' },
      { id: 'a3', name: 'Chase Sapphire Credit', type: 'credit', balance: -3240.18, currency: 'USD', institution: 'Chase', last4: '1109' },
    ],
    joanne: [
      { id: 'b1', name: 'BofA Checking', type: 'checking', balance: 8421.90, currency: 'USD', institution: 'Bank of America', last4: '6634' },
      { id: 'b2', name: 'Vanguard IRA', type: 'retirement', balance: 67500.00, currency: 'USD', institution: 'Vanguard', last4: '2291' },
      { id: 'b3', name: 'Citi Credit Card', type: 'credit', balance: -1840.55, currency: 'USD', institution: 'Citibank', last4: '3378' },
    ],
    joint: [
      { id: 'c1', name: 'Joint Savings', type: 'savings', balance: 45000.00, currency: 'USD', institution: 'Ally', last4: '9910' },
      { id: 'c2', name: 'Home Mortgage', type: 'loan', balance: -312000.00, currency: 'USD', institution: 'Wells Fargo', last4: '5512' },
      { id: 'c3', name: 'Emergency Fund', type: 'savings', balance: 18000.00, currency: 'USD', institution: 'Marcus', last4: '4401' },
    ],
  };
  return byUser[userId] ?? [];
}

function getMockTransactions(userId) {
  const base = [
    { id: 't1', date: '2026-06-06', merchant: 'Whole Foods', amount: -142.33, category: 'Groceries' },
    { id: 't2', date: '2026-06-05', merchant: 'Netflix', amount: -22.99, category: 'Entertainment' },
    { id: 't3', date: '2026-06-04', merchant: 'Shell Gas Station', amount: -68.40, category: 'Gas' },
    { id: 't4', date: '2026-06-03', merchant: 'Direct Deposit', amount: 4200.00, category: 'Income' },
    { id: 't5', date: '2026-06-03', merchant: 'Amazon', amount: -89.95, category: 'Shopping' },
    { id: 't6', date: '2026-06-02', merchant: 'Starbucks', amount: -7.45, category: 'Dining' },
    { id: 't7', date: '2026-06-01', merchant: 'Spotify', amount: -9.99, category: 'Entertainment' },
    { id: 't8', date: '2026-05-31', merchant: 'Target', amount: -234.12, category: 'Shopping' },
    { id: 't9', date: '2026-05-30', merchant: 'Electric Bill', amount: -145.00, category: 'Utilities' },
    { id: 't10', date: '2026-05-29', merchant: 'Chipotle', amount: -24.80, category: 'Dining' },
  ];
  return base;
}

function getMockNetWorth(userId) {
  const data = {
    martin: { total: 103807.15, assets: 107047.33, liabilities: -3240.18, change30d: 2841.22, changePct: 2.81 },
    joanne: { total: 74081.35, assets: 75921.90, liabilities: -1840.55, change30d: 1203.44, changePct: 1.65 },
    joint: { total: -249000.00, assets: 63000.00, liabilities: -312000.00, change30d: -800.00, changePct: -0.32 },
  };
  return data[userId] ?? { total: 0, assets: 0, liabilities: 0, change30d: 0, changePct: 0 };
}

function getMockSpending(userId) {
  return [
    { category: 'Housing', amount: 2800, color: '#6ea8fe' },
    { category: 'Groceries', amount: 680, color: '#3dd68c' },
    { category: 'Dining', amount: 420, color: '#ffa657' },
    { category: 'Shopping', amount: 380, color: '#b794f4' },
    { category: 'Gas', amount: 210, color: '#c9a84c' },
    { category: 'Entertainment', amount: 180, color: '#f05252' },
    { category: 'Utilities', amount: 320, color: '#67e8f9' },
    { category: 'Healthcare', amount: 150, color: '#a78bfa' },
  ];
}
