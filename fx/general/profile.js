// fx/general/profile.js
// User profile and statistics function

// Mock database - replace with actual database in production
const userProfiles = new Map();
const userActivity = new Map();
const messageHistory = new Map();

async function profileFunction(request) {
  try {
    const { userId, targetUserId, detailed = false } = request.data;
    
    if (!userId) {
      return {
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required'
        }
      };
    }

    // Determine which user to show profile for
    const profileUserId = targetUserId || userId;
    const isSelf = profileUserId === userId;
    
    // Get or create user profile
    const profile = await getUserProfile(profileUserId);
    
    // Get user statistics
    const stats = await getUserStatistics(profileUserId);
    
    // Get activity data
    const activity = await getUserActivity(profileUserId);
    
    // Calculate rank/level
    const rank = calculateUserRank(stats);
    
    // Format response
    const formatted = formatProfile(profile, stats, activity, rank, isSelf, detailed);
    
    return {
      success: true,
      result: {
        profile: profile,
        statistics: stats,
        activity: activity,
        rank: rank,
        isSelf: isSelf,
        formatted: formatted
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'PROFILE_FETCH_FAILED',
        message: error.message || 'Failed to fetch user profile'
      }
    };
  }
}

async function getUserProfile(userId) {
  if (!userProfiles.has(userId)) {
    // Create default profile
    const defaultProfile = {
      userId: userId,
      username: `User_${userId.substring(0, 8)}`,
      bio: 'No bio set',
      joinDate: new Date().toISOString(),
      level: 1,
      xp: 0,
      badges: ['newbie'],
      theme: 'default',
      privacy: {
        showStats: true,
        showActivity: true,
        showJoinDate: true
      }
    };
    userProfiles.set(userId, defaultProfile);
  }
  
  return userProfiles.get(userId);
}

async function getUserStatistics(userId) {
  // Initialize if not exists
  if (!userActivity.has(userId)) {
    userActivity.set(userId, {
      messagesSent: 0,
      commandsUsed: 0,
      mediaShared: 0,
      groupsJoined: 0,
      activeDays: 1,
      lastActive: new Date().toISOString()
    });
  }
  
  const activity = userActivity.get(userId);
  
  // Calculate additional stats
  const now = new Date();
  const joinDate = new Date(userProfiles.get(userId)?.joinDate || now);
  const daysSinceJoin = Math.max(1, Math.floor((now - joinDate) / (1000 * 60 * 60 * 24)));
  
  return {
    ...activity,
    daysSinceJoin: daysSinceJoin,
    avgMessagesPerDay: (activity.messagesSent / daysSinceJoin).toFixed(1),
    commandRatio: activity.messagesSent > 0 ? 
      ((activity.commandsUsed / activity.messagesSent) * 100).toFixed(1) + '%' : '0%'
  };
}

async function getUserActivity(userId) {
  // Get recent activity from message history
  const userMessages = messageHistory.get(userId) || [];
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const todayActivity = userMessages.filter(msg => 
    new Date(msg.timestamp) > oneDayAgo
  ).length;
  
  const weekActivity = userMessages.filter(msg => 
    new Date(msg.timestamp) > oneWeekAgo
  ).length;
  
  // Calculate active hours
  const hourCounts = Array(24).fill(0);
  userMessages.forEach(msg => {
    const hour = new Date(msg.timestamp).getHours();
    hourCounts[hour]++;
  });
  
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  
  return {
    today: todayActivity,
    thisWeek: weekActivity,
    totalMessages: userMessages.length,
    peakActivityHour: peakHour,
    activeHours: hourCounts.filter(h => h > 0).length,
    lastMessage: userMessages.length > 0 ? 
      userMessages[userMessages.length - 1].timestamp : null
  };
}

function calculateUserRank(stats) {
  const score = (stats.messagesSent * 1) + 
                (stats.commandsUsed * 2) + 
                (stats.mediaShared * 0.5) + 
                (stats.activeDays * 10);
  
  const ranks = [
    { name: 'Newbie', min: 0, color: '#808080' },
    { name: 'Member', min: 100, color: '#00aaff' },
    { name: 'Regular', min: 500, color: '#00cc00' },
    { name: 'Active', min: 1000, color: '#ff9900' },
    { name: 'Veteran', min: 5000, color: '#ff0000' },
    { name: 'Legend', min: 10000, color: '#aa00ff' }
  ];
  
  let userRank = ranks[0];
  for (const rank of ranks) {
    if (score >= rank.min) {
      userRank = rank;
    }
  }
  
  const nextRank = ranks[ranks.indexOf(userRank) + 1];
  const progress = nextRank ? 
    ((score - userRank.min) / (nextRank.min - userRank.min) * 100).toFixed(1) : 100;
  
  return {
    name: userRank.name,
    level: ranks.indexOf(userRank) + 1,
    score: Math.floor(score),
    color: userRank.color,
    progress: progress,
    nextRank: nextRank ? nextRank.name : null,
    neededForNext: nextRank ? nextRank.min - score : 0
  };
}

function formatProfile(profile, stats, activity, rank, isSelf, detailed) {
  const username = profile.username || `User_${profile.userId.substring(0, 8)}`;
  const joinDate = new Date(profile.joinDate).toLocaleDateString();
  
  let formatted = `👤 *${username}'s Profile*\n`;
  formatted += `${isSelf ? '(Your Profile)' : ''}\n`;
  formatted += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  // Rank and Level
  formatted += `🏆 *Rank:* ${rank.name} (Level ${rank.level})\n`;
  formatted += `📊 *Score:* ${rank.score} XP\n`;
  
  if (rank.nextRank) {
    formatted += `⏫ *Progress:* ${rank.progress}% to ${rank.nextRank}\n`;
    formatted += `📈 *Need:* ${rank.neededForNext} more XP\n`;
  }
  
