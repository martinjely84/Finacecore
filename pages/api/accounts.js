import { getAccounts, getNetWorth, getSpendingByCategory } from '../../lib/era';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { user = 'martin' } = req.query;
  try {
    const [accounts, netWorth, spending] = await Promise.all([
      getAccounts(user),
      getNetWorth(user),
      getSpendingByCategory(user),
    ]);
    res.json({ accounts, netWorth, spending });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
