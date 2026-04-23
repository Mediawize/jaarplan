const DEFAULT_CONTENT_MODEL = process.env.OPENROUTER_MODEL_CONTENT || process.env.OPENROUTER_MODEL || 'google/gemma-3-4b-it:free';
const DEFAULT_SYLLABUS_MODEL = process.env.OPENROUTER_MODEL_SYLLABUS || 'openrouter/free';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function extractJsonFromText(text) {
  if (!text) throw new Error('Leeg AI-antwoord ontvangen');
  const cleaned = String(text).replace(/```json|```/gi, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Geen JSON gevonden in AI-antwoord');
  return JSON.parse(match[0]);
}

function contentToText(content) {
  if (Array.isArray(content)) {
    return content.map(x => x?.text || x?.content || '').join('').trim();
  }
  return String(content || '').trim();
}

async function callOpenRouter({ model, fullPrompt, maxTokens, temperature }) {
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
      model,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'user', content: fullPrompt }
      ]
    })
  });

  const rawBody = await response.text();
  let data = null;
  try {
    data = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(`OpenRouter fout ${response.status}: ${rawBody}`);
  }

  const content = contentToText(data?.choices?.[0]?.message?.content);
  if (!content) {
    throw new Error(`Leeg AI-antwoord ontvangen voor model ${model}`);
  }

  return content;
}

async function chatJson({
  system,
  user,
  maxTokens = 3000,
  temperature = 0.2,
  model,
  fallbackModel
}) {
  const primaryModel = model || DEFAULT_CONTENT_MODEL;
  const secondaryModel = fallbackModel || (primaryModel === DEFAULT_SYLLABUS_MODEL ? DEFAULT_CONTENT_MODEL : DEFAULT_SYLLABUS_MODEL);
  const fullPrompt = system ? `${system}\n\n${user}` : user;

  const attempts = [
    { model: primaryModel },
    { model: primaryModel },
    { model: secondaryModel }
  ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      const content = await callOpenRouter({
        model: attempt.model,
        fullPrompt,
        maxTokens,
        temperature
      });
      return extractJsonFromText(content);
    } catch (err) {
      lastError = err;
      console.warn(`AI poging mislukt met model ${attempt.model}: ${err.message}`);
    }
  }

  throw lastError || new Error('Onbekende AI-fout');
}

module.exports = {
  chatJson,
  extractJsonFromText,
  DEFAULT_CONTENT_MODEL,
  DEFAULT_SYLLABUS_MODEL,
};
