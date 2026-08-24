import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/* ── Helpers ─────────────────────────────────────── */
function countAll(node) {
  return (node.chats || []).length +
    (node.sections || []).reduce((s, c) => s + countAll(c), 0);
}

function nodeAt(area, path = []) {
  let n = area;
  for (const id of path) {
    n = (n.sections || []).find(s => s.id === id);
    if (!n) return null;
  }
  return n;
}

/* ── System prompt ───────────────────────────────── */
function buildSystem(areas) {
  const BOTS = [
    { name: 'FinanceCore', domain: 'Household finances, Bank of America accounts, spending, live transaction data', url: 'https://financecore-umber.vercel.app' },
    { name: 'PT Coach', domain: 'Body recomposition, workout programming, nutrition', url: null },
  ];

  const botsBlock = BOTS.map(b =>
    `• **${b.name}** — ${b.domain}\n  ${b.url ? `→ ${b.url}` : '(coming soon)'}`
  ).join('\n\n');

  const areasBlock = (areas || []).map(a => {
    function secTree(node, depth = 0) {
      const pad = '  '.repeat(depth + 1);
      const chats = (node.chats || []).map(c =>
        `${pad}  💬 "${c.title}"${c.url ? ` — ${c.url}` : ''}`
      ).join('\n');
      const subs = (node.sections || []).map(s =>
        `${pad}[${s.id}] ${s.label} (${countAll(s)} items)\n${secTree(s, depth + 1)}`
      ).join('\n');
      return [subs, chats].filter(Boolean).join('\n');
    }
    return `### ${a.emoji} ${a.label} [id: ${a.id}] — ${countAll(a)} items\n${secTree(a)}`;
  }).join('\n\n');

  return `You are Martin's personal Chief of Staff — a sharp, direct AI executive assistant and dashboard manager.

## Martin's profile
- Martin Ross, Fort Worth TX
- Programme manager at BAE Systems on the F-35 programme
- British expat. Family: wife, daughter Elsie (ARD, attends Novus Academy), dogs Buck and Barry
- Entrepreneur with multiple active projects: PayCore SaaS, Exit Britain emigration app, trading strategy, UK property → DFW investment
- Goals: body recomposition, business launches, eventual emigration

## Your specialist bots
When a question is squarely in a specialist domain, briefly answer then route:

${botsBlock}

## Martin's live dashboard
${areasBlock}

## Dashboard management
You have tools to directly modify the dashboard. Use them proactively when Martin says:
- "add [thing] to [area/section]" → add_chat or add_section
- "create an area for X" → create_life_area
- "move X to Y" → move_chat
- "organise / set up X" → create appropriate sections then add chats
- "file this" with a URL → add_chat to the most logical area

After using a tool, confirm in one sentence what you did. Then ask if anything else needs filing.

## Tone and style
- Lead with the answer. No preamble.
- Bullet points over walls of text.
- When routing to a specialist: one sentence why → URL on its own line.
- "What should I focus on?" → 3-item priority list, max.
- You see the whole picture — connect dots across life areas when it adds value.
- Never make up financial figures. Route to FinanceCore for live data.`;
}

/* ── Tool definitions ────────────────────────────── */
const TOOLS = [
  {
    name: 'create_life_area',
    description: 'Create a brand new life area on the dashboard.',
    input_schema: {
      type: 'object',
      properties: {
        emoji:  { type: 'string', description: 'Single emoji' },
        label:  { type: 'string', description: 'Area name' },
        color:  { type: 'string', description: 'One of: teal, purple, blue, amber, coral, green, pink, orange, indigo, cyan, lime, rose' },
      },
      required: ['emoji', 'label', 'color'],
    },
  },
  {
    name: 'add_section',
    description: 'Add a section (or sub-section) inside a life area.',
    input_schema: {
      type: 'object',
      properties: {
        area_id:     { type: 'string', description: 'The life area ID (e.g. "finance", "tech")' },
        parent_path: { type: 'array', items: { type: 'string' }, description: 'Array of section IDs leading to the parent; empty [] for top-level of the area' },
        label:       { type: 'string', description: 'Section name' },
      },
      required: ['area_id', 'label'],
    },
  },
  {
    name: 'add_chat',
    description: 'Add a chat, link, or resource to a life area or section.',
    input_schema: {
      type: 'object',
      properties: {
        area_id:      { type: 'string', description: 'The life area ID' },
        section_path: { type: 'array', items: { type: 'string' }, description: 'Array of section IDs (empty [] for area root)' },
        title:        { type: 'string', description: 'Title of the chat or link' },
        url:          { type: 'string', description: 'URL (optional)' },
        desc:         { type: 'string', description: 'Short description (optional)' },
      },
      required: ['area_id', 'title'],
    },
  },
  {
    name: 'move_chat',
    description: 'Move a chat from wherever it currently lives to a new area/section.',
    input_schema: {
      type: 'object',
      properties: {
        chat_title:      { type: 'string', description: 'Exact or partial title of the chat to find' },
        to_area_id:      { type: 'string', description: 'Destination area ID' },
        to_section_path: { type: 'array', items: { type: 'string' }, description: 'Destination section path (empty [] for area root)' },
      },
      required: ['chat_title', 'to_area_id'],
    },
  },
  {
    name: 'add_to_inbox',
    description: 'Add a chat or link to the pending inbox (unorganised, to be filed later).',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        url:   { type: 'string' },
        desc:  { type: 'string' },
      },
      required: ['title'],
    },
  },
];

/* ── Handler ─────────────────────────────────────── */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { messages, areas } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'messages required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const convo = messages.map(m => ({ role: m.role, content: m.content }));

  try {
    for (let turn = 0; turn < 6; turn++) {
      const stream = client.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: buildSystem(areas),
        messages: convo,
        tools: TOOLS,
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
          res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
        }
      }

      const final = await stream.finalMessage();

      // Find dashboard tool calls
      const calls = final.content.filter(b => b.type === 'tool_use');

      if (final.stop_reason !== 'tool_use' || !calls.length) break;

      // Stream each tool action to the client to execute
      const toolResults = [];
      for (const call of calls) {
        res.write(`data: ${JSON.stringify({ action: { id: call.id, name: call.name, input: call.input } })}\n\n`);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: `Action "${call.name}" sent to dashboard for execution.`,
        });
      }

      convo.push({ role: 'assistant', content: final.content });
      convo.push({ role: 'user', content: toolResults });
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('[ceo-chat]', err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
}
