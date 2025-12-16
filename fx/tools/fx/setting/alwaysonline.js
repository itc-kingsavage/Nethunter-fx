// fx/settings/alwaysonline.js
const { createSuccessResponse, createErrorResponse } = require('../../lib/response');

/**
 * Always online/presence settings
 * Input: { enabled, showReadReceipts, lastSeenPrivacy, userId }
 * Output: { status, settings }
 */
async function alwaysonlineFunction(request) {
    try {
        const { data } = request;
        const { enabled, showReadReceipts = true, lastSeenPrivacy = 'contacts', userId } = data;

        // Validate required fields
        if (enabled === undefined || !userId) {
            return createErrorResponse('VALIDATION_ERROR', 'Missing required fields: enabled, userId');
        }

        // Validate privacy settings
        const validPrivacySettings = ['everyone', 'contacts', 'nobody'];
        const privacySetting = validPrivacySettings.includes(lastSeenPrivacy) 
            ? lastSeenPrivacy 
            : 'contacts';

        // Create settings object
        const settings = {
            enabled: Boolean(enabled),
            showReadReceipts: Boolean(showReadReceipts),
            lastSeenPrivacy: privacySetting,
            userId,
            presence: {
                showTyping: true,
                showRecording: true,
                showOnline: enabled,
                updateInterval: enabled ? 30 : 0 // Seconds between presence updates
            },
            privacy: {
                profilePhoto: 'contacts',
                about: 'everyone',
                status: 'contacts',
                groups: 'contacts'
            },
            automation: {
                autoReplyWhenAway: true,
                awayMessages: [
                    "I'm currently away, but I'll respond soon!",
                    "Thanks for your message. I'll get back to you.",
                    "Away from keyboard. Will reply shortly."
                ],
                workingHours: {
                    enabled: false,
                    start: "09:00",
                    end: "17:00",
                    timezone: "UTC"
                }
            },
            lastUpdated: new Date().toISOString(),
            features: {
                simulateTyping: enabled,
                simulateOnline: enabled,
                preventSleep: enabled
            }
        };

        // Simulate save to database
        const saveResult = {
            success: true,
            settingsId: `online_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            savedAt: new Date().toISOString()
        };

        return createSuccessResponse({
            status: enabled ? 'ONLINE' : 'OFFLINE',
            settings: settings,
            saveResult: saveResult,
            message: `Always online ${enabled ? 'enabled' : 'disabled'}. Privacy: ${privacySetting}, Read receipts: ${showReadReceipts}`
        });

    } catch (error) {
        console.error('alwaysonlineFunction Error:', error);
        return createErrorResponse('SETTINGS_UPDATE_FAILED', error.message);
    }
}

module.exports = alwaysonlineFunction;
