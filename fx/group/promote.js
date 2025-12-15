// fx/group/promote.js

// Store promotion logs
const promotionLogs = new Map();

async function promoteFunction(request) {
  try {
    const { groupId, targetUserId, promoterUserId, reason = '' } = request.data;
    
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

    if (!promoterUserId) {
      return {
        success: false,
        error: {
          code: 'MISSING_PROMOTER',
          message: 'Promoter user ID is required'
        }
      };
    }

    // Check if promoter has permission
    const canPromote = await checkPromotionPermission(promoterUserId, groupId);
    
    if (!canPromote) {
      return {
        success: false,
        error: {
          code: 'NO_PERMISSION',
          message: 'You do not have permission to promote users'
        }
      };
    }

    // Check if target is already admin
    const isAlreadyAdmin = await checkIsAdmin(targetUserId, groupId);
    
    if (isAlreadyAdmin) {
      return {
        success: false,
        error: {
          code: 'ALREADY_ADMIN',
          message: 'This user is already an admin'
        }
      };
    }

    // Promote the user (simulated)
    const promotionResult = await promoteUserToAdmin(groupId, targetUserId);
    
    // Log the promotion
    logPromotion({
      groupId,
      targetUserId,
      promoterUserId,
      reason,
      timestamp: new Date().toISOString(),
      success: true
    });

    return {
      success: true,
      result: {
        groupId: groupId,
        targetUserId: targetUserId,
        promoterUserId: promoterUserId,
        reason: reason,
        promotedAt: new Date().toISOString(),
        formatted: formatPromotionResponse(targetUserId, promoterUserId, reason)
      }
    };
    
  } catch (error) {
    // Log failed promotion
    if (request.data) {
      logPromotion({
        groupId: request.data.groupId,
        targetUserId: request.data.targetUserId,
        promoterUserId: request.data.promoterUserId,
        reason: request.data.reason,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message
      });
    }
    
    return {
      success: false,
      error: {
        code: 'PROMOTE_FAILED',
        message: error.message || 'Failed to promote user'
      }
    };
  }
}

async function checkPromotionPermission(userId, groupId) {
  // In production, check if user is group admin/owner
  // For simulation, allow if user has "admin" in their name
  
  const mockUser = await getUserInfo(userId);
  return mockUser.isAdmin || mockUser.isOwner;
}

async function checkIsAdmin(userId, groupId) {
  // Check if user is already admin
  const mockUser = await getUserInfo(userId);
  return mockUser.isAdmin;
}

async function promoteUserToAdmin(groupId, userId) {
  // In production, call WhatsApp API to promote user
  // For simulation, return success
  
  return {
    success: true,
    promotedAt: new Date().toISOString(),
    newRole: 'admin'
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

function logPromotion(log) {
  const groupLogs = promotionLogs.get(log.groupId) || [];
  groupLogs.push(log);
  promotionLogs.set(log.groupId, groupLogs.slice(-100)); // Keep last 100 logs
}

function formatPromotionResponse(targetUserId, promoterUserId, reason) {
  let formatted = `👑 *User Promoted to Admin!*\n\n`;
  
  formatted += `🎯 *Target:* ${targetUserId.substring(0, 12)}...\n`;
  formatted += `👤 *Promoted by:* ${promoterUserId.substring(0, 12)}...\n`;
  
  if (reason) {
    formatted += `📝 *Reason:* ${reason}\n`;
  }
  
  formatted += `🕒 *Time:* ${new Date().toLocaleTimeString()}\n\n`;
  
  formatted += `✅ User now has admin privileges\n`;
  formatted += `🔧 Can manage group settings\n`;
  formatted += `👥 Can add/remove members\n`;
  formatted += `⚡ Can pin messages\n\n`;
  
  formatted += `⚠️ *New admin can:*\n`;
  formatted += `• Change group info\n`;
  formatted += `• Remove members\n`;
  formatted += `• Add new admins\n`;
  formatted += `• Delete messages\n`;
  
  formatted += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  formatted += `⚡ Promotion logged for security`;
  
  return formatted;
}

// Get promotion logs for a group
promoteFunction.getLogs = function(groupId, limit = 10) {
  const logs = promotionLogs.get(groupId) || [];
  return logs.slice(-limit).reverse();
};

module.exports = promoteFunction;
