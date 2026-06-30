// api/disconnect.js — Logout + delete da instância

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { instanceName } = req.body || {};
  const name = instanceName || 'autosell';

  const BASE = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
  const KEY = process.env.EVOLUTION_API_KEY;

  if (!BASE || !KEY) return res.status(500).json({ error: 'Evolution API não configurada.' });

  const headers = { 'Content-Type': 'application/json', 'apikey': KEY };

  try {
    // 1. Logout
    await fetch(`${BASE}/instance/logout/${name}`, { method: 'DELETE', headers }).catch(() => {});

    // 2. Delete
    await fetch(`${BASE}/instance/delete/${name}`, { method: 'DELETE', headers }).catch(() => {});

    return res.json({ success: true, message: 'Instância desconectada e deletada.' });
  } catch (err) {
    console.error('[disconnect]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
