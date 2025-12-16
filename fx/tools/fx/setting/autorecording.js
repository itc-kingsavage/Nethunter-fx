// fx/settings/autorecording.js
const { createSuccessResponse, createErrorResponse } = require('../../lib/response');

/**
 * Auto-recording voice note settings
 * Input: { enabled, maxDuration, autoConvert, userId, groupId(optional) }
 * Output: { status, settings }
 */
async function autorecordingFunction(request) {
    try {
        const { data } = request;
        const { enabled, maxDuration = 60, autoConvert = true, userId, groupId, chatType } = data;

        // Validate required fields
        if (enabled === undefined || !userId) {
            return createErrorResponse('VALIDATION_ERROR', 'Missing required fields: enabled, userId');
        }

        // Validate max duration (1-300 seconds)
        const duration = Math.min(Math.max(parseInt(maxDuration), 1), 300);

        // Validate chat type if provided
        let validChatType = chatType || 'private';
        if (chatType && !['private', 'group'].includes(chatType)) {
            return createErrorResponse('INVALID_CHAT_TYPE', 'chatType must be "private" or "group"');
        }

        // For group chats, validate groupId
        if (validChatType === 'group' && !groupId) {
            return createErrorResponse('MISSING_GROUP_ID', 'groupId is required for group chats');
        }

        // Create settings object
        const settings = {
            enabled: Boolean(enabled),
            maxDuration: duration,
            autoConvert: Boolean(autoConvert),
            userId,
            groupId: validChatType === 'group' ? groupId : null,
            chatType: validChatType,
            formats: {
                audio: ['mp3', 'ogg'],
                bitrate: '64kbps',
                sampleRate: 16000,
                channels: 1
            },
            triggers: {
                voiceKeywords: ['record', 'save this', 'memorize'],
                minDuration: 2,     // Minimum 2 seconds to trigger
                maxSilence: 3       // Max 3 seconds of silence allowed
            },
            storage: {
                autoDeleteAfter: 604800, // 7 days in seconds
                maxStorage: 100,          // 100MB per user
                compressOld: true
            },
            lastUpdated: new Date().toISOString()
        };

        // Simulate save to database
        const saveResult = {
            success: true,
            settingsId: `autorecord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            savedAt: new Date().toISOString()
        };

        return createSuccessResponse({
            status: enabled ? 'ENABLED' : 'DISABLED',
            settings: settings,
            saveResult: saveResult,
            message: `Auto-recording ${enabled ? 'enabled' : 'disabled'}. Max duration: ${duration}s, Auto-convert: ${autoConvert}`
        });

    } catch (error) {
        console.error('autorecordingFunction Error:', error);
        return createErrorResponse('SETTINGS_UPDATE_FAILED', error.message);
    }
}

module.exports = autorecordingFunction;
