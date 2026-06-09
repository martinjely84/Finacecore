import { getRecurring } from '../../lib/era';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const data = await getRecurring();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
