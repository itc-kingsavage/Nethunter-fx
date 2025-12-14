// fx/general/view.js
// This function simulates retrieving deleted messages
// In production, you'll need to integrate with actual message storage

const deletedMessagesCache = new Map();
const MAX_CACHE_SIZE = 100;

async function viewFunction(request) {
  try {
    const { messageId, chatId, userId, limit = 1 } = request.data;
    
    if (!chatId) {
      return {
        success: false,
        error: {
          code: 'MISSING_CHAT_ID',
          message: 'Chat ID is required to view deleted messages'
        }
      };
    }

    // Get deleted messages from cache/simulation
    const deletedMessages = await getDeletedMessages(chatId, messageId, limit);
    
    if (deletedMessages.length === 0) {
      return {
        success: false,
        error: {
          code: 'NO_DELETED_MESSAGES',
          message: 'No deleted messages found for this chat'
        }
      };
    }

    const formattedMessages = deletedMessages.map(formatMessage);
    
    return {
      success: true,
      result: {
        messages: deletedMessages,
        formatted: formatMessagesForDisplay(formattedMessages),
        count: deletedMessages.length,
        chatId: chatId
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'VIEW_FUNCTION_FAILED',
        message: error.message || 'Failed to retrieve deleted messages'
      }
    };
  }
}

// Simulated storage - replace with actual database in production
async function getDeletedMessages(chatId, specificMessageId = null, limit = 1) {
  // In production, this would query your message history database
  // This is a simulation using in-memory cache
  
  const cacheKey = `deleted_${chatId}`;
  const chatDeletedMessages = deletedMessagesCache.get(cacheKey) || [];
  
  if (specificMessageId) {
    // Return specific message if ID provided
    const specificMessage = chatDeletedMessages.find(msg => msg.id === specificMessageId);
    return specificMessage ? [specificMessage] : [];
  }
  
  // Return last N deleted messages
  return chatDeletedMessages.slice(-limit).reverse();
}

// Simulation function to "delete" a message (call this when messages are deleted)
function simulateMessageDeletion(message) {
  const cacheKey = `deleted_${message.chatId}`;
  const chatDeletedMessages = deletedMessagesCache.get(cacheKey) || [];
  
  // Add timestamp and deletion marker
  const deletedMessage = {
    ...message,
    deletedAt: new Date().toISOString(),
    isDeleted: true,
    id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
  
  chatDeletedMessages.push(deletedMessage);
  
  // Limit cache size
  if (chatDeletedMessages.length > MAX_CACHE_SIZE) {
    chatDeletedMessages.splice(0, chatDeletedMessages.length - MAX_CACHE_SIZE);
  }
  
  deletedMessagesCache.set(cacheKey, chatDeletedMessages);
  
  return deletedMessage;
}

function formatMessage(message) {
  const lines = message.text ? message.text.split('\n').slice(0, 3) : ['[No text content]'];
  const threeLines = lines.join('\n');
  
  return {
    id: message.id,
    sender: message.sender || 'Unknown',
    timestamp: message.timestamp || message.deletedAt,
    deletedAt: message.deletedAt,
    text: threeLines,
    originalLength: message.text ? message.text.length : 0,
    mediaType: message.mediaType || null,
    isViewOnce: message.isViewOnce || false
  };
}

function formatMessagesForDisplay(messages) {
  if (messages.length === 0) return 'No deleted messages found.';
  
  let formatted = `🗑️ *Deleted Messages Revealed*\n\n`;
  
  messages.forEach((msg, index) => {
    formatted += `*Message ${index + 1}:*\n`;
    formatted += `👤 From: ${msg.sender}\n`;
    formatted += `🕒 Deleted: ${formatTimeAgo(msg.deletedAt)}\n\n`;
    
    if (msg.mediaType) {
      formatted += `📎 Media: ${msg.mediaType.toUpperCase()}\n`;
      if (msg.isViewOnce) {
        formatted += `👁️ View-once media (protected)\n`;
      }
    }
    
    formatted += `💬 Preview:\n\`\`\`\n${msg.text}\n\`\`\`\n`;
    
    if (msg.originalLength > msg.text.length) {
      formatted += `_...${msg.originalLength - msg.text.length} more characters_\n`;
    }
    
    formatted += `\n────────────\n\n`;
  });
  
  return formatted;
}

function formatTimeAgo(timestamp) {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  
  return past.toLocaleDateString();
}

// Export simulation function for testing
viewFunction.simulateDeletion = simulateMessageDeletion;

module.exports = viewFunction;
