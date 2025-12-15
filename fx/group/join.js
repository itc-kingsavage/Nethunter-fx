// fx/group/join.js

// Store join requests and logs
const joinRequests = new Map();
const joinLogs = new Map();

async function joinFunction(request) {
  try {
    const { inviteLink, userId, userInfo = {} } = request.data;
    
    if (!inviteLink) {
      return {
        success: false,
        error: {
          code: 'MISSING_INVITE_LINK',
          message: 'Invite link is required'
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

    // Validate invite link
    const validation = validateInviteLink(inviteLink);
    
    if (!validation.valid) {
      return {
        success: false,
        error: {
          code: 'INVALID_LINK',
          message: validation.message
        }
      };
    }

    // Extract group info from link
    const groupInfo = extractGroupInfoFromLink(inviteLink);
    
    // Check if group exists and is joinable
    const groupStatus = await checkGroupStatus(groupInfo);
    
    if (!groupStatus.joinable) {
      return {
        success: false,
        error: {
          code: 'GROUP_NOT_JOINABLE',
          message: groupStatus.message
        }
      };
    }

    // Join the group (simulated)
    const joinResult = await joinGroup(groupInfo, userId, userInfo);
    
    // Log the join
    logJoin({
      userId,
      groupId: groupInfo.id,
      groupName: groupInfo.name,
      inviteLink: inviteLink,
      timestamp: new Date().toISOString(),
      success: true
    });

    return {
      success: true,
      result: {
        groupId: groupInfo.id,
        groupName: groupInfo.name,
        userId: userId,
        joinedAt: new Date().toISOString(),
        inviteLink: inviteLink,
        memberCount: groupInfo.memberCount,
        formatted: formatJoinResponse(groupInfo.name, userId, groupInfo.memberCount)
      }
    };
    
  } catch (error) {
    // Log failed join
    if (request.data) {
      logJoin({
        userId: request.data.userId,
        inviteLink: request.data.inviteLink,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message
      });
    }
    
    return {
      success: false,
      error: {
        code: 'JOIN_FAILED',
        message: error.message || 'Failed to join group'
      }
    };
  }
}

function validateInviteLink(link) {
  // WhatsApp invite link patterns
  const whatsappPatterns = [
    /chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/i,
    /whatsapp\.com\/channel\/([A-Za-z0-9_-]+)/i,
    /whatsapp\.com\/group\/([A-Za-z0-9_-]+)/i
  ];
  
  for (const pattern of whatsappPatterns) {
    if (pattern.test(link)) {
      return {
        valid: true,
        platform: 'whatsapp',
        code: pattern.exec(link)[1]
      };
    }
  }
  
  // Telegram invite link patterns
  const telegramPatterns = [
    /t\.me\/(joinchat\/[A-Za-z0-9_-]+)/i,
    /telegram\.me\/(joinchat\/[A-Za-z0-9_-]+)/i
  ];
  
  for (const pattern of telegramPatterns) {
    if (pattern.test(link)) {
      return {
        valid: true,
        platform: 'telegram',
        code: pattern.exec(link)[1]
      };
    }
  }
  
  return {
    valid: false,
    message: 'Invalid invite link format'
  };
}

function extractGroupInfoFromLink(link) {
  const validation = validateInviteLink(link);
  
  if (!validation.valid) {
    return {
      id: 'unknown',
      name: 'Unknown Group',
      platform: 'unknown',
      memberCount: 0
    };
  }
  
  // Mock group info based on link
  return {
    id: `group_${validation.code}`,
    name: `Group ${validation.code.substring(0, 8)}`,
    platform: validation.platform,
    memberCount: Math.floor(Math.random() * 100) + 10,
    isPublic: Math.random() > 0.5,
    requiresApproval: Math.random() > 0.7
  };
}

async function checkGroupStatus(groupInfo) {
  // Simulate group status checks
  
  if (groupInfo.platform === 'unknown') {
    return {
      joinable: false,
      message: 'Unsupported platform'
    };
  }
  
  if (!groupInfo.isPublic && groupInfo.requiresApproval) {
    return {
      joinable: true,
      message: 'Requires admin approval',
      requiresApproval: true
    };
  }
  
  if (groupInfo.memberCount > 1000) {
    return {
      joinable: false,
      message: 'Group is full'
    };
  }
  
  return {
    joinable: true,
    message: 'Group is joinable'
  };
}

async function joinGroup(groupInfo, userId, userInfo) {
  // Simulate joining group
  // In production, this would call WhatsApp/Telegram API
  
  return {
    success: true,
    joinedAt: new Date().toISOString(),
    isPending: groupInfo.requiresApproval,
    message: groupInfo.requiresApproval ? 
      'Join request sent, waiting for admin approval' :
      'Successfully joined the group'
  };
}

function logJoin(log) {
  const userJoins = joinLogs.get(log.userId) || [];
  userJoins.push(log);
  joinLogs.set(log.userId, userJoins.slice(-50)); // Keep last 50 joins per user
}

function formatJoinResponse(groupName, userId, memberCount) {
  let formatted = `👥 *Joined Group Successfully!*\n\n`;
  
  formatted += `🏷️ *Group:* ${groupName}\n`;
  formatted += `👤 *User:* ${userId.substring(0, 12)}...\n`;
  formatted += `👥 *Members:* ${memberCount}\n`;
  formatted += `🕒 *Joined:* ${new Date().toLocaleTimeString()}\n\n`;
  
  formatted += `✅ *Successfully joined the group*\n`;
  formatted += `💬 You can now send messages\n`;
  formatted += `📢 Participate in discussions\n`;
  formatted += `👋 Introduce yourself!\n\n`;
  
  formatted += `📋 *Group Rules:*\n`;
  formatted += `• Be respectful to members\n`;
  formatted += `• No spam or advertising\n`;
  formatted += `• Follow admin instructions\n`;
  formatted += `• Enjoy your stay!\n`;
  
  formatted += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  formatted += `⚡ Welcome to the community!`;
  
  return formatted;
}

// Get user's join history
joinFunction.getUserJoins = function(userId, limit = 10) {
  const joins = joinLogs.get(userId) || [];
  return joins.slice(-limit).reverse();
};

module.exports = joinFunction;
