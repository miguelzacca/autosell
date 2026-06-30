// api/connect.js — Cria/reconecta instância Evolution, retorna QR ou status connected

import axios from 'axios';

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { instanceName } = req.body || {};
  const name = instanceName || 'autosell';

  const BASE = (process.env.EVOLUTION_API_URL || '').replace(/[\r\n"']/g, '').replace(/\/$/, '');
  const KEY = (process.env.EVOLUTION_API_KEY || '').replace(/[\r\n"']/g, '');

  if (!BASE || !KEY) {
    return res.status(500).json({ error: 'Evolution API não configurada no servidor.' });
  }

  const headers = {
    'Content-Type': 'application/json',
    'apikey': KEY,
  };

  try {
    // 1. Verifica se instância já existe e qual o estado
    const stateRes = await axios.get(`${BASE}/instance/connectionState/${name}`, { headers, validateStatus: () => true });

    if (stateRes.status < 400) {
      const stateData = stateRes.data;
      const state = stateData?.instance?.state || stateData?.state;

      if (state === 'open') {
        return res.status(200).json({ status: 'connected' });
      }

      // Já existe mas não está conectada — tenta buscar QR
      const connectRes = await axios.get(`${BASE}/instance/connect/${name}`, { headers, validateStatus: () => true });
      if (connectRes.status < 400) {
        const connectData = connectRes.data;
        if (connectData?.base64) {
          return res.status(200).json({ status: 'qrcode', qrcode: connectData.base64 });
        }
        if (connectData?.code) {
          // Alguns retornam o código do QR em vez do base64
          return res.status(200).json({ status: 'qrcode', code: connectData.code });
        }
      }
      return res.status(200).json({ status: state || 'connecting' });
    }

    // 2. Instância não existe — criar
    const createRes = await axios.post(`${BASE}/instance/create`, {
      instanceName: name,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
      reject_call: true,
    }, {
      headers,
      validateStatus: () => true,
    });

    if (createRes.status >= 400) {
      const err = JSON.stringify(createRes.data);
      console.error('[connect] create error:', err);
      return res.status(500).json({ error: 'Erro ao criar instância: ' + err });
    }

    const createData = createRes.data;

    // Pode retornar o QR direto na criação
    const qrBase64 = createData?.qrcode?.base64 || createData?.base64;
    if (qrBase64) {
      return res.status(200).json({ status: 'qrcode', qrcode: qrBase64 });
    }

    // Se não veio QR, faz connect explícito
    const connectRes2 = await axios.get(`${BASE}/instance/connect/${name}`, { headers, validateStatus: () => true });
    if (connectRes2.status < 400) {
      const connectData2 = connectRes2.data;
      if (connectData2?.base64) {
        return res.status(200).json({ status: 'qrcode', qrcode: connectData2.base64 });
      }
    }

    return res.status(200).json({ status: 'connecting' });
  } catch (err) {
    console.error('[connect] exception:', err.message);
    return res.status(500).json({ error: 'Falha de conexão (' + BASE + '): ' + err.message });
  }
}
