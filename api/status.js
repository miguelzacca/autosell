// api/status.js — Polling do estado da instância

import axios from 'axios';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  const instanceName = req.query.instance || req.body?.instanceName || 'autosell';
  const BASE = (process.env.EVOLUTION_API_URL || '').replace(/[\r\n"']/g, '').replace(/\/$/, '');
  const KEY = (process.env.EVOLUTION_API_KEY || '').replace(/[\r\n"']/g, '');

  if (!BASE || !KEY) {
    return res.status(500).json({ error: 'Evolution API não configurada.' });
  }

  const headers = { 'apikey': KEY };

  try {
    const r = await axios.get(`${BASE}/instance/connectionState/${instanceName}`, { 
      headers,
      validateStatus: () => true 
    });

    if (r.status >= 400) {
      if (r.status === 404) return res.json({ status: 'not_found' });
      return res.status(r.status).json({ error: 'Erro ao buscar estado' });
    }

    const data = r.data;
    const state = data?.instance?.state || data?.state || 'unknown';

    if (state === 'open') {
      return res.json({ status: 'connected' });
    }

    if (state === 'connecting' || state === 'qrcode') {
      // Tenta refrescar o QR
      const qrRes = await axios.get(`${BASE}/instance/connect/${instanceName}`, { 
        headers,
        validateStatus: () => true 
      });
      
      if (qrRes.status < 400) {
        const qrData = qrRes.data;
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
