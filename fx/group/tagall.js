// fx/group/tagall.js

async function tagallFunction(request) {
  try {
    const { groupId, message = '', excludeAdmins = false, excludeSelf = false } = request.data;
    
    if (!groupId) {
      return {
        success: false,
        error: {
          code: 'MISSING_GROUP_ID',
          message: 'Group ID is required'
        }
      };
    }

    // Get all group members
    const members = await getGroupMembers(groupId);
    
    if (members.length === 0) {
      return {
        success: false,
        error: {
          code: 'NO_MEMBERS',
          message: 'No members found in this group'
        }
      };
    }

    // Filter members if needed
    let membersToTag = [...members];
    
    if (excludeAdmins) {
      membersToTag = membersToTag.filter(member => !member.isAdmin);
    }
    
    if (excludeSelf) {
      // Assuming userId is provided in request metadata
      const userId = request.metadata?.userId;
      if (userId) {
        membersToTag = membersToTag.filter(member => member.id !== userId);
      }
    }

    // Format mentions
    const mentions = formatMentions(membersToTag);
    
    // Create final message
    const finalMessage = message ? `${message}\n\n${mentions}` : mentions;
    
    return {
      success: true,
      result: {
        groupId: groupId,
        message: finalMessage,
        mentions: mentions,
        memberCount: membersToTag.length,
        totalMembers: members.length,
        formatted: formatTagAllResponse(membersToTag.length, message)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'TAGALL_FAILED',
        message: error.message || 'Failed to tag all members'
      }
    };
  }
}

async function getGroupMembers(groupId) {
  // In production, this would fetch from WhatsApp API
  // For simulation, we'll generate mock members
  
  const mockMembers = Array.from({ length: Math.floor(Math.random() * 50) + 10 }, (_, i) => ({
    id: `user_${i + 1}`,
    number: `+1234567890${i}`,
    name: `User ${i + 1}`,
    isAdmin: i < 3, // First 3 are admins
    isBot: false
  }));
  
  return mockMembers;
}

function formatMentions(members) {
  // Format mentions for WhatsApp
  // In WhatsApp, mentions are @ followed by the phone number
  
  let mentionsText = '';
  
  members.forEach((member, index) => {
    // Create mention - format depends on WhatsApp API
    const mention = `@${member.number}`;
    mentionsText += mention;
    
    // Add spacing (every 5 mentions, new line)
    if ((index + 1) % 5 === 0) {
      mentionsText += '\n';
    } else {
      mentionsText += ' ';
    }
  });
  
  return mentionsText.trim();
}

function formatTagAllResponse(memberCount, customMessage) {
  let formatted = `🏷️ *Tag All Members*\n\n`;
  
  if (customMessage) {
    formatted += `💬 *Message:* ${customMessage}\n\n`;
  }
  
  formatted += `👥 *Tagging ${memberCount} members*\n`;
  formatted += `📢 All group members will be notified\n\n`;
  
  if (memberCount > 50) {
    formatted += `⚠️ *Note:* Large group mentions may be rate-limited\n`;
  }
  
  formatted += `━━━━━━━━━━━━━━━━━━━━\n`;
  formatted += `⚡ Use responsibly!`;
  
  return formatted;
}

// Rate limiting to prevent abuse
const tagAllCooldown = new Map();
const COOLDOWN_TIME = 5 * 60 * 1000; // 5 minutes

tagallFunction.checkCooldown = function(groupId) {
  const lastUsed = tagAllCooldown.get(groupId);
  if (lastUsed && Date.now() - lastUsed < COOLDOWN_TIME) {
    const remaining = Math.ceil((COOLDOWN_TIME - (Date.now() - lastUsed)) / 1000);
    return {
      onCooldown: true,
      remainingSeconds: remaining
    };
  }
  return { onCooldown: false };
};

tagallFunction.recordUsage = function(groupId) {
  tagAllCooldown.set(groupId, Date.now());
  
  // Clean up old entries periodically
  if (tagAllCooldown.size > 1000) {
    const now = Date.now();
    for (const [gid, timestamp] of tagAllCooldown.entries()) {
      if (now - timestamp > COOLDOWN_TIME * 2) {
        tagAllCooldown.delete(gid);
      }
    }
  }
};

module.exports = tagallFunction;
