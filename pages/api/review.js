import Anthropic from '@anthropic-ai/sdk';
import { getReviewData } from '../../lib/era';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const config = { maxDuration: 300 };

const REVIEW_PROMPT = `You are FinanceCore AI, the proactive financial advisor for Martin Ely's household (joint accounts).
Using ONLY the live data provided, write a full monthly financial review. Be specific — real numbers, real merchant names. Do the arithmetic carefully (note: "Transfers and card payments" are mostly credit-card payoffs and inter-account transfers, NOT real spending — separate them out so the picture isn't distorted).

Structure the review with exactly these markdown sections:

## 💰 Money In (monthly)
Each income source with amount and cadence, plus a monthly total.

## 💸 Money Out (monthly)
Real spending by category (exclude transfers/card payoffs from the headline, but mention them). Estimated monthly total of true spending.

## 📅 Scheduled & Recurring Payments
Every detected recurring bill and subscription with amount, cadence, last seen.

## 🛒 Groceries & Everyday Living
Groceries, dining out, shopping — monthly amounts and any notable patterns.

## 📊 Bottom Line
Net position: true monthly surplus/deficit, savings rate, runway. Net worth.

## ⚠️ Watch Items
Anything concerning: bounced payments, unusual charges, balance risks, fee waste.

## ✅ This Month's Actions
3 specific, doable recommendations with dollar amounts.

Keep it tight — bullets over prose. No tables (they render poorly). Use **bold** for figures. Do not invent data; if something isn't in the data, say "not yet detected".`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const data = await getReviewData();

    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 3000,
      system: REVIEW_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Here is our live financial data as of ${new Date().toISOString().slice(0, 10)}. Run the full review.\n\n${JSON.stringify(data)}`,
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

    res.json({ review: text, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
