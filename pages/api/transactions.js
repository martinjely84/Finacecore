import { getTransactions } from '../../lib/era';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const transactions = await getTransactions({ pageSize: 25 });
    res.json({ transactions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
