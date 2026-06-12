import { getTransactions } from '../../lib/era';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    // Fetch the full year-to-date so monthly tabs have data back to January.
    const yearStart = `${new Date().getFullYear()}-01-01`;
    const transactions = await getTransactions({ pageSize: 100, maxPages: 5, fromDate: yearStart });
    res.json({ transactions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
