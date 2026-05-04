// ==========================================
//  ANTHROPIC API LAYER
// ==========================================

const API_BASE = 'https://api.anthropic.com/v1/messages';

/**
 * Call the Anthropic API with streaming support.
 * @param {Object} opts
 * @param {string} opts.apiKey
 * @param {string} opts.model
 * @param {string} opts.systemPrompt
 * @param {string} opts.userMessage
 * @param {function} opts.onToken   - called with each streamed text chunk
 * @param {function} opts.onDone    - called with full response text
 * @param {function} opts.onError   - called on error
 * @param {number}  opts.maxTokens
 */
async function callAgentAPI({ apiKey, model, systemPrompt, userMessage, onToken, onDone, onError, maxTokens = 1200 }) {
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        stream: true,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
      throw new Error(err?.error?.message || `API error ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let inputTokens = 0;
    let outputTokens = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const json = JSON.parse(data);

          if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
            const token = json.delta.text;
            fullText += token;
            if (onToken) onToken(token, fullText);
          }

          if (json.type === 'message_start' && json.message?.usage) {
            inputTokens = json.message.usage.input_tokens || 0;
          }

          if (json.type === 'message_delta' && json.usage) {
            outputTokens = json.usage.output_tokens || 0;
          }
        } catch (_) {}
      }
    }

    if (onDone) onDone(fullText, { inputTokens, outputTokens });
    return fullText;

  } catch (err) {
    if (onError) onError(err);
    throw err;
  }
}

/**
 * Non-streaming call for JSON responses (planner).
 */
async function callAgentAPIJSON({ apiKey, model, systemPrompt, userMessage, maxTokens = 800 }) {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.map(b => b.text || '').join('') || '';
  const usage = data.usage || {};

  // Strip markdown fences if present
  const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  return { text: clean, usage };
}
