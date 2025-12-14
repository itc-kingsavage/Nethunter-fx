// fx/general/save.js
const crypto = require('crypto');

// In-memory storage for demonstration
// In production, use a database like Redis, MongoDB, or PostgreSQL
const savedContent = new Map();
const userSaves = new Map(); // Track saves per user

async function saveFunction(request) {
  try {
    const { content, userId, expiresIn = '7d', tags = [], isPublic = false } = request.data;
    
    if (!content) {
      return {
        success: false,
        error: {
          code: 'MISSING_CONTENT',
          message: 'Content to save is required'
        }
      };
    }

    if (!userId) {
      return {
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required'
        }
      };
    }

    // Validate content size
    if (content.length > 10000) {
      return {
        success: false,
        error: {
          code: 'CONTENT_TOO_LARGE',
          message: 'Content must be less than 10,000 characters'
        }
      };
    }

    // Generate unique save code
    const saveCode = generateSaveCode();
    
    // Calculate expiration time
    const expiresAt = calculateExpiration(expiresIn);
    
    // Create save object
    const saveObject = {
      id: saveCode,
      content: content,
      userId: userId,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      tags: Array.isArray(tags) ? tags : [tags],
      isPublic: isPublic,
      views: 0,
      lastAccessed: null
    };

    // Save to storage
    savedContent.set(saveCode, saveObject);
    
    // Track user's saves
    if (!userSaves.has(userId)) {
      userSaves.set(userId, []);
    }
    userSaves.get(userId).push(saveCode);
    
    // Cleanup old saves for user (keep last 50)
    const userSaveList = userSaves.get(userId);
    if (userSaveList.length > 50) {
      const toRemove = userSaveList.slice(0, userSaveList.length - 50);
      toRemove.forEach(code => savedContent.delete(code));
      userSaves.set(userId, userSaveList.slice(-50));
    }

    return {
      success: true,
      result: {
        saveCode: saveCode,
        expiresAt: expiresAt.toISOString(),
        url: `/save/${saveCode}`, // For retrieval
        formatted: formatSaveSuccess(saveCode, expiresAt, content)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'SAVE_FAILED',
        message: error.message || 'Failed to save content'
      }
    };
  }
}

// Helper function to retrieve saved content
async function retrieveSave(saveCode, userId = null) {
  const save = savedContent.get(saveCode);
  
  if (!save) {
    return {
      success: false,
      error: {
        code: 'SAVE_NOT_FOUND',
        message: 'Save code not found or expired'
      }
    };
  }

  // Check expiration
  if (new Date(save.expiresAt) < new Date()) {
    savedContent.delete(saveCode);
    return {
      success: false,
      error: {
        code: 'SAVE_EXPIRED',
        message: 'This save has expired'
      }
    };
  }

  // Check privacy
  if (!save.isPublic && save.userId !== userId) {
    return {
      success: false,
      error: {
        code: 'ACCESS_DENIED',
        message: 'You do not have permission to view this save'
      }
    };
  }

  // Update access stats
  save.views += 1;
  save.lastAccessed = new Date().toISOString();
  savedContent.set(saveCode, save);

  return {
    success: true,
    result: {
      content: save.content,
      createdAt: save.createdAt,
      expiresAt: save.expiresAt,
      tags: save.tags,
      views: save.views,
      isPublic: save.isPublic,
      formatted: formatRetrievedContent(save)
    }
  };
}

// Helper function to list user's saves
async function listSaves(userId, page = 1, limit = 10) {
  const userSaveCodes = userSaves.get(userId) || [];
  const total = userSaveCodes.length;
  const totalPages = Math.ceil(total / limit);
  
  const start = (page - 1) * limit;
  const end = start + limit;
  const pageCodes = userSaveCodes.slice(start, end);
  
  const saves = pageCodes.map(code => {
    const save = savedContent.get(code);
    if (!save) return null;
    
    return {
      id: save.id,
      preview: save.content.substring(0, 100) + (save.content.length > 100 ? '...' : ''),
      createdAt: save.createdAt,
      expiresAt: save.expiresAt,
      tags: save.tags,
      views: save.views
    };
  }).filter(Boolean);

  return {
    success: true,
    result: {
      saves: saves,
      pagination: {
        page: page,
        limit: limit,
        total: total,
        totalPages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  };
}

function generateSaveCode() {
  // Generate a readable code like SAVE-ABC123
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars
  let code = 'SAVE-';
  
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return code;
}

function calculateExpiration(expiresIn) {
  const now = new Date();
  
  if (typeof expiresIn === 'string') {
    const match = expiresIn.match(/^(\d+)([dhm])$/);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];
      
      switch (unit) {
        case 'd':
          now.setDate(now.getDate() + value);
          break;
        case 'h':
          now.setHours(now.getHours() + value);
          break;
        case 'm':
          now.setMinutes(now.getMinutes() + value);
          break;
      }
      return now;
    }
  }
  
  // Default: 7 days
  now.setDate(now.getDate() + 7);
  return now;
}

function formatSaveSuccess(saveCode, expiresAt, content) {
  const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
  const expiresDate = new Date(expiresAt).toLocaleDateString();
  
  return `💾 *Content Saved Successfully!*\n\n` +
         `📦 *Save Code:* \`${saveCode}\`\n` +
         `📅 *Expires:* ${expiresDate}\n\n` +
         `📝 *Preview:*\n${preview}\n\n` +
         `🔗 *Retrieve with:* !save get ${saveCode}\n` +
         `_Or use the retrieval URL_`;
}

function formatRetrievedContent(save) {
  const expiresDate = new Date(save.expiresAt).toLocaleDateString();
  const createdDate = new Date(save.createdAt).toLocaleDateString();
  
  let formatted = `📂 *Retrieved Save: ${save.id}*\n\n`;
  formatted += `📅 *Created:* ${createdDate}\n`;
  formatted += `⏰ *Expires:* ${expiresDate}\n`;
  formatted += `👁️ *Views:* ${save.views}\n`;
  
  if (save.tags.length > 0) {
    formatted += `🏷️ *Tags:* ${save.tags.join(', ')}\n`;
  }
  
  formatted += `\n📝 *Content:*\n\`\`\`\n${save.content}\n\`\`\`\n`;
  
  if (save.isPublic) {
    formatted += `🌐 *Public Save*\n`;
  } else {
    formatted += `🔒 *Private Save*\n`;
  }
  
  return formatted;
}

// Attach helper functions for external use
saveFunction.retrieve = retrieveSave;
saveFunction.list = listSaves;

// Cleanup expired saves every hour
setInterval(() => {
  const now = new Date();
  for (const [code, save] of savedContent.entries()) {
    if (new Date(save.expiresAt) < now) {
      savedContent.delete(code);
      
      // Remove from user's list
      const userList = userSaves.get(save.userId);
      if (userList) {
        const index = userList.indexOf(code);
        if (index > -1) {
          userList.splice(index, 1);
        }
      }
    }
  }
}, 3600000);

module.exports = saveFunction;
