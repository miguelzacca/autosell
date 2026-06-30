// api/send.js — Envia 1 mensagem via Evolution API com typing indicator + delay

import axios from 'axios';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apikey');
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { instanceName, number, message } = req.body || {};

  if (!number || !message) {
    return res.status(400).json({ error: 'number e message são obrigatórios.' });
  }

  const name = instanceName || 'autosell';
  const BASE = (process.env.EVOLUTION_API_URL || '').replace(/[\r\n"']/g, '').trim().replace(/\/$/, '');
  const KEY = (process.env.EVOLUTION_API_KEY || '').replace(/[\r\n"']/g, '').trim();

  if (!BASE || !KEY) return res.status(500).json({ error: 'Evolution API não configurada.' });

  const headers = { 'Content-Type': 'application/json', 'apikey': KEY };

  let cleanNumber = String(number).replace(/\D/g, '');
  if (cleanNumber.length === 10 || cleanNumber.length === 11) {
    cleanNumber = '55' + cleanNumber;
  }
  
  const typingDelay = Math.min(8000, Math.max(1500, Math.floor(message.length / 40 * 1000)));

  try {
    const r = await axios.post(`${BASE}/message/sendText/${name}`, {
      number: cleanNumber,
      text: message
    }, {
      headers,
      validateStatus: () => true, // resolve promise for all status codes
    });

    if (r.status >= 400) {
      const errBody = r.data;
      console.error('[send] Evolution error:', JSON.stringify(errBody, null, 2));
      return res.status(r.status).json({
        success: false,
        error: errBody?.message || errBody?.error || 'Erro ao enviar mensagem',
        details: errBody,
      });
    }

    const data = r.data;
    return res.json({
      success: true,
      messageId: data?.key?.id || data?.id,
      number: cleanNumber,
    });
  } catch (err) {
    console.error('[send]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
