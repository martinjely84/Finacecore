import { getTransactions } from '../../lib/era';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { user = 'martin', limit = '50' } = req.query;
  try {
    const transactions = await getTransactions(user, { limit: Number(limit) });
    res.json({ transactions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
