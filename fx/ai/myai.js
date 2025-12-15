// fx/ai/myai.js
// Progressive AI chat with session memory

const OpenAI = require('openai');
const crypto = require('crypto');

// Session storage (in production, use Redis/DB)
const chatSessions = new Map();
const MAX_SESSIONS = 1000;
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

async function myaiFunction(request) {
  try {
    const { userId, message, sessionId = null, reset = false } = request.data;
    
    if (!userId) {
      return {
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required'
        }
      };
    }

    if (!message || message.trim().length === 0) {
      return {
        success: false,
        error: {
          code: 'MISSING_MESSAGE',
          message: 'Message is required'
        }
      };
    }

    // Get or create session
    let session = sessionId ? chatSessions.get(sessionId) : null;
    
    if (!session || session.userId !== userId || reset) {
      // Create new session
      session = createNewSession(userId);
      chatSessions.set(session.id, session);
      
      // Clean up old sessions periodically
      cleanupSessions();
    }

    // Add user message to history
    session.history.push({
      role: 'user',
      content: message.trim(),
      timestamp: new Date().toISOString()
    });

    // Get AI response
    const aiResponse = await getAIResponse(session.history);
    
    // Add AI response to history
    session.history.push({
      role: 'assistant',
      content: aiResponse.content,
      timestamp: new Date().toISOString()
    });

    // Update session
    session.lastActivity = Date.now();
    session.messageCount += 1;
    
    // Trim history if too long
    if (session.history.length > 20) {
      // Keep system message and last 18 messages
      const systemMsg = session.history[0];
      const recentMsgs = session.history.slice(-18);
      session.history = [systemMsg, ...recentMsgs];
    }

    // Save session
    chatSessions.set(session.id, session);

    return {
      success: true,
      result: {
        response: aiResponse.content,
        sessionId: session.id,
        messageCount: session.messageCount,
        formatted: formatAIResponse(aiResponse.content, session.messageCount),
        sessionInfo: {
          id: session.id,
          createdAt: session.createdAt,
          messageCount: session.messageCount,
          historyLength: session.history.length - 1 // excluding system message
        }
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'MYAI_FAILED',
        message: error.message || 'Failed to process AI request'
      }
    };
  }
}

function createNewSession(userId) {
  const sessionId = generateSessionId();
  
  return {
    id: sessionId,
    userId: userId,
    createdAt: new Date().toISOString(),
    lastActivity: Date.now(),
    messageCount: 0,
    history: [
      {
        role: 'system',
        content: `You are MyAI, a helpful WhatsApp assistant. You have memory of this conversation. 
                  Be concise but helpful. Use emojis occasionally. 
                  Format responses clearly for mobile. Keep responses under 500 characters when possible.
                  Current date: ${new Date().toLocaleDateString()}`
      }
    ]
  };
}

async function getAIResponse(history) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    // Fallback to mock response if no API key
    return getMockAIResponse(history);
  }

  try {
    const openai = new OpenAI({
      apiKey: openaiApiKey
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: history,
      max_tokens: 500,
      temperature: 0.7,
      top_p: 0.9,
      frequency_penalty: 0.3,
      presence_penalty: 0.3
    });

    return {
      content: completion.choices[0].message.content,
      model: completion.model,
      tokens: completion.usage.total_tokens
    };
    
  } catch (error) {
    console.error('OpenAI API error:', error.message);
    // Fallback to mock response
    return getMockAIResponse(history);
  }
}

function getMockAIResponse(history) {
  const userMessages = history.filter(msg => msg.role === 'user');
  const lastMessage = userMessages[userMessages.length - 1];
  
  const responses = [
    `I understand you said: "${lastMessage.content.substring(0, 50)}...". As your AI assistant, I'm here to help! 🤖`,
    `Got it! Based on our conversation, I recommend being patient and thinking things through. 💭`,
    `That's an interesting point! Remember that I'm here to assist you with information and suggestions. ✨`,
    `Thanks for sharing! As your progressive AI, I'm learning from our conversation to better assist you. 📚`,
    `I've noted your message. Is there anything specific you'd like me to help you with today? 🌟`
  ];
  
  return {
    content: responses[Math.floor(Math.random() * responses.length)],
    model: 'mock-ai',
    tokens: 0
  };
}

function generateSessionId() {
  return `sess_${crypto.randomBytes(8).toString('hex')}`;
}

function formatAIResponse(response, messageCount) {
  let formatted = `🤖 *MyAI Response* (Chat #${messageCount})\n\n`;
  formatted += `${response}\n\n`;
  formatted += `━━━━━━━━━━━━━━━━━━━━\n`;
  formatted += `💡 *Tip:* I remember our conversation! Type "new" to start fresh.\n`;
  formatted += `📊 *Memory:* ${messageCount} messages in this session`;
  
  return formatted;
}

function cleanupSessions() {
  const now = Date.now();
  let deletedCount = 0;
  
  for (const [sessionId, session] of chatSessions.entries()) {
    if (now - session.lastActivity > SESSION_TTL) {
      chatSessions.delete(sessionId);
      deletedCount++;
    }
  }
  
  // If still too many sessions, delete oldest
  if (chatSessions.size > MAX_SESSIONS) {
    const sessionsArray = Array.from(chatSessions.entries());
    sessionsArray.sort((a, b) => a[1].lastActivity - b[1].lastActivity);
    
    const toDelete = sessionsArray.slice(0, sessionsArray.length - MAX_SESSIONS + 100);
    toDelete.forEach(([sessionId]) => chatSessions.delete(sessionId));
  }
}

// Cleanup every 5 minutes
setInterval(cleanupSessions, 5 * 60 * 1000);

// Session management helpers
myaiFunction.getSession = function(sessionId) {
  return chatSessions.get(sessionId);
};

myaiFunction.endSession = function(sessionId) {
  return chatSessions.delete(sessionId);
};

myaiFunction.listUserSessions = function(userId) {
  const userSessions = [];
  for (const [sessionId, session] of chatSessions.entries()) {
    if (session.userId === userId) {
      userSessions.push({
        id: sessionId,
        createdAt: session.createdAt,
        messageCount: session.messageCount,
        lastActivity: new Date(session.lastActivity).toISOString()
      });
    }
  }
  return userSessions;
};

module.exports = myaiFunction;
