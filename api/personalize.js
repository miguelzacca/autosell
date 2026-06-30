// api/personalize.js — IA personaliza 1 mensagem por contato (NVIDIA / llama-3.1-8b-instruct)

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

  // Substitui variáveis no template antes de passar para a IA
  let preProcessed = template;
  if (contact) {
    preProcessed = preProcessed
      .replace(/\{nome\}/gi, contact.name || contact.nome || '')
      .replace(/\{numero\}/gi, contact.number || contact.numero || '')
      .replace(/\{empresa\}/gi, contact.empresa || contact.company || '')
      .replace(/\{produto\}/gi, contact.produto || contact.product || '');
    // Substitui qualquer outra coluna dinâmica do CSV
    Object.entries(contact).forEach(([key, val]) => {
      preProcessed = preProcessed.replace(new RegExp(`\\{${key}\\}`, 'gi'), val || '');
    });
  }

  const systemPrompt = `Você é um assistente especialista em copywriting de WhatsApp.
Sua tarefa é REESCREVER a mensagem fornecida pelo usuário de forma única e natural, seguindo estas regras:
1. Mantenha EXATAMENTE o mesmo sentido, intenção e tom da mensagem original.
2. Mude as palavras, estrutura das frases e expressões — a mensagem deve soar diferente da original mas ter o mesmo propósito.
3. Se a mensagem tiver emojis, mantenha emojis similares (não necessariamente os mesmos).
4. Preserve qualquer nome próprio que apareça na mensagem.
5. A mensagem deve soar completamente humana e natural, como se fosse escrita manualmente.
6. NÃO adicione nem remova informações essenciais.
7. Responda SOMENTE com a mensagem reescrita, sem explicações, sem aspas, sem prefixo.
8. Mantenha o mesmo comprimento aproximado da mensagem original.`;

  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NVIDIA_KEY}`,
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-8b-instruct',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Reescreva esta mensagem:\n\n${preProcessed}` },
        ],
        temperature: 0.85,
        top_p: 0.9,
        max_tokens: 512,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[personalize] NVIDIA error:', errText);
      // Fallback: retorna o template pré-processado sem personalização
      return res.json({ message: preProcessed, personalized: false });
    }

    const data = await response.json();
    let msg = data?.choices?.[0]?.message?.content || preProcessed;

    // Remove tags de thinking do DeepSeek se houver
    msg = msg.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // Remove aspas do início/fim se a IA colocou
    msg = msg.replace(/^["']|["']$/g, '').trim();

    return res.json({ message: msg, personalized: true });
  } catch (err) {
    console.error('[personalize]', err.message);
    // Fallback gracioso — envia o template pré-processado
    return res.json({ message: preProcessed, personalized: false, fallback: true });
  }
}
