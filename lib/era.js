/**
 * Era Context client — real data via MCP over Streamable HTTP.
 * https://context.era.app/mcp  (Authorization: Bearer <ERA_API_KEY>)
 * Server-side only (pages/api routes).
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const ERA_MCP_URL = 'https://context.era.app/mcp';

const CATEGORY_COLORS = [
  '#6ea8fe', '#3dd68c', '#ffa657', '#b794f4', '#c9a84c',
  '#f05252', '#67e8f9', '#a78bfa', '#f0883e', '#4ade80',
];

const INCOME_RE = /income|paycheck|payroll|deposit|refund|interest|dividend|reimburs/i;
const LIABILITY_TYPES = /credit|loan|mortgage|line of credit/i;

async function withEra(fn) {
  const key = process.env.ERA_API_KEY;
  if (!key) throw new Error('ERA_API_KEY not set');
  const transport = new StreamableHTTPClientTransport(new URL(ERA_MCP_URL), {
    requestInit: { headers: { Authorization: `Bearer ${key}` } },
  });
  const client = new Client({ name: 'financecore', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
  }
}

async function callJson(client, name, args = {}) {
  const r = await client.callTool({ name, arguments: args });
  const text = r.content?.map((c) => c.text).filter(Boolean).join('') ?? '';
  try { return JSON.parse(text); } catch { return {}; }
}

function isLiability(type = '') {
  return LIABILITY_TYPES.test(type);
}

function mapAccount(a) {
  const typeMap = { checking: 'checking', savings: 'savings', creditcard: 'credit', loan: 'loan', investment: 'investment' };
  const norm = (a.type || '').toLowerCase().replace(/[^a-z]/g, '');
  const balance = a.balance?.current ?? 0;
  const liability = isLiability(a.type);
  return {
    id: a.account_group_key,
    name: (a.name || '').replace(/-\s*(\d+)$/, '••$1').trim(),
    type: typeMap[norm] ?? (a.type || 'account').toLowerCase(),
    balance: liability ? -Math.abs(balance) : balance,
    currency: a.balance?.currency ?? 'USD',
    institution: a.institution ?? '',
    last4: (a.name?.match(/(\d{4})\s*$/) || [])[1] ?? '',
  };
}

export async function getOverview() {
  return withEra(async (client) => {
    const [acctRes, spendRes] = await Promise.all([
      callJson(client, 'accounts__list_financial_accounts'),
      callJson(client, 'insights__analyze_spending'),
    ]);

    const accounts = (acctRes.accounts ?? []).map(mapAccount);

    const assets = accounts.filter((a) => a.balance >= 0).reduce((s, a) => s + a.balance, 0);
    const liabilities = accounts.filter((a) => a.balance < 0).reduce((s, a) => s + a.balance, 0);

    const netWorth = {
      total: assets + liabilities,
      assets,
      liabilities,
      change30d: null,
      changePct: null,
    };

    const spending = (spendRes.groups ?? []).map((g, i) => ({
      category: g.label,
      amount: g.amount,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }));

    return { accounts, netWorth, spending };
  });
}

export async function getTransactions({ pageSize = 100, maxPages = 5, fromDate } = {}) {
  return withEra(async (client) => {
    const all = [];
    for (let page = 1; page <= maxPages; page++) {
      const res = await callJson(client, 'transactions__list_transactions', {
        page_size: pageSize,
        page,
        ...(fromDate && { from_date: fromDate }),
      });
      const batch = res.transactions ?? [];
      all.push(...batch);
      if (batch.length < pageSize) break;
    }
    // Era pages can overlap (pending/posted shifts) — dedupe by id.
    const seen = new Set();
    const unique = all.filter((t) => {
      if (seen.has(t.transaction_id)) return false;
      seen.add(t.transaction_id);
      return true;
    });
    return unique.map((t) => {
      const isIncome = INCOME_RE.test(t.category || '') || INCOME_RE.test(t.description || '');
      const magnitude = Math.abs(t.amount ?? 0);
      return {
        id: t.transaction_id,
        date: t.transaction_date,
        merchant: t.merchant_name || t.description || 'Transaction',
        amount: isIncome ? magnitude : -magnitude,
        category: t.category || 'Uncategorized',
        pending: !!t.is_pending,
      };
    });
  });
}

/**
 * Rich snapshot for the AI advisor: profile/goals + net worth + monthly cash
 * flow + top categories + recurring charges, fetched in one MCP session so the
 * model doesn't burn 30-60s gathering basics via its own tool calls.
 */
export async function getAdvisorSnapshot() {
  return withEra(async (client) => {
    const [overview, recurring] = await Promise.all([
      callJson(client, 'knowledge__get_financial_context_and_overview'),
      callJson(client, 'transactions__list_recurring_charges', { type: 'all', active_only: true }),
    ]);
    // Strip personalization noise the advisor doesn't need.
    const { personalization, warnings, ...rest } = overview ?? {};
    return { overview: rest, recurring: recurring ?? {} };
  });
}

/**
 * Everything needed for a full proactive financial review, in one MCP session:
 * overview (accounts, net worth, this/last month), recurring charges, 6-month
 * cash flow, and current-month spending by category.
 */
export async function getReviewData() {
  return withEra(async (client) => {
    const safe = (name, args) => callJson(client, name, args).catch(() => ({}));
    const [overview, recurring, cashFlow, spending] = await Promise.all([
      safe('knowledge__get_financial_context_and_overview'),
      safe('transactions__list_recurring_charges', { type: 'all', active_only: true }),
      safe('insights__get_cash_flow', {}),
      safe('insights__analyze_spending', {}),
    ]);
    const { personalization, warnings, ...rest } = overview ?? {};
    return { overview: rest, recurring, cashFlow, spending };
  });
}

// ── Recurring detection (computed from real transaction gaps; Era's own
//    detector guesses frequencies badly with limited history) ────────────────

const BILL_CATEGORIES = /mortgage|rent|utilities|insurance|student loans|childcare/i;
const SUB_CATEGORIES = /entertainment and subscriptions|health and fitness/i;

function inferFrequency(dates) {
  if (dates.length < 2) return null;
  const sorted = [...dates].sort();
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push((new Date(sorted[i]) - new Date(sorted[i - 1])) / 86400000);
  }
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  if (median <= 9) return { label: 'weekly', perMonth: 52 / 12 };
  if (median <= 18) return { label: 'biweekly', perMonth: 26 / 12 };
  if (median <= 45) return { label: 'monthly', perMonth: 1 };
  if (median <= 100) return { label: 'quarterly', perMonth: 1 / 3 };
  return null;
}

export async function getRecurring() {
  const transactions = await getTransactions({
    pageSize: 100,
    maxPages: 5,
    fromDate: `${new Date().getFullYear()}-01-01`,
  });

  const items = [];

  const addGroup = (txs, type) => {
    if (txs.length < 2) return;
    const freq = inferFrequency(txs.map((t) => t.date));
    if (!freq) return;
    const amounts = txs.map((t) => Math.abs(t.amount)).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];
    const last = txs.map((t) => t.date).sort().at(-1);
    items.push({
      merchant: txs[0].merchant,
      amount: median,
      monthlyAmount: median * freq.perMonth,
      currency: 'USD',
      frequency: freq.label,
      category: txs[0].category,
      lastSeen: last,
      type,
      occurrences: txs.length,
    });
  };

  // Income: group positive amounts by merchant.
  const incomeGroups = {};
  for (const t of transactions) {
    if ((t.amount ?? 0) <= 0) continue;
    (incomeGroups[t.merchant] ??= []).push(t);
  }
  for (const txs of Object.values(incomeGroups)) {
    // Split merchant groups with mixed magnitudes (e.g. weekly paycheck vs
    // mid-month commission from the same payroll provider).
    const base = txs.filter((t) => t.amount <= Math.min(...txs.map((x) => x.amount)) * 1.3);
    const rest = txs.filter((t) => !base.includes(t));
    addGroup(base, 'income');
    if (rest.length >= 2) addGroup(rest.map((t) => ({ ...t, merchant: `${t.merchant} (additional)` })), 'income');
  }

  // Bills: spending in bill-like categories, grouped by merchant.
  const billGroups = {};
  for (const t of transactions) {
    if ((t.amount ?? 0) >= 0 || !BILL_CATEGORIES.test(t.category ?? '')) continue;
    (billGroups[t.merchant] ??= []).push(t);
  }
  Object.values(billGroups).forEach((txs) => addGroup(txs, 'bill'));

  // Subscriptions: same merchant + identical amount on a regular cadence.
  // Exclude transfers (Venmo/Zelle/Apple Pay top-ups) and shopping/grocery
  // merchants where repeated amounts are coincidence, not a subscription.
  const NOT_SUBSCRIPTION = /transfer|shopping|groceries|cash, checks/i;
  const subGroups = {};
  for (const t of transactions) {
    if ((t.amount ?? 0) >= 0) continue;
    if (BILL_CATEGORIES.test(t.category ?? '') || NOT_SUBSCRIPTION.test(t.category ?? '')) continue;
    const amt = Math.abs(t.amount);
    if (SUB_CATEGORIES.test(t.category ?? '') || amt <= 100) {
      (subGroups[`${t.merchant}|${amt.toFixed(2)}`] ??= []).push(t);
    }
  }
  for (const txs of Object.values(subGroups)) {
    if (txs.length < 3) continue; // identical amount 3+ times = subscription
    addGroup(txs, 'subscription');
  }

  const sum = (type) => items.filter((i) => i.type === type).reduce((s, i) => s + i.monthlyAmount, 0);
  return {
    items: items.sort((a, b) => b.monthlyAmount - a.monthlyAmount),
    totals: { subscriptions: sum('subscription'), bills: sum('bill'), income: sum('income') },
  };
}
