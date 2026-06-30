// api/status.js — Polling do estado da instância

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  const instanceName = req.query.instance || req.body?.instanceName || 'autosell';
  const BASE = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
  const KEY = process.env.EVOLUTION_API_KEY;

  if (!BASE || !KEY) {
    return res.status(500).json({ error: 'Evolution API não configurada.' });
  }

  const headers = { 'apikey': KEY };

  try {
    const r = await fetch(`${BASE}/instance/connectionState/${instanceName}`, { headers });

    if (!r.ok) {
      if (r.status === 404) return res.json({ status: 'not_found' });
      return res.status(r.status).json({ error: 'Erro ao buscar estado' });
    }

    const data = await r.json();
    const state = data?.instance?.state || data?.state || 'unknown';

    if (state === 'open') {
      return res.json({ status: 'connected' });
    }

    if (state === 'connecting' || state === 'qrcode') {
      // Tenta refrescar o QR
      const qrRes = await fetch(`${BASE}/instance/connect/${instanceName}`, { headers });
      if (qrRes.ok) {
        const qrData = await qrRes.json();
        if (qrData?.base64) {
          return res.json({ status: 'qrcode', qrcode: qrData.base64 });
        }
      }
    }

    return res.json({ status: state });
  } catch (err) {
    console.error('[status] exception:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
