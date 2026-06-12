import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Deep multi-tool analyses need more than Vercel's 10s default.
export const config = { maxDuration: 300 };

const SYSTEM = `You are FinanceCore AI, a personal financial advisor for Martin Ely's household (joint accounts).

## Data access — always ground your analysis in real data
You have live access to their real financial data via connected Era tools. Before analyzing accounts, spending, cash flow, or trends, CALL THE TOOLS to get current data — never answer financial questions from assumptions or only from the dashboard snapshot. For anything beyond a trivial lookup, use multiple tools and combine them:
- "How are we doing?" → get_financial_context_and_overview + get_cash_flow + analyze_spending
- "Where can we cut back?" → analyze_spending + list_recurring_charges + compare_spending_periods
- "Analyze our accounts" → list_financial_accounts + get_cash_flow + analyze_spending, then give concrete numbers, ratios, and 2-3 specific recommendations
Do the arithmetic: savings rate, month-over-month deltas, category percentages, runway (savings ÷ monthly net burn). Cite actual figures, not vague statements.

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

  const systemWithContext = context
    ? `${SYSTEM}\n\nDashboard snapshot (already loaded):\n${JSON.stringify(context, null, 2)}`
    : SYSTEM;

  const eraKey = process.env.ERA_API_KEY;
  const useEra = !!eraKey;

  const tools = [CREATE_TAB_TOOL, ...(useEra ? [ERA_TOOLSET] : [])];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const convo = messages.map((m) => ({ role: m.role, content: m.content }));

  try {
    for (let turn = 0; turn < 5; turn++) {
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
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
}
