// fx/group/tagadm.js

async function tagadmFunction(request) {
  try {
    const { groupId, message = '' } = request.data;
    
    if (!groupId) {
      return {
        success: false,
        error: {
          code: 'MISSING_GROUP_ID',
          message: 'Group ID is required'
        }
      };
    }

    // Get group admins
    const admins = await getGroupAdmins(groupId);
    
    if (admins.length === 0) {
      return {
        success: false,
        error: {
          code: 'NO_ADMINS',
          message: 'No admins found in this group'
        }
      };
    }

    // Format admin mentions
    const adminMentions = formatAdminMentions(admins);
    
    // Create final message
    const finalMessage = message ? `${message}\n\n${adminMentions}` : adminMentions;
    
    return {
      success: true,
      result: {
        groupId: groupId,
        message: finalMessage,
        mentions: adminMentions,
        admins: admins,
        adminCount: admins.length,
        formatted: formatTagAdmResponse(admins, message)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'TAGADM_FAILED',
        message: error.message || 'Failed to tag admins'
      }
    };
  }
}

async function getGroupAdmins(groupId) {
  // In production, fetch from WhatsApp API
  // Mock data for simulation
  
  const mockAdmins = [
    {
      id: 'admin_1',
      number: '+12345678901',
      name: 'Group Owner',
      isOwner: true,
      isAdmin: true
    },
    {
      id: 'admin_2',
      number: '+12345678902',
      name: 'Admin 1',
      isOwner: false,
      isAdmin: true
    },
    {
      id: 'admin_3',
      number: '+12345678903',
      name: 'Admin 2',
      isOwner: false,
      isAdmin: true
    }
  ];
  
  // Randomly add more admins for larger groups
  if (Math.random() > 0.5) {
    mockAdmins.push({
      id: 'admin_4',
      number: '+12345678904',
      name: 'Admin 3',
      isOwner: false,
      isAdmin: true
    });
  }
  
  return mockAdmins;
}

function formatAdminMentions(admins) {
  let mentionsText = '👑 *Group Admins:*\n';
  
  admins.forEach((admin, index) => {
    const ownerBadge = admin.isOwner ? '👑 ' : '🔧 ';
    const mention = `@${admin.number}`;
    
    mentionsText += `${ownerBadge}${admin.name} ${mention}\n`;
  });
  
  return mentionsText.trim();
}

function formatTagAdmResponse(admins, customMessage) {
  let formatted = `🔧 *Tag Group Admins*\n\n`;
  
  if (customMessage) {
    formatted += `💬 *Message:* ${customMessage}\n\n`;
  }
  
  formatted += `👑 *Admins Tagged:*\n`;
  
  admins.forEach(admin => {
    const badge = admin.isOwner ? '👑 Owner' : '🔧 Admin';
    formatted += `${badge}: ${admin.name}\n`;
  });
  
  formatted += `\n📢 Admins will be notified\n`;
  
  if (admins.length === 1) {
    formatted += `⚠️ Only one admin in this group\n`;
  }
  
  formatted += `━━━━━━━━━━━━━━━━━━━━\n`;
  formatted += `⚡ Use for important announcements`;
  
  return formatted;
}

module.exports = tagadmFunction;
