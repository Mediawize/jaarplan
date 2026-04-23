const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function extractJsonFromText(text) {
  if (!text) throw new Error('Leeg AI-antwoord ontvangen');
  const cleaned = String(text).replace(/```json|```/gi, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Geen JSON gevonden in AI-antwoord');
  return JSON.parse(match[0]);
}

async function chatJson({ system, user, maxTokens = 3000, temperature = 0.2 }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY niet ingesteld');
  }

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.APP_URL || 'http://localhost:3001',
      'X-Title': 'JaarPlan'
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: user }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter fout ${response.status}: ${body}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  return extractJsonFromText(Array.isArray(content) ? content.map(x => x?.text || '').join('') : content);
}

module.exports = {
  chatJson,
  extractJsonFromText,
  DEFAULT_MODEL,
};
