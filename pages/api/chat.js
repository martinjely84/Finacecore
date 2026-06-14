import Anthropic from '@anthropic-ai/sdk';
import { getAdvisorSnapshot } from '../../lib/era';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Deep multi-tool analyses need more than Vercel's 10s default.
export const config = { maxDuration: 300 };

const SYSTEM = `You are FinanceCore AI, a personal financial advisor for Martin Ely's household (joint accounts).

## Known household financial facts (memorised — do not re-fetch from Era)
These are verified facts about Martin's finances. Use them in every analysis without needing to look them up:

**Income (all figures are net take-home / post-tax direct deposits):**
- Dominion payroll: ~$1,982.60/week (weekly direct deposit, same account)
- Dominion commission: variable mid-month payment from same employer, average ~$8,485/mo but some months zero — treat as bonus not base income
- BAE Systems paycheck: ~$3,687.51 every two weeks (biweekly)
- Reliable base take-home (no commission): ~$16,760/mo
- With average commission month: ~$25,250/mo

**Fixed monthly bills:**
- Mortgage (Capital / "Mortgage Payment"): $4,658.33/mo from savings → checking
- Planet Fitness: ~$11/mo
- Glo Tanning: ~$7/mo

**Annual lump-sum bills (must be amortised — money needs to be set aside monthly):**
- Property tax (Denton County, TX): $18,724/yr paid January — $1,560/mo set-aside needed
- Home insurance: ~$6,500/yr paid once yearly — $542/mo set-aside needed
- Car insurance: ~$3,250/yr paid once yearly — $271/mo set-aside needed
- IRS / federal tax bill: ~$3,577/yr paid March — $298/mo set-aside needed
- Total annual bill amortised: $2,671/mo that must be reserved, not spent

**The Amex blind spot:**
- Martin's household Amex card is NOT yet linked to Era — its transactions are completely invisible
- The Amex gets paid from checking/savings (visible as "Transfers and card payments")
- Estimated Amex spend: $2,000–$4,000/mo based on payment amounts observed
- This is the most likely reason savings are declining month-on-month — the Amex spending is real but invisible to the dashboard
- Always flag this when discussing spending totals or savings rates

**Why savings may be declining (known suspects, in order of likely impact):**
1. Amex card spend is real cash out but invisible in Era data
2. January 2026: $18,724 property tax + $4,658 mortgage = ~$23,400 in one month
3. March 2026: $3,577 IRS bill on top of normal expenses
4. Commission income is irregular — base income alone ($16,760) barely covers bills + spending
5. No monthly set-aside system yet for annual bills

**Savings goal / budget target:**
- User wants to maximise monthly savings
- Recommended budget: keep total monthly outgo (fixed bills + annual amortised + variable spending) under $12,500
- On base income alone, target $4,000–4,500/mo savings; treat commission as savings
- Establish a $10k checking buffer to prevent overdrafts

## Data access — always ground your analysis in real data
A LIVE FINANCIAL SNAPSHOT is included at the end of this prompt: profile, goals, all account balances, net worth, this-month and last-month income/spending/net, top spending categories, and recurring income/bills/subscriptions. ANSWER FROM THE SNAPSHOT FIRST — it is current as of this request, and most questions (how are we doing, analyze our accounts, where can we cut back) can be answered fully from it.
Only call Era tools for drill-downs the snapshot can't answer: individual transactions (transactions__search_transactions / list_transactions), multi-month history (insights__get_cash_flow, insights__compare_spending_periods), or forecasts. Tool calls are slow (10-30s each) — use at most 2 per response, and never re-fetch what the snapshot already shows.
Do the arithmetic: savings rate, month-over-month deltas, category percentages, runway (savings ÷ monthly net burn). Cite actual figures, not vague statements. When reporting spending, always caveat that Amex card spend is not included.

## Memory
You can remember facts, goals, and preferences (knowledge__remember) — they persist across all the user's sessions and assistants. When the user states a goal or preference, save it. Recall stored context (knowledge__recall_history) when relevant.

## Dashboard building
When the user asks to add/create/make a tab, view, or section, call create_dashboard_tab. Be generous in interpretation — "show me where our money goes on food" means create a tab filtered to Groceries + Dining out. FIRST check real category names via analyze_spending if unsure (Era categories include: "Dining out", "Groceries", "Shopping and gear", "Transfers and card payments", "Entertainment and subscriptions", "Health and fitness", "Taxes and bank fees", "Travel and vacation", "Insurance", "Utilities"). Use date ranges and min_amount when the request implies them ("big purchases this month" → min_amount + from_date). After creating a tab, summarize what it shows with real numbers from the data.

## Style
Warm, professional, direct — a trusted private wealth advisor. Lead with the answer, then the supporting numbers. Format currency properly. Use short bullet lists for breakdowns. Avoid jargon. When discussing investments, note that past performance doesn't guarantee future results. For general knowledge questions, answer directly without calling tools.`;

// Client-side tool: the dashboard executes this (adds a filtered tab).
const CREATE_TAB_TOOL = {
  name: 'create_dashboard_tab',
  description:
    'Create a new tab/view on the user\'s finance dashboard that filters their accounts, spending, and transactions. Call this whenever the user asks to add, create, make, or build a tab, view, or section on the dashboard.',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Short tab label, e.g. "Dining", "Credit Cards", "Groceries".' },
      description: { type: 'string', description: 'One short line describing what this tab shows.' },
      transaction_categories: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional. Era spending category names to filter transactions and the spending chart to (e.g. ["Dining out","Groceries"]).',
      },
      account_types: {
        type: 'array',
        items: { type: 'string', enum: ['checking', 'savings', 'credit', 'investment', 'loan'] },
        description: 'Optional. Account types to show on this tab.',
      },
      search: { type: 'string', description: 'Optional. Only show transactions whose merchant/description contains this text.' },
      from_date: { type: 'string', description: 'Optional. Only show transactions on/after this date (YYYY-MM-DD).' },
      to_date: { type: 'string', description: 'Optional. Only show transactions on/before this date (YYYY-MM-DD).' },
      min_amount: { type: 'number', description: 'Optional. Only show transactions of at least this dollar amount (absolute value), e.g. 100 for "big purchases".' },
      direction: { type: 'string', enum: ['expenses', 'income', 'all'], description: 'Optional. Show only money out (expenses), money in (income), or all. Default all.' },
    },
    required: ['name'],
  },
};

// Era MCP — allowlist only read + memory tools.
const ERA_TOOLSET = {
  type: 'mcp_toolset',
  mcp_server_name: 'era',
  default_config: { enabled: false },
  configs: {
    knowledge__get_financial_context_and_overview: { enabled: true },
    knowledge__recall_history: { enabled: true },
    knowledge__remember: { enabled: true },
    accounts__list_financial_accounts: { enabled: true },
    accounts__check_account_balance: { enabled: true },
    transactions__list_transactions: { enabled: true },
    transactions__search_transactions: { enabled: true },
    transactions__list_recurring_charges: { enabled: true },
    insights__analyze_spending: { enabled: true },
    insights__compare_spending_periods: { enabled: true },
    insights__forecast_spending: { enabled: true },
    insights__get_cash_flow: { enabled: true },
    insights__get_daily_financial_summary: { enabled: true },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { messages, context } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'messages required' });

  const eraKey = process.env.ERA_API_KEY;
  const useEra = !!eraKey;

  // Pre-fetch the live snapshot server-side (parallel, ~2-4s) so the model
  // doesn't spend 30-60s gathering basics through its own tool calls.
  let snapshot = null;
  if (useEra) {
    try {
      snapshot = await Promise.race([
        getAdvisorSnapshot(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('snapshot timeout')), 12000)),
      ]);
    } catch (e) {
      console.error('snapshot prefetch failed:', e.message);
    }
  }

  const systemWithContext =
    SYSTEM +
    (snapshot ? `\n\n## LIVE FINANCIAL SNAPSHOT (current as of this request)\n${JSON.stringify(snapshot)}` : '') +
    (context ? `\n\n## Dashboard UI state\n${JSON.stringify(context)}` : '');

  const tools = [CREATE_TAB_TOOL, ...(useEra ? [ERA_TOOLSET] : [])];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const convo = messages.map((m) => ({ role: m.role, content: m.content }));

  // Heartbeat: Era tool calls can run 20-60s with no output; without bytes on
  // the wire Vercel kills the function and the browser sees a dead stream.
  const heartbeat = setInterval(() => {
    try { res.write(': keepalive\n\n'); } catch {}
  }, 5000);

  try {
    for (let turn = 0; turn < 5; turn++) {
      if (res.writableEnded || res.destroyed) break;
      const stream = client.beta.messages.stream(
        {
          model: 'claude-opus-4-8',
          max_tokens: 4096,
          system: systemWithContext,
          messages: convo,
          tools,
          ...(useEra && {
            mcp_servers: [
              { type: 'url', url: 'https://context.era.app/mcp', name: 'era', authorization_token: eraKey },
            ],
          }),
        },
        { headers: { 'anthropic-beta': 'mcp-client-2025-11-20' } }
      );

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
          res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
        }
      }

      const final = await stream.finalMessage();

      // Handle our client-side tool (create_dashboard_tab). MCP tools run server-side.
      const tabCalls = final.content.filter(
        (b) => b.type === 'tool_use' && b.name === 'create_dashboard_tab'
      );

      // Server-side MCP loop hit its iteration limit — re-send to resume.
      if (final.stop_reason === 'pause_turn') {
        convo.push({ role: 'assistant', content: final.content });
        continue;
      }

      if (final.stop_reason !== 'tool_use' || tabCalls.length === 0) break;

      const toolResults = [];
      for (const call of tabCalls) {
        const tab = {
          id: `tab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: call.input.name,
          description: call.input.description ?? '',
          categories: call.input.transaction_categories ?? [],
          accountTypes: call.input.account_types ?? [],
          search: call.input.search ?? '',
          fromDate: call.input.from_date ?? '',
          toDate: call.input.to_date ?? '',
          minAmount: call.input.min_amount ?? 0,
          direction: call.input.direction ?? 'all',
        };
        res.write(`data: ${JSON.stringify({ tab })}\n\n`);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: `Created the "${tab.name}" tab on the dashboard. It is now visible to the user.`,
        });
      }

      convo.push({ role: 'assistant', content: final.content });
      convo.push({ role: 'user', content: toolResults });
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error(err);
    try {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } catch {}
  } finally {
    clearInterval(heartbeat);
  }
}
