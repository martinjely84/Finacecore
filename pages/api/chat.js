import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are FinanceCore AI, a personal financial advisor for the family of Martin and Joanne.
You have access to their financial data and provide clear, actionable advice.
Be concise, warm, and professional — like a trusted private wealth advisor.
Format numbers as currency. Avoid jargon. When discussing investments, always note that past performance doesn't guarantee future results.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { messages, context } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'messages required' });

  const systemWithContext = context
    ? `${SYSTEM}\n\nCurrent financial snapshot:\n${JSON.stringify(context, null, 2)}`
    : SYSTEM;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemWithContext,
      messages,
    });

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
