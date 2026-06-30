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

  const NVIDIA_KEY = process.env.NVIDIA_API_KEY;
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

  const systemPrompt = `Você é um Master Copywriter, Especialista em Vendas e Psicologia do Consumidor focado em conversão via WhatsApp.
Sua tarefa é REESCREVER e APRIMORAR a mensagem original de forma única para cada contato, aplicando técnicas avançadas de persuasão e comunicação profissional, seguindo estas diretrizes:
1. Comunicação Persuasiva: Transforme a mensagem em um texto irresistível, focando nos benefícios e desejos profundos do cliente.
2. Psicologia de Vendas: Utilize gatilhos mentais sutis (como curiosidade, exclusividade ou urgência) para gerar resposta imediata.
3. Tom Profissional e Humano: A mensagem deve soar como um consultor de alto nível escrevendo de forma exclusiva, natural e empática (1 pra 1). Jamais pareça um robô ou um vendedor invasivo.
4. Clareza e Retenção: Use frases curtas, dinâmicas e ritmo envolvente que prenda a atenção do início ao fim.
5. Fidelidade aos Dados: Preserve rigorosamente a intenção original, os fatos, nomes próprios e informações essenciais da mensagem. Não invente ofertas que não existem.
6. Emojis Estratégicos: Mantenha ou adicione emojis com propósito, para humanizar e destacar pontos-chave, sem poluição visual.
7. Call to Action (CTA): Certifique-se de que a mensagem termina com um convite à ação claro, natural e sem atrito.
8. Regra de Ouro: Responda APENAS com a mensagem final reescrita. SEM introduções, SEM explicações, SEM aspas e SEM prefixos.`;

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
