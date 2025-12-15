// fx/group/online.js

// Activity tracking storage
const groupActivity = new Map();

async function onlineFunction(request) {
  try {
    const { groupId, limit = 100, timeRange = 'week' } = request.data;
    
    if (!groupId) {
      return {
        success: false,
        error: {
          code: 'MISSING_GROUP_ID',
          message: 'Group ID is required'
        }
      };
    }

    // Get online/active members ranking
    const rankings = await getActiveRankings(groupId, timeRange, limit);
    
    return {
      success: true,
      result: {
        groupId: groupId,
        rankings: rankings,
        timeRange: timeRange,
        limit: limit,
        formatted: formatRankings(rankings, timeRange)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'ONLINE_FAILED',
        message: error.message || 'Failed to get online rankings'
      }
    };
  }
}

async function getActiveRankings(groupId, timeRange, limit) {
  // Initialize activity tracking for group if not exists
  if (!groupActivity.has(groupId)) {
    groupActivity.set(groupId, {
      members: new Map(),
      lastUpdated: Date.now()
    });
  }
  
  const groupData = groupActivity.get(groupId);
  const now = Date.now();
  
  // Calculate time window in milliseconds
  let timeWindow;
  switch (timeRange) {
    case 'day':
      timeWindow = 24 * 60 * 60 * 1000;
      break;
    case 'week':
      timeWindow = 7 * 24 * 60 * 60 * 1000;
      break;
    case 'month':
      timeWindow = 30 * 24 * 60 * 60 * 1000;
      break;
    default:
      timeWindow = 7 * 24 * 60 * 60 * 1000;
  }
  
  // Filter activities within time window
  const recentActivities = [];
  
  for (const [userId, activities] of groupData.members.entries()) {
    const recent = activities.filter(time => now - time <= timeWindow);
    if (recent.length > 0) {
      recentActivities.push({
        userId,
        activityCount: recent.length,
        lastActive: Math.max(...recent),
        // Mock user info
        name: `User_${userId.substring(0, 8)}`,
        isAdmin: Math.random() > 0.8
      });
    }
  }
  
  // Sort by activity count (descending)
  recentActivities.sort((a, b) => b.activityCount - a.activityCount);
  
  // Limit results
  const topRankings = recentActivities.slice(0, limit);
  
  // Add ranks
  return topRankings.map((user, index) => ({
    rank: index + 1,
    ...user,
    activityLevel: calculateActivityLevel(user.activityCount, timeRange)
  }));
}

function calculateActivityLevel(count, timeRange) {
  let thresholds;
  
  switch (timeRange) {
    case 'day':
      thresholds = { high: 50, medium: 20, low: 5 };
      break;
    case 'week':
      thresholds = { high: 200, medium: 80, low: 20 };
      break;
    case 'month':
      thresholds = { high: 800, medium: 300, low: 100 };
      break;
    default:
      thresholds = { high: 100, medium: 40, low: 10 };
  }
  
  if (count >= thresholds.high) return '🔥 Very Active';
  if (count >= thresholds.medium) return '📈 Active';
  if (count >= thresholds.low) return '📊 Moderate';
  return '📉 Low';
}

function formatRankings(rankings, timeRange) {
  let formatted = `🏆 *Most Active Members*\n`;
  formatted += `⏰ Time Range: ${timeRange}\n\n`;
  
  if (rankings.length === 0) {
    formatted += `📭 No activity recorded yet\n`;
    formatted += `Messages will be tracked from now on\n`;
    return formatted;
  }
  
  formatted += `🏅 *Top ${Math.min(rankings.length, 10)} Members:*\n\n`;
  
  rankings.slice(0, 10).forEach(user => {
    const medal = user.rank === 1 ? '🥇' :
                  user.rank === 2 ? '🥈' :
                  user.rank === 3 ? '🥉' : '🔸';
    
    const adminBadge = user.isAdmin ? '👑' : '';
    
    formatted += `${medal} *${user.rank}.* ${adminBadge}${user.name}\n`;
    formatted += `   📊 Messages: ${user.activityCount}\n`;
    formatted += `   ⭐ Level: ${user.activityLevel}\n`;
    formatted += `   🕒 Last: ${formatTimeAgo(user.lastActive)}\n\n`;
  });
  
  if (rankings.length > 10) {
    formatted += `📋 ...and ${rankings.length - 10} more active members\n\n`;
  }
  
  formatted += `━━━━━━━━━━━━━━━━━━━━\n`;
  formatted += `📈 *Tracking last ${timeRange}'s activity*\n`;
  formatted += `💡 Send messages to increase your rank!`;
  
  return formatted;
}

function formatTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// Call this function when a message is sent in group
onlineFunction.recordActivity = function(groupId, userId) {
  if (!groupId || !userId) return;
  
  // Initialize group data if not exists
  if (!groupActivity.has(groupId)) {
    groupActivity.set(groupId, {
      members: new Map(),
      lastUpdated: Date.now()
    });
  }
  
  const groupData = groupActivity.get(groupId);
  const now = Date.now();
  
  // Initialize user activities if not exists
  if (!groupData.members.has(userId)) {
    groupData.members.set(userId, []);
  }
  
  const userActivities = groupData.members.get(userId);
  
  // Add current timestamp
  userActivities.push(now);
  
  // Keep only last 1000 activities per user
  if (userActivities.length > 1000) {
    groupData.members.set(userId, userActivities.slice(-1000));
  }
  
  // Update group last updated
  groupData.lastUpdated = now;
};

module.exports = onlineFunction;
