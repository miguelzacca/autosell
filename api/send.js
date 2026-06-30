// api/send.js — Envia 1 mensagem via Evolution API com typing indicator + delay

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { instanceName, number, message } = req.body || {};

  if (!number || !message) {
    return res.status(400).json({ error: 'number e message são obrigatórios.' });
  }

  const name = instanceName || 'autosell';
  const BASE = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
  const KEY = process.env.EVOLUTION_API_KEY;

  if (!BASE || !KEY) return res.status(500).json({ error: 'Evolution API não configurada.' });

  const headers = { 'Content-Type': 'application/json', 'apikey': KEY };

  // Normaliza o número: remove tudo que não é dígito
  const cleanNumber = String(number).replace(/\D/g, '');

  // Calcula delay de "digitação" proporcional ao tamanho da msg (simula humano digitando)
  // ~40 chars/seg de digitação humana média, entre 1.5s e 8s
  const typingDelay = Math.min(8000, Math.max(1500, Math.floor(message.length / 40 * 1000)));

  try {
    const r = await fetch(`${BASE}/message/sendText/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        number: cleanNumber,
        text: message,
        options: {
          delay: typingDelay,       // Milliseconds of "composing" before sending
          presence: 'composing',    // Shows "digitando..." no WA
        },
      }),
    });

    if (!r.ok) {
      const errBody = await r.json().catch(() => ({ message: r.statusText }));
      console.error('[send] Evolution error:', errBody);
      return res.status(r.status).json({
        success: false,
        error: errBody?.message || errBody?.error || 'Erro ao enviar mensagem',
        details: errBody,
      });
    }

    const data = await r.json();
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
