// fx/group/demote.js

// Store demotion logs
const demotionLogs = new Map();

async function demoteFunction(request) {
  try {
    const { groupId, targetUserId, demoterUserId, reason = '' } = request.data;
    
    if (!groupId) {
      return {
        success: false,
        error: {
          code: 'MISSING_GROUP_ID',
          message: 'Group ID is required'
        }
      };
    }

    if (!targetUserId) {
      return {
        success: false,
        error: {
          code: 'MISSING_TARGET',
          message: 'Target user ID is required'
        }
      };
    }

    if (!demoterUserId) {
      return {
        success: false,
        error: {
          code: 'MISSING_DEMOTER',
          message: 'Demoter user ID is required'
        }
      };
    }

    // Check if demoter has permission
    const canDemote = await checkDemotionPermission(demoterUserId, groupId, targetUserId);
    
    if (!canDemote) {
      return {
        success: false,
        error: {
          code: 'NO_PERMISSION',
          message: 'You do not have permission to demote this user'
        }
      };
    }

    // Check if target is actually an admin
    const isAdmin = await checkIsAdmin(targetUserId, groupId);
    
    if (!isAdmin) {
      return {
        success: false,
        error: {
          code: 'NOT_ADMIN',
          message: 'This user is not an admin'
        }
      };
    }

    // Check if demoter is trying to demote themselves
    if (targetUserId === demoterUserId) {
      return {
        success: false,
        error: {
          code: 'SELF_DEMOTION',
          message: 'You cannot demote yourself'
        }
      };
    }

    // Demote the user (simulated)
    const demotionResult = await demoteUserFromAdmin(groupId, targetUserId);
    
    // Log the demotion
    logDemotion({
      groupId,
      targetUserId,
      demoterUserId,
      reason,
      timestamp: new Date().toISOString(),
      success: true
    });

    return {
      success: true,
      result: {
        groupId: groupId,
        targetUserId: targetUserId,
        demoterUserId: demoterUserId,
        reason: reason,
        demotedAt: new Date().toISOString(),
        formatted: formatDemotionResponse(targetUserId, demoterUserId, reason)
      }
    };
    
  } catch (error) {
    // Log failed demotion
    if (request.data) {
      logDemotion({
        groupId: request.data.groupId,
        targetUserId: request.data.targetUserId,
        demoterUserId: request.data.demoterUserId,
        reason: request.data.reason,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message
      });
    }
    
    return {
      success: false,
      error: {
        code: 'DEMOTE_FAILED',
        message: error.message || 'Failed to demote user'
      }
    };
  }
}

async function checkDemotionPermission(userId, groupId, targetUserId) {
  // In production, check if user has permission to demote
  // For simulation, allow if user is group owner
  
  const mockUser = await getUserInfo(userId);
  const mockTarget = await getUserInfo(targetUserId);
  
  // Only owner can demote, and cannot demote owner
  return mockUser.isOwner && !mockTarget.isOwner;
}

async function checkIsAdmin(userId, groupId) {
  // Check if user is admin
  const mockUser = await getUserInfo(userId);
  return mockUser.isAdmin;
}

async function demoteUserFromAdmin(groupId, userId) {
  // In production, call WhatsApp API to demote user
  // For simulation, return success
  
  return {
    success: true,
    demotedAt: new Date().toISOString(),
    newRole: 'member'
  };
}

async function getUserInfo(userId) {
  // Mock user info
  return {
    id: userId,
    name: `User_${userId.substring(0, 8)}`,
    isAdmin: Math.random() > 0.7,
    isOwner: Math.random() > 0.9
  };
}

function logDemotion(log) {
  const groupLogs = demotionLogs.get(log.groupId) || [];
  groupLogs.push(log);
  demotionLogs.set(log.groupId, groupLogs.slice(-100)); // Keep last 100 logs
}

function formatDemotionResponse(targetUserId, demoterUserId, reason) {
  let formatted = `🔻 *Admin Demoted to Member!*\n\n`;
  
  formatted += `🎯 *Target:* ${targetUserId.substring(0, 12)}...\n`;
  formatted += `👤 *Demoted by:* ${demoterUserId.substring(0, 12)}...\n`;
  
  if (reason) {
    formatted += `📝 *Reason:* ${reason}\n`;
  }
  
  formatted += `🕒 *Time:* ${new Date().toLocaleTimeString()}\n\n`;
  
  formatted += `⚠️ *Admin privileges removed:*\n`;
  formatted += `• Cannot change group info\n`;
  formatted += `• Cannot remove members\n`;
  formatted += `• Cannot add new admins\n`;
  formatted += `• Cannot delete messages\n\n`;
  
  formatted += `✅ User is now a regular member\n`;
  formatted += `💬 Can still send messages\n`;
  formatted += `👥 Can still participate\n`;
  
  formatted += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  formatted += `⚡ Demotion logged for security`;
  
  return formatted;
}

// Get demotion logs for a group
demoteFunction.getLogs = function(groupId, limit = 10) {
  const logs = demotionLogs.get(groupId) || [];
  return logs.slice(-limit).reverse();
};

module.exports = demoteFunction;
