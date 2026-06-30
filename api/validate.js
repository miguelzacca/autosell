// api/validate.js — Valida lista de números via Evolution /chat/whatsappNumbers
// Filtra números inválidos ou inexistentes no WhatsApp antes do disparo

import axios from 'axios';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { instanceName, numbers } = req.body || {};
  if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({ error: 'Lista de números inválida.' });
  }

  const name = instanceName || 'autosell';
  const BASE = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
  const KEY = process.env.EVOLUTION_API_KEY;

  if (!BASE || !KEY) return res.status(500).json({ error: 'Evolution API não configurada.' });

  const headers = { 'Content-Type': 'application/json', 'apikey': KEY };

  try {
    // Adiciona o DDI 55 se o número tiver 10 ou 11 dígitos (formato BR sem DDI)
    const formattedNumbers = numbers.map(n => {
      let clean = String(n).replace(/\D/g, '');
      if (clean.length === 10 || clean.length === 11) return '55' + clean;
      return clean;
    });

    // Evolution API aceita até 50 números por vez
    const BATCH_SIZE = 50;
    const valid = [];
    const invalid = [];

    for (let i = 0; i < formattedNumbers.length; i += BATCH_SIZE) {
      const batch = formattedNumbers.slice(i, i + BATCH_SIZE);

      try {
        const r = await axios.post(`${BASE}/chat/whatsappNumbers/${name}`, {
          numbers: batch
        }, {
          headers,
          validateStatus: () => true,
        });

        if (r.status >= 400) {
          // Se API retornar erro, assume todos como válidos (não bloqueia o disparo)
          batch.forEach(n => valid.push({ number: n, jid: n + '@s.whatsapp.net', valid: true }));
          continue;
        }

        const data = r.data;
        // Resposta: array de { number, jid, exists }
        if (Array.isArray(data)) {
          data.forEach(item => {
            if (item.exists || item.jid) {
              valid.push({ number: item.number || item.query, jid: item.jid, valid: true });
            } else {
              invalid.push({ number: item.number || item.query, reason: 'Não tem WhatsApp' });
            }
          });
        } else {
          // Formato diferente — assume todos válidos
          batch.forEach(n => valid.push({ number: n, jid: n + '@s.whatsapp.net', valid: true }));
        }
      } catch (batchErr) {
        console.error('[validate] batch error:', batchErr.message);
        batch.forEach(n => valid.push({ number: n, jid: n + '@s.whatsapp.net', valid: true }));
      }
    }

    return res.json({ valid, invalid, total: numbers.length, validCount: valid.length, invalidCount: invalid.length });
  } catch (err) {
    console.error('[validate]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
