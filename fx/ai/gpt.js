// fx/ai/gpt.js
const OpenAI = require('openai');

async function gptFunction(request) {
  try {
    const { prompt, model = 'gpt-3.5-turbo', maxTokens = 1000, temperature = 0.7 } = request.data;
    
    if (!prompt || prompt.trim().length === 0) {
      return {
        success: false,
        error: {
          code: 'MISSING_PROMPT',
          message: 'Prompt is required'
        }
      };
    }

    // Validate prompt length
    const cleanPrompt = prompt.trim();
    if (cleanPrompt.length > 4000) {
      return {
        success: false,
        error: {
          code: 'PROMPT_TOO_LONG',
          message: 'Prompt must be less than 4000 characters'
        }
      };
    }

    // Get response from OpenAI
    const response = await getGPTResponse(cleanPrompt, model, maxTokens, temperature);
    
    return {
      success: true,
      result: {
        response: response.content,
        model: response.model,
        tokens: response.tokens,
        prompt: cleanPrompt,
        formatted: formatGPTResponse(response.content, model, response.tokens)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'GPT_FAILED',
        message: error.message || 'Failed to get GPT response'
      }
    };
  }
}

async function getGPTResponse(prompt, model, maxTokens, temperature) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const openai = new OpenAI({
    apiKey: openaiApiKey
  });

  const completion = await openai.chat.completions.create({
    model: model,
    messages: [
      {
        role: 'system',
        content: `You are ChatGPT, a helpful AI assistant. Respond concisely and helpfully.
                  Format responses for WhatsApp mobile display.
                  Use markdown-like formatting with *bold* and _italic_.
                  Keep responses under ${maxTokens} tokens.`
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: maxTokens,
    temperature: temperature,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0
  });

  return {
    content: completion.choices[0].message.content,
    model: completion.model,
    tokens: completion.usage.total_tokens
  };
}

function formatGPTResponse(response, model, tokens) {
  const modelNames = {
    'gpt-3.5-turbo': 'GPT-3.5 Turbo',
    'gpt-4': 'GPT-4',
    'gpt-4-turbo': 'GPT-4 Turbo'
  };
  
  const modelDisplay = modelNames[model] || model;
  
  let formatted = `🧠 *${modelDisplay} Response*\n\n`;
  formatted += `${response}\n\n`;
  formatted += `━━━━━━━━━━━━━━━━━━━━\n`;
  formatted += `⚡ *Model:* ${modelDisplay}\n`;
  formatted += `🔢 *Tokens:* ${tokens}\n`;
  formatted += `🕒 *Generated:* ${new Date().toLocaleTimeString()}`;
  
  return formatted;
}

// Additional helper functions
gptFunction.models = async function() {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    return {
      success: false,
      error: 'OpenAI API key not configured'
    };
  }

  try {
    const openai = new OpenAI({ apiKey: openaiApiKey });
    const models = await openai.models.list();
    
    const chatModels = models.data
      .filter(model => model.id.includes('gpt'))
      .map(model => ({
        id: model.id,
        owned_by: model.owned_by,
        created: new Date(model.created * 1000).toISOString()
      }));
    
    return {
      success: true,
      models: chatModels
    };
  } catch (error) {
    throw new Error(`Failed to fetch models: ${error.message}`);
  }
};

module.exports = gptFunction;
