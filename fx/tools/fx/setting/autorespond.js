// fx/settings/autorespond.js
const { createSuccessResponse, createErrorResponse } = require('../../lib/response');

/**
 * Auto-responder settings
 * Input: { enabled, responses, triggers, userId, groupId(optional) }
 * Output: { status, settings }
 */
async function autorespondFunction(request) {
    try {
        const { data } = request;
        const { enabled, responses = [], triggers = [], userId, groupId, chatType = 'private' } = data;

        // Validate required fields
        if (enabled === undefined || !userId) {
            return createErrorResponse('VALIDATION_ERROR', 'Missing required fields: enabled, userId');
        }

        // Validate chat type
        if (!['private', 'group'].includes(chatType)) {
            return createErrorResponse('INVALID_CHAT_TYPE', 'chatType must be "private" or "group"');
        }

        // For group chats, validate groupId
        if (chatType === 'group' && !groupId) {
            return createErrorResponse('MISSING_GROUP_ID', 'groupId is required for group chats');
        }

        // Validate and format responses
        const formattedResponses = Array.isArray(responses) 
            ? responses.slice(0, 20).map((resp, index) => ({
                id: `resp_${index + 1}`,
                trigger: resp.trigger || '',
                response: resp.response || '',
                exactMatch: resp.exactMatch || false,
                caseSensitive: resp.caseSensitive || false,
                enabled: resp.enabled !== false
            }))
            : [];

        // Validate and format triggers
        const formattedTriggers = Array.isArray(triggers)
            ? triggers.slice(0, 10).map((trigger, index) => ({
                id: `trig_${index + 1}`,
                type: trigger.type || 'keyword',
                value: trigger.value || '',
                action: trigger.action || 'reply',
                cooldown: trigger.cooldown || 60,
                enabled: trigger.enabled !== false
            }))
            : [];

        // Create settings object
        const settings = {
            enabled: Boolean(enabled),
            responses: formattedResponses,
            triggers: formattedTriggers,
            userId,
            groupId: chatType === 'group' ? groupId : null,
            chatType,
            config: {
                delay: 1, // Seconds before responding
                maxPerHour: 10,
                ignoreBots: true,
                respectQuietHours: true,
                quietHoursStart: "22:00",
                quietHoursEnd: "08:00"
            },
            statistics: {
                totalTriggers: 0,
                lastTrigger: null,
                responsesSent: 0
            },
            lastUpdated: new Date().toISOString()
        };

        // Simulate save to database
        const saveResult = {
            success: true,
            settingsId: `autoresp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            savedAt: new Date().toISOString()
        };

        return createSuccessResponse({
            status: enabled ? 'ACTIVE' : 'INACTIVE',
            settings: settings,
            saveResult: saveResult,
            message: `Auto-responder ${enabled ? 'enabled' : 'disabled'} with ${formattedResponses.length} response(s) and ${formattedTriggers.length} trigger(s)`
        });

    } catch (error) {
        console.error('autorespondFunction Error:', error);
        return createErrorResponse('SETTINGS_UPDATE_FAILED', error.message);
    }
}

module.exports = autorespondFunction;
