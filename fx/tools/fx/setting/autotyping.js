// fx/settings/autotyping.js
const { createSuccessResponse, createErrorResponse } = require('../../lib/response');

/**
 * Auto-typing indicator settings
 * Input: { enabled, speed, chatType, userId, groupId(optional) }
 * Output: { status, settings }
 */
async function autotypingFunction(request) {
    try {
        const { data } = request;
        const { enabled, speed = 'medium', chatType, userId, groupId } = data;

        // Validate required fields
        if (enabled === undefined || !chatType || !userId) {
            return createErrorResponse('VALIDATION_ERROR', 'Missing required fields: enabled, chatType, userId');
        }

        // Validate chat type
        const validChatTypes = ['private', 'group'];
        if (!validChatTypes.includes(chatType)) {
            return createErrorResponse('INVALID_CHAT_TYPE', `chatType must be one of: ${validChatTypes.join(', ')}`);
        }

        // Validate speed
        const validSpeeds = ['slow', 'medium', 'fast'];
        const typingSpeed = validSpeeds.includes(speed) ? speed : 'medium';

        // For group chats, validate groupId
        if (chatType === 'group' && !groupId) {
            return createErrorResponse('MISSING_GROUP_ID', 'groupId is required for group chats');
        }

        // Calculate actual typing delay in milliseconds
        const speedMap = {
            slow: { min: 1500, max: 3000 },
            medium: { min: 800, max: 1500 },
            fast: { min: 300, max: 800 }
        };

        const speedConfig = speedMap[typingSpeed];

        // Create settings object
        const settings = {
            enabled: Boolean(enabled),
            speed: typingSpeed,
            chatType,
            userId,
            groupId: chatType === 'group' ? groupId : null,
            delays: speedConfig,
            typingDuration: {
                min: speedConfig.min,
                max: speedConfig.max
            },
            lastUpdated: new Date().toISOString(),
            features: {
                smartTyping: true,      // Only type when user is active
                responseDetection: true, // Stop typing when user responds
                idleTimeout: 30000       // Stop after 30 seconds of inactivity
            }
        };

        // Simulate save to database (in real implementation, connect to DB)
        const saveResult = {
            success: true,
            settingsId: `autotype_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            savedAt: new Date().toISOString()
        };

        return createSuccessResponse({
            status: enabled ? 'ENABLED' : 'DISABLED',
            settings: settings,
            saveResult: saveResult,
            message: `Auto-typing ${enabled ? 'enabled' : 'disabled'} for ${chatType} chat${chatType === 'group' ? ` in group ${groupId}` : ''}`
        });

    } catch (error) {
        console.error('autotypingFunction Error:', error);
        return createErrorResponse('SETTINGS_UPDATE_FAILED', error.message);
    }
}

module.exports = autotypingFunction;
