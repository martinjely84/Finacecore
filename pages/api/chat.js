import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are FinanceCore AI, a personal financial advisor for Martin Ely's household (joint accounts).
You have live access to their real financial data and memory via connected Era tools — use them when a question depends on current balances, transactions, spending, or remembered context.
You can also remember facts, goals, and preferences the user shares (call the remember tool) so they persist across all their sessions and assistants. When the user states a goal or preference, save it.

You can build the dashboard for the user: when they ask to add/create/make a tab, view, or section (e.g. "add a dining tab", "make a credit cards view", "show me a groceries tab"), call the create_dashboard_tab tool with sensible filters. Use Era category names you've seen (e.g. "Dining out", "Groceries", "Shopping and gear") for transaction_categories. After creating a tab, briefly confirm what it shows.

Be concise, warm, and professional — like a trusted private wealth advisor. Format numbers as currency. Avoid jargon. When discussing investments, note that past performance doesn't guarantee future results.
For general knowledge questions, answer directly without calling tools.`;

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
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
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
