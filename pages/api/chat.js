import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are FinanceCore AI, a personal financial advisor for Martin Ely's household (joint accounts).
You have live access to their real financial data and memory via connected Era tools — use them when a question depends on current balances, transactions, spending, or remembered context.
You can also remember facts, goals, and preferences the user shares (call the remember tool) so they persist across all their sessions and assistants. When the user states a goal or preference, save it.
Be concise, warm, and professional — like a trusted private wealth advisor. Format numbers as currency. Avoid jargon. When discussing investments, note that past performance doesn't guarantee future results.
For general knowledge questions, answer directly without calling tools.`;

// Era MCP — allowlist only read + memory tools (no disconnect/billing/delete/write-to-bank).
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

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = client.beta.messages.stream(
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemWithContext,
        messages,
        ...(useEra && {
          mcp_servers: [
            { type: 'url', url: 'https://context.era.app/mcp', name: 'era', authorization_token: eraKey },
          ],
          tools: [ERA_TOOLSET],
        }),
      },
      { headers: useEra ? { 'anthropic-beta': 'mcp-client-2025-11-20' } : {} }
    );

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error(err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
}
