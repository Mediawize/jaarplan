function extractJsonFromText(text) {
  if (!text) throw new Error('Leeg AI-antwoord ontvangen');

  const cleaned = String(text).replace(/```json|```/gi, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Geen JSON gevonden in AI-antwoord');
    return JSON.parse(match[0]);
  }
}

async function chatJson({ system, user, prompt, systemPrompt, maxTokens = 3000, temperature = 0.2, model }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY niet ingesteld');
  }

  const usedModel = model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const finalSystem = systemPrompt || system || '';
  const finalUser = prompt || user || '';

  const messages = [];
  if (finalSystem) messages.push({ role: 'system', content: finalSystem });
  messages.push({ role: 'user', content: finalUser });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: usedModel,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`OpenAI fout ${response.status}: ${JSON.stringify(data)}`);
  }

  const content = data?.choices?.[0]?.message?.content;
  return extractJsonFromText(Array.isArray(content) ? content.map(x => x?.text || '').join('') : content);
}

module.exports = {
  chatJson,
  extractJsonFromText,
};
