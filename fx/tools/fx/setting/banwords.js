// fx/settings/banwords.js
const { createSuccessResponse, createErrorResponse } = require('../../lib/response');

/**
 * Banned words filter settings
 * Input: { enabled, words, action, exemptAdmins, userId, groupId }
 * Output: { status, settings }
 */
async function banwordsFunction(request) {
    try {
        const { data } = request;
        const { enabled, words = [], action = 'delete', exemptAdmins = true, userId, groupId } = data;

        // Validate required fields
        if (enabled === undefined || !groupId) {
            return createErrorResponse('VALIDATION_ERROR', 'Missing required fields: enabled, groupId');
        }

        // Validate action
        const validActions = ['warn', 'delete', 'mute', 'kick'];
        const selectedAction = validActions.includes(action) ? action : 'delete';

        // Format and validate words list
        const formattedWords = Array.isArray(words) 
            ? words
                .slice(0, 200) // Limit to 200 words
                .map(word => word.toLowerCase().trim())
                .filter(word => word.length > 0 && word.length <= 50)
            : [];

        // Add common banned words if list is empty
        const defaultBannedWords = [
            'spam', 'scam', 'hack', 'cheat', 'virus', 'malware',
            'phishing', 'fraud', 'advertise', 'promote', 'sell'
        ];

        const finalWords = formattedWords.length > 0 
            ? [...new Set([...formattedWords, ...defaultBannedWords])] // Remove duplicates
            : defaultBannedWords;

        // Create settings object
        const settings = {
            enabled: Boolean(enabled),
            action: selectedAction,
            exemptAdmins: Boolean(exemptAdmins),
            userId,
            groupId,
            wordList: {
                bannedWords: finalWords,
                regexPatterns: finalWords.map(word => 
                    word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                ),
                useRegex: false,
                caseSensitive: false,
                detectVariations: true, // Detect l33t speak, etc.
                detectHidden: true // Detect words with symbols between letters
            },
            filters: {
                checkMessages: true,
                checkNicknames: true,
                checkStatus: false,
                checkBio: false,
                ignoreLinks: true,
                ignoreCommands: true
            },
            punishments: {
                [selectedAction]: {
                    duration: selectedAction === 'mute' ? 3600 : 0,
                    maxViolations: 3,
                    escalation: ['warn', 'delete', 'mute', 'kick']
                }
            },
            intelligence: {
                learnNewWords: true,
                autoUpdate: true,
                communityReports: true,
                similarityThreshold: 0.8
            },
            statistics: {
                violations: 0,
                wordsBlocked: 0,
                lastViolation: null,
                mostBlockedWord: null
            },
            lastUpdated: new Date().toISOString()
        };

        // Simulate save to database
        const saveResult = {
            success: true,
            settingsId: `banwords_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            savedAt: new Date().toISOString()
        };

        return createSuccessResponse({
            status: enabled ? 'ACTIVE' : 'INACTIVE',
            settings: settings,
            saveResult: saveResult,
            message: `Banned words filter ${enabled ? 'enabled' : 'disabled'}. Action: ${selectedAction}, Words: ${finalWords.length}`
        });

    } catch (error) {
        console.error('banwordsFunction Error:', error);
        return createErrorResponse('SETTINGS_UPDATE_FAILED', error.message);
    }
}

module.exports = banwordsFunction;
