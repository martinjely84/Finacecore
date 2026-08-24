import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/* ── System prompt ───────────────────────────────── */
function buildSystem({ domains, folders, items, sessions }) {
  // Build a readable map of the current dashboard state
  const domainTree = (domains || []).map((d) => {
    const dFolders = (folders || []).filter((f) => f.domain_id === d.id && !f.parent_folder_id && !f.name.startsWith('__person__'))
    const folderLines = dFolders.map((f) => {
      const goals = (items || []).filter((i) => i.folder_id === f.id && i.type !== 'action' && !i.done)
      const goalLines = goals.map((g) => `      → ${g.text} [id:${g.id}]`).join('\n')
      return `    📁 ${f.name} [id:${f.id}]\n${goalLines}`
    }).join('\n')
    const openGoals = (items || []).filter((i) => {
      const fol = (folders || []).find((f) => f.id === i.folder_id)
      return fol?.domain_id === d.id && i.type !== 'action' && !i.done
    }).length
    const openActions = (items || []).filter((i) => {
      const fol = (folders || []).find((f) => f.id === i.folder_id)
      return fol?.domain_id === d.id && i.type === 'action' && !i.done
    }).length
    return `### ${d.emoji} ${d.name} [id:${d.id}] — score ${d.score}/10 — ${openGoals} goals, ${openActions} actions\n${folderLines}`
  }).join('\n\n')

  const sessBlock = (sessions || []).map((s) => `- ${s.title} (${s.date})`).join('\n')

  return `You are Martin's Chief of Staff and life coach — a sharp, direct AI executive assistant embedded in his life dashboard.

## Martin's profile
- Martin Ross, Trophy Club, TX (British expat)
- BAE Systems F-35 programme manager — quality, delivery
- Wife and daughter Elsie (dyslexia/ARD, attends Novus Academy). Dogs: Buck and Barry.
- Entrepreneur: PayCore SaaS, Exit Britain emigration app, trading strategy, UK property → DFW
- Goals: body recomposition, business launches, eventual move back from US (or not)

## Specialist bots
- **FinanceCore**: live household finance data → https://financecore-umber.vercel.app
- **PT Coach**: fitness programming (coming soon)

## Martin's recent Claude Code sessions (file if asked)
${sessBlock || '(none)'}

## Live dashboard state
${domainTree}

## Your capabilities
You can directly modify this dashboard using tools. Use them proactively:
- "add X" / "file X" / "create a goal for X" → pick the right tool
- "organise my sessions" → use add_folder + add_goal for each session
- "add a habit" → add_habit
- "remind me to X" → add_todo
- When asked to organise sessions: iterate through ALL of them, creating folders if needed

After each tool call, briefly confirm what you did. Don't summarise the whole plan upfront — just do it.

## Style
- Lead with action, not explanation
- Short bullets over paragraphs
- Max 3 priorities when asked to prioritise
- Route finance questions to FinanceCore with its URL
- Life coaching: draw connections across domains, spot bottlenecks, call out what's being avoided`
}

/* ── Tools ───────────────────────────────────────── */
const TOOLS = [
  {
    name: 'add_domain',
    description: 'Create a new life domain on the dashboard.',
    input_schema: {
      type: 'object',
      properties: {
        name:  { type: 'string', description: 'Domain name, e.g. "Side Projects"' },
        emoji: { type: 'string', description: 'Single emoji' },
        color: { type: 'string', description: 'Hex colour, e.g. "#a78bfa"' },
      },
      required: ['name'],
    },
  },
  {
    name: 'add_folder',
    description: 'Add a folder/section inside a domain (or nested inside another folder).',
    input_schema: {
      type: 'object',
      properties: {
        domain_id:        { type: 'string', description: 'Domain id from the dashboard state' },
        parent_folder_id: { type: 'string', description: 'Parent folder id (omit for top-level)' },
        name:             { type: 'string', description: 'Folder name' },
      },
      required: ['domain_id', 'name'],
    },
  },
  {
    name: 'add_goal',
    description: 'Add a goal inside a specific folder.',
    input_schema: {
      type: 'object',
      properties: {
        folder_id: { type: 'string', description: 'The folder id to add the goal to' },
        text:      { type: 'string', description: 'Goal text' },
        type:      { type: 'string', enum: ['goal', 'note', 'link'], description: 'Item type (default: goal)' },
      },
      required: ['folder_id', 'text'],
    },
  },
  {
    name: 'add_action',
    description: 'Add an action/task under an existing goal.',
    input_schema: {
      type: 'object',
      properties: {
        goal_id: { type: 'string', description: 'The parent goal id' },
        text:    { type: 'string', description: 'Action text' },
      },
      required: ['goal_id', 'text'],
    },
  },
  {
    name: 'add_todo',
    description: 'Add an item to the global to-do list.',
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
      },
      required: ['text'],
    },
  },
  {
    name: 'add_habit',
    description: 'Add a new habit to track.',
    input_schema: {
      type: 'object',
      properties: {
        text:    { type: 'string', description: 'Habit description' },
        cadence: { type: 'string', enum: ['daily', 'weekly', 'monthly'], description: 'How often (default: daily)' },
      },
      required: ['text'],
    },
  },
]

/* ── Handler ─────────────────────────────────────── */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { messages, domains, folders, items, sessions } = req.body
  if (!messages?.length) return res.status(400).json({ error: 'messages required' })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const convo = messages.map((m) => ({ role: m.role, content: m.content }))

  try {
    for (let turn = 0; turn < 8; turn++) {
      const stream = client.messages.stream({
        model: 'claude-sonnet-5',
        max_tokens: 2048,
        system: buildSystem({ domains, folders, items, sessions }),
        messages: convo,
        tools: TOOLS,
      })

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
          res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`)
        }
      }

      const final = await stream.finalMessage()
      const calls = final.content.filter((b) => b.type === 'tool_use')

      if (final.stop_reason !== 'tool_use' || !calls.length) break

      const toolResults = []
      for (const call of calls) {
        res.write(`data: ${JSON.stringify({ action: { id: call.id, name: call.name, input: call.input } })}\n\n`)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: `Action "${call.name}" executed on the dashboard.`,
        })
      }

      // Strip empty thinking blocks — claude-sonnet-5 emits them and they
      // cause a 400 on the next turn if the thinking field is absent/empty.
      const safeContent = final.content.filter(
        (b) => b.type !== 'thinking' || (b.thinking && b.thinking.length > 0)
      )
      convo.push({ role: 'assistant', content: safeContent })
      convo.push({ role: 'user', content: toolResults })
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('[life-ceo]', err)
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
    res.end()
  }
}
