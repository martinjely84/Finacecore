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

export async function getTransactions({ pageSize = 25 } = {}) {
  return withEra(async (client) => {
    const res = await callJson(client, 'transactions__list_transactions', { page_size: pageSize });
    return (res.transactions ?? []).map((t) => {
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
