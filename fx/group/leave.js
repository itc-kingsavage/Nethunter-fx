// fx/group/leave.js

// Store leave logs
const leaveLogs = new Map();

async function leaveFunction(request) {
  try {
    const { groupId, userId, reason = '', silent = false } = request.data;
    
    if (!groupId) {
      return {
        success: false,
        error: {
          code: 'MISSING_GROUP_ID',
          message: 'Group ID is required'
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

    // Check if user is in the group
    const isMember = await checkGroupMembership(groupId, userId);
    
    if (!isMember) {
      return {
        success: false,
        error: {
          code: 'NOT_MEMBER',
          message: 'You are not a member of this group'
        }
      };
    }

    // Check if user is group owner
    const isOwner = await checkIsOwner(groupId, userId);
    
    if (isOwner) {
      return {
        success: false,
        error: {
          code: 'IS_OWNER',
          message: 'Group owner cannot leave, transfer ownership first'
        }
      };
    }

    // Leave the group (simulated)
    const leaveResult = await leaveGroup(groupId, userId, silent);
    
    // Log the leave
    logLeave({
      groupId,
      userId,
      reason,
      silent,
      timestamp: new Date().toISOString(),
      success: true
    });

    return {
      success: true,
      result: {
        groupId: groupId,
        userId: userId,
        reason: reason,
        leftAt: new Date().toISOString(),
        silent: silent,
        formatted: formatLeaveResponse(groupId, userId, reason, silent)
      }
    };
    
  } catch (error) {
    // Log failed leave
    if (request.data) {
      logLeave({
        groupId: request.data.groupId,
        userId: request.data.userId,
        reason: request.data.reason,
        silent: request.data.silent,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message
      });
    }
    
    return {
      success: false,
      error: {
        code: 'LEAVE_FAILED',
        message: error.message || 'Failed to leave group'
      }
    };
  }
}

async function checkGroupMembership(groupId, userId) {
  // Simulate checking membership
  // In production, check with WhatsApp API
  
  return Math.random() > 0.1; // 90% chance user is member
}

async function checkIsOwner(groupId, userId) {
  // Simulate checking ownership
  // In production, check with WhatsApp API
  
  return Math.random() > 0.9; // 10% chance user is owner
}

async function leaveGroup(groupId, userId, silent) {
  // Simulate leaving group
  // In production, call WhatsApp API
  
  return {
    success: true,
    leftAt: new Date().toISOString(),
    notificationSent: !silent,
    message: silent ? 'Left group silently' : 'Left group with notification'
  };
}

function logLeave(log) {
  const groupLeaves = leaveLogs.get(log.groupId) || [];
  groupLeaves.push(log);
  leaveLogs.set(log.groupId, groupLeaves.slice(-100)); // Keep last 100 leaves
  
  // Also track user leaves
  const userLeaves = leaveLogs.get(log.userId) || [];
  userLeaves.push(log);
  leaveLogs.set(log.userId, userLeaves.slice(-50)); // Keep last 50 leaves per user
}

function formatLeaveResponse(groupId, userId, reason, silent) {
  let formatted = `👋 *Left Group*\n\n`;
  
  formatted += `🏷️ *Group:* ${groupId.substring(0, 12)}...\n`;
  formatted += `👤 *User:* ${userId.substring(0, 12)}...\n`;
  
  if (reason) {
    formatted += `📝 *Reason:* ${reason}\n`;
  }
  
  formatted += `🔇 *Silent:* ${silent ? 'Yes' : 'No'}\n`;
  formatted += `🕒 *Left:* ${new Date().toLocaleTimeString()}\n\n`;
  
  if (silent) {
    formatted += `✅ *Left group silently*\n`;
    formatted += `🔕 No notification sent to group\n`;
  } else {
    formatted += `✅ *Left group with notification*\n`;
    formatted += `🔔 Group notified of your departure\n`;
  }
  
  formatted += `🚪 No longer a member\n`;
  formatted += `📭 Cannot send/receive messages\n`;
  formatted += `👥 Removed from member list\n\n`;
  
  formatted += `💡 *You can:*\n`;
  formatted += `• Rejoin if you have invite link\n`;
  formatted += `• Be added back by admin\n`;
  formatted += `• Join other groups\n`;
  
  formatted += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  formatted += `⚡ Goodbye! Hope to see you again`;
  
  return formatted;
}

// Get group leave history
leaveFunction.getGroupLeaves = function(groupId, limit = 10) {
  const leaves = leaveLogs.get(groupId) || [];
  return leaves.slice(-limit).reverse();
};

// Get user leave history
leaveFunction.getUserLeaves = function(userId, limit = 10) {
  const leaves = leaveLogs.get(userId) || [];
  return leaves.slice(-limit).reverse();
};

module.exports = leaveFunction;
