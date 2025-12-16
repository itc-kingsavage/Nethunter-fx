// fx/settings/antilink.js
const { createSuccessResponse, createErrorResponse } = require('../../lib/response');

/**
 * Anti-link protection settings
 * Input: { enabled, action, whitelist, blacklist, userId, groupId }
 * Output: { status, settings }
 */
async function antilinkFunction(request) {
    try {
        const { data } = request;
        const { enabled, action = 'warn', whitelist = [], blacklist = [], userId, groupId } = data;

        // Validate required fields (groupId is required for anti-link)
        if (enabled === undefined || !groupId) {
            return createErrorResponse('VALIDATION_ERROR', 'Missing required fields: enabled, groupId');
        }

        // Validate action
        const validActions = ['warn', 'delete', 'mute', 'kick'];
        const selectedAction = validActions.includes(action) ? action : 'warn';

        // Format whitelist and blacklist
        const formattedWhitelist = Array.isArray(whitelist) 
            ? whitelist.slice(0, 50).map(domain => domain.toLowerCase().replace(/^https?:\/\//, '').split('/')[0])
            : [];

        const formattedBlacklist = Array.isArray(blacklist)
            ? blacklist.slice(0, 100).map(domain => domain.toLowerCase().replace(/^https?:\/\//, '').split('/')[0])
            : [];

        // Add common social media to blacklist if empty
        const defaultBlacklist = [
            'instagram.com', 'facebook.com', 'tiktok.com', 'twitter.com',
            'whatsapp.com', 'telegram.org', 'discord.com', 'snapchat.com'
        ];

        const finalBlacklist = formattedBlacklist.length > 0 
            ? formattedBlacklist 
            : defaultBlacklist;

        // Create settings object
        const settings = {
            enabled: Boolean(enabled),
            action: selectedAction,
            userId,
            groupId,
            lists: {
                whitelist: formattedWhitelist,
                blacklist: finalBlacklist,
                allowedDomains: formattedWhitelist,
                blockedDomains: finalBlacklist
            },
            restrictions: {
                allowWhatsAppLinks: true,
                allowYouTubeLinks: true,
                allowImageLinks: true,
                allowSafeDomains: ['google.com', 'wikipedia.org', 'github.com'],
                exemptAdmins: true,
                exemptLinksInBio: false
            },
            punishments: {
                [selectedAction]: {
                    duration: selectedAction === 'mute' ? 3600 : 0, // 1 hour mute
                    maxWarnings: 3,
                    escalateAfter: 3
                }
            },
            detection: {
                detectHiddenLinks: true,
                detectLinkShorteners: true,
                checkImageMetadata: false,
                scanQRForLinks: false
            },
            statistics: {
                linksBlocked: 0,
                lastAction: null,
                usersWarned: 0
            },
            lastUpdated: new Date().toISOString()
        };

        // Simulate save to database
        const saveResult = {
            success: true,
            settingsId: `antilink_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            savedAt: new Date().toISOString()
        };

        return createSuccessResponse({
            status: enabled ? 'ACTIVE' : 'INACTIVE',
            settings: settings,
            saveResult: saveResult,
            message: `Anti-link protection ${enabled ? 'enabled' : 'disabled'}. Action: ${selectedAction}, Blacklist: ${finalBlacklist.length} domains`
        });

    } catch (error) {
        console.error('antilinkFunction Error:', error);
        return createErrorResponse('SETTINGS_UPDATE_FAILED', error.message);
    }
}

module.exports = antilinkFunction;
