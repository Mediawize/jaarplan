// ============================================================
// services/aiClient.js — Anthropic Claude versie
// Vervangt OpenAI. Interface (chatJson) blijft identiek.
// ============================================================

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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY niet ingesteld');
  }

  // Standaard model: Haiku 4.5 (goedkoopst, snel genoeg voor JSON taken)
  // Wissel naar 'claude-sonnet-4-6' voor betere kwaliteit
  const usedModel = model || process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
  const finalSystem = systemPrompt || system || '';
  const finalUser = (prompt || user || '').trim();

  if (!finalUser) {
    throw new Error('Lege gebruikersprompt — geef een userPrompt of context mee.');
  }

  const body = {
    model: usedModel,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: finalUser }]
  };

  // Anthropic gebruikt een apart 'system' veld (niet in messages)
  if (finalSystem) body.system = finalSystem;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (!response.ok) {
    // Quota / rate limit afhandeling (zelfde foutcodes als OpenAI)
    const status = response.status;
    const errMsg = data?.error?.message || JSON.stringify(data);
    if (status === 429) throw new Error(`429: ${errMsg}`);
    throw new Error(`Anthropic fout ${status}: ${errMsg}`);
  }

  const content = data?.content?.[0]?.text;
  return extractJsonFromText(Array.isArray(content) ? content.map(x => x?.text || '').join('') : content);
}

// Vision: stuur een afbeelding + tekstvraag naar Claude
async function chatVision({ imageBase64, mediaType = 'image/jpeg', prompt, system = '', maxTokens = 1500 }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY niet ingesteld');

  const usedModel = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

  const body = {
    model: usedModel,
    max_tokens: maxTokens,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: imageBase64 }
        },
        { type: 'text', text: prompt }
      ]
    }]
  };
  if (system) body.system = system;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (!response.ok) {
    const errMsg = data?.error?.message || JSON.stringify(data);
    throw new Error(`Anthropic vision fout ${response.status}: ${errMsg}`);
  }

  return data?.content?.[0]?.text || '';
}

module.exports = {
  chatJson,
  chatVision,
  extractJsonFromText,
};
