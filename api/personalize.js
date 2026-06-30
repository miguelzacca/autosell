// api/personalize.js — IA personaliza 1 mensagem por contato (NVIDIA / llama-3.1-8b-instruct)

import axios from 'axios';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { template, contact } = req.body || {};

  if (!template) return res.status(400).json({ error: 'Template obrigatório.' });

  const NVIDIA_KEY = (process.env.NVIDIA_API_KEY || '').replace(/[\r\n"']/g, '').trim();
  if (!NVIDIA_KEY) return res.status(500).json({ error: 'NVIDIA_API_KEY não configurada.' });

  let preProcessed = template;
  if (contact) {
    preProcessed = preProcessed
      .replace(/\{nome\}/gi, contact.name || contact.nome || '')
      .replace(/\{numero\}/gi, contact.number || contact.numero || '')
      .replace(/\{empresa\}/gi, contact.empresa || contact.company || '')
      .replace(/\{produto\}/gi, contact.produto || contact.product || '');
    Object.entries(contact).forEach(([key, val]) => {
      preProcessed = preProcessed.replace(new RegExp(`\\{${key}\\}`, 'gi'), val || '');
    });
  }

  const systemPrompt = `Você é um Assistente de Comunicação especializado em reescrever (parafrasear) mensagens de WhatsApp.
O objetivo é tornar cada mensagem única para evitar filtros de spam, mas mantendo EXATAMENTE o mesmo significado, intenção e informações da original.

Diretrizes OBRIGATÓRIAS:
1. Links Intactos (CRÍTICO): NUNCA remova, altere ou esconda nenhum link (ex: https://...). Eles devem obrigatoriamente estar na mensagem final.
2. Fidelidade Absoluta: Apenas reescreva o que foi dito usando sinônimos ou alterando a estrutura da frase. NÃO adicione perguntas novas, NÃO adicione desculpas ("desculpe a interrupção") e NÃO adicione Call to Actions que não estejam no original.
3. Tom Humano e Casual: A mensagem deve soar natural, amigável e direta, como se uma pessoa real estivesse digitando.
4. Proporção: Mantenha o mesmo tamanho aproximado. Se for uma mensagem curta, devolva uma mensagem curta.
5. Regra de Ouro: Retorne APENAS a mensagem reescrita pronta para envio. NUNCA inclua aspas no início/fim, NUNCA inclua introduções ("Aqui está:") e NUNCA explique o que você fez.`;

  try {
    const response = await axios.post('https://integrate.api.nvidia.com/v1/chat/completions', {
      model: 'meta/llama-3.1-8b-instruct',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Reescreva esta mensagem:\n\n${preProcessed}` },
      ],
      temperature: 0.85,
      top_p: 0.9,
      max_tokens: 512,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NVIDIA_KEY}`,
      },
      validateStatus: () => true,
    });

    if (response.status >= 400) {
      const errText = JSON.stringify(response.data);
      console.error('[personalize] NVIDIA error:', errText);
      return res.json({ message: preProcessed, personalized: false });
    }

    const data = response.data;
    let msg = data?.choices?.[0]?.message?.content || preProcessed;

    msg = msg.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    msg = msg.replace(/^["']|["']$/g, '').trim();

    return res.json({ message: msg, personalized: true });
  } catch (err) {
    console.error('[personalize]', err.message);
    return res.json({ message: preProcessed, personalized: false, fallback: true });
  }
}
