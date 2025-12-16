// lib/validation.js
const validator = require('validator');

class ValidationError extends Error {
    constructor(message, code, field = null) {
        super(message);
        this.name = 'ValidationError';
        this.code = code;
        this.field = field;
        this.timestamp = new Date().toISOString();
    }
}

/**
 * Input Validation Utilities
 * Centralized validation for all function inputs
 */
class Validator {
    constructor() {
        // Common regex patterns
        this.patterns = {
            phone: /^\+?[\d\s\-\(\)]{10,}$/,
            email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            url: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
            username: /^[a-zA-Z0-9_]{3,30}$/,
            password: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/,
            hexColor: /^#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/,
            base64: /^[A-Za-z0-9+/]*={0,2}$/,
            jwt: /^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/,
            ipAddress: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
            macAddress: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
            youtubeId: /^[a-zA-Z0-9_-]{11}$/,
            instagramUrl: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9_\.]+)/,
            tiktokUrl: /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([A-Za-z0-9_\.]+)/,
            bibleReference: /^[1-3]?\s?[A-Za-z]+\s\d+:\d+(-\d+)?$/,
            currencyCode: /^[A-Z]{3}$/,
            languageCode: /^[a-z]{2}(-[A-Z]{2})?$/,
            timezone: /^[A-Za-z_]+\/[A-Za-z_]+$/,
            uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        };

        // Common validation rules
        this.rules = {
            required: (value) => value !== undefined && value !== null && value !== '',
            minLength: (value, length) => String(value).length >= length,
            maxLength: (value, length) => String(value).length <= length,
            minValue: (value, min) => Number(value) >= min,
            maxValue: (value, max) => Number(value) <= max,
            inRange: (value, min, max) => Number(value) >= min && Number(value) <= max,
            isInteger: (value) => Number.isInteger(Number(value)),
            isFloat: (value) => !isNaN(parseFloat(value)) && isFinite(value),
            isPositive: (value) => Number(value) > 0,
            isNegative: (value) => Number(value) < 0,
            isZero: (value) => Number(value) === 0,
            matches: (value, pattern) => pattern.test(String(value)),
            isIn: (value, array) => array.includes(value),
            notIn: (value, array) => !array.includes(value),
            isEqual: (value, compare) => value === compare,
            notEqual: (value, compare) => value !== compare,
            isTruthy: (value) => Boolean(value),
            isFalsy: (value) => !Boolean(value)
        };
    }

    /**
     * Validate request structure
     */
    validateRequest(request, requiredFields = []) {
        if (!request || typeof request !== 'object') {
            throw new ValidationError('Request must be an object', 'INVALID_REQUEST');
        }

        // Check required fields
        for (const field of requiredFields) {
            if (!request.hasOwnProperty(field)) {
                throw new ValidationError(`Missing required field: ${field}`, 'MISSING_FIELD', field);
            }
        }

        // Check data field specifically
        if (request.data && typeof request.data !== 'object') {
            throw new ValidationError('data field must be an object', 'INVALID_DATA', 'data');
        }

        // Check metadata field
        if (request.metadata && typeof request.metadata !== 'object') {
            throw new ValidationError('metadata field must be an object', 'INVALID_METADATA', 'metadata');
        }

        return true;
    }

    /**
     * Validate input data against schema
     */
    validateSchema(data, schema) {
        const errors = [];

        for (const [field, rules] of Object.entries(schema)) {
            const value = data[field];
            const isRequired = rules.required !== false;

            // Skip if not required and value is empty
            if (!isRequired && (value === undefined || value === null || value === '')) {
                continue;
            }

            // Check required
            if (isRequired && (value === undefined || value === null || value === '')) {
                errors.push({
                    field,
                    error: 'Field is required',
                    code: 'REQUIRED'
                });
                continue;
            }

            // Type validation
            if (rules.type) {
                let isValidType = false;
                
                switch (rules.type) {
                    case 'string':
                        isValidType = typeof value === 'string';
                        break;
                    case 'number':
                        isValidType = typeof value === 'number' || !isNaN(Number(value));
                        break;
                    case 'boolean':
                        isValidType = typeof value === 'boolean' || value === 'true' || value === 'false';
                        break;
                    case 'array':
                        isValidType = Array.isArray(value);
                        break;
                    case 'object':
                        isValidType = typeof value === 'object' && value !== null && !Array.isArray(value);
                        break;
                    case 'buffer':
                        isValidType = Buffer.isBuffer(value) || (typeof value === 'string' && this.patterns.base64.test(value));
                        break;
                    case 'date':
                        isValidType = !isNaN(Date.parse(value));
                        break;
                }

                if (!isValidType) {
                    errors.push({
                        field,
                        error: `Field must be of type ${rules.type}`,
                        code: 'INVALID_TYPE'
                    });
                    continue;
                }
            }

            // String validations
            if (typeof value === 'string') {
                if (rules.minLength && !this.rules.minLength(value, rules.minLength)) {
                    errors.push({
                        field,
                        error: `Minimum length is ${rules.minLength}`,
                        code: 'MIN_LENGTH'
                    });
                }

                if (rules.maxLength && !this.rules.maxLength(value, rules.maxLength)) {
                    errors.push({
                        field,
                        error: `Maximum length is ${rules.maxLength}`,
                        code: 'MAX_LENGTH'
                    });
                }

                if (rules.pattern && !this.rules.matches(value, rules.pattern)) {
                    errors.push({
                        field,
                        error: 'Value does not match required pattern',
                        code: 'PATTERN_MISMATCH'
                    });
                }

                if (rules.enum && !this.rules.isIn(value, rules.enum)) {
                    errors.push({
                        field,
                        error: `Value must be one of: ${rules.enum.join(', ')}`,
                        code: 'NOT_IN_ENUM'
                    });
                }

                // Special validators
                if (rules.isEmail && !validator.isEmail(value)) {
                    errors.push({
                        field,
                        error: 'Invalid email address',
                        code: 'INVALID_EMAIL'
                    });
                }

                if (rules.isURL && !validator.isURL(value, { require_protocol: false })) {
                    errors.push({
                        field,
                        error: 'Invalid URL',
                        code: 'INVALID_URL'
                    });
                }

                if (rules.isPhone && !this.patterns.phone.test(value.replace(/\s/g, ''))) {
                    errors.push({
                        field,
                        error: 'Invalid phone number',
                        code: 'INVALID_PHONE'
                    });
                }

                if (rules.isBase64 && !validator.isBase64(value)) {
                    errors.push({
                        field,
                        error: 'Invalid base64 string',
                        code: 'INVALID_BASE64'
                    });
                }

                if (rules.isHexColor && !this.patterns.hexColor.test(value)) {
                    errors.push({
                        field,
                        error: 'Invalid hex color',
                        code: 'INVALID_HEX_COLOR'
                    });
                }

                if (rules.isIP && !validator.isIP(value)) {
                    errors.push({
                        field,
                        error: 'Invalid IP address',
                        code: 'INVALID_IP'
                    });
                }

                if (rules.isJWT && !this.patterns.jwt.test(value)) {
                    errors.push({
                        field,
                        error: 'Invalid JWT token',
                        code: 'INVALID_JWT'
                    });
                }

                if (rules.isUUID && !this.patterns.uuid.test(value)) {
                    errors.push({
                        field,
                        error: 'Invalid UUID',
                        code: 'INVALID_UUID'
                    });
                }

                if (rules.isAlpha && !validator.isAlpha(value.replace(/[\s\-_]/g, ''))) {
                    errors.push({
                        field,
                        error: 'Must contain only letters',
                        code: 'NOT_ALPHA'
                    });
                }

                if (rules.isAlphanumeric && !validator.isAlphanumeric(value.replace(/[\s\-_]/g, ''))) {
                    errors.push({
                        field,
                        error: 'Must contain only letters and numbers',
                        code: 'NOT_ALPHANUMERIC'
                    });
                }

                if (rules.isLowercase && !validator.isLowercase(value)) {
                    errors.push({
                        field,
                        error: 'Must be lowercase',
                        code: 'NOT_LOWERCASE'
                    });
                }

                if (rules.isUppercase && !validator.isUppercase(value)) {
                    errors.push({
                        field,
                        error: 'Must be uppercase',
                        code: 'NOT_UPPERCASE'
                    });
                }
            }

            // Number validations
            if (typeof value === 'number' || !isNaN(Number(value))) {
                const numValue = Number(value);

                if (rules.min !== undefined && !this.rules.minValue(numValue, rules.min)) {
                    errors.push({
                        field,
                        error: `Minimum value is ${rules.min}`,
                        code: 'MIN_VALUE'
                    });
                }

                if (rules.max !== undefined && !this.rules.maxValue(numValue, rules.max)) {
                    errors.push({
                        field,
                        error: `Maximum value is ${rules.max}`,
                        code: 'MAX_VALUE'
                    });
                }

                if (rules.isInteger && !this.rules.isInteger(numValue)) {
                    errors.push({
                        field,
                        error: 'Must be an integer',
                        code: 'NOT_INTEGER'
                    });
                }

                if (rules.isPositive && !this.rules.isPositive(numValue)) {
                    errors.push({
                        field,
                        error: 'Must be positive',
                        code: 'NOT_POSITIVE'
                    });
                }

                if (rules.isNegative && !this.rules.isNegative(numValue)) {
                    errors.push({
                        field,
                        error: 'Must be negative',
                        code: 'NOT_NEGATIVE'
                    });
                }
            }

            // Array validations
            if (Array.isArray(value)) {
                if (rules.minItems && value.length < rules.minItems) {
                    errors.push({
                        field,
                        error: `Minimum ${rules.minItems} items required`,
                        code: 'MIN_ITEMS'
                    });
                }

                if (rules.maxItems && value.length > rules.maxItems) {
                    errors.push({
                        field,
                        error: `Maximum ${rules.maxItems} items allowed`,
                        code: 'MAX_ITEMS'
                    });
                }

                if (rules.uniqueItems && new Set(value).size !== value.length) {
                    errors.push({
                        field,
                        error: 'All items must be unique',
                        code: 'DUPLICATE_ITEMS'
                    });
                }

                // Validate each item if itemSchema is provided
                if (rules.itemSchema) {
                    for (let i = 0; i < value.length; i++) {
                        try {
                            this.validateSchema({ item: value[i] }, { item: rules.itemSchema });
                        } catch (itemError) {
                            errors.push({
                                field: `${field}[${i}]`,
                                error: itemError.message,
                                code: itemError.code
                            });
                        }
                    }
                }
            }

            // Object validations
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                if (rules.properties) {
                    const nestedErrors = this.validateSchema(value, rules.properties);
                    if (nestedErrors.length > 0) {
                        errors.push(...nestedErrors.map(e => ({
                            field: `${field}.${e.field}`,
                            error: e.error,
                            code: e.code
                        })));
                    }
                }
            }

            // Custom validation function
            if (rules.validate && typeof rules.validate === 'function') {
                try {
                    const result = rules.validate(value, data);
                    if (result !== true) {
                        errors.push({
                            field,
                            error: result || 'Custom validation failed',
                            code: 'CUSTOM_VALIDATION'
                        });
                    }
                } catch (error) {
                    errors.push({
                        field,
                        error: error.message,
                        code: 'CUSTOM_VALIDATION_ERROR'
                    });
                }
            }
        }

        if (errors.length > 0) {
            const validationError = new ValidationError('Validation failed', 'VALIDATION_FAILED');
            validationError.details = errors;
            throw validationError;
        }

        return true;
    }

    /**
     * Common validation schemas
     */
    getCommonSchemas() {
        return {
            user: {
                userId: { type: 'string', required: true, minLength: 1, maxLength: 100 },
                username: { type: 'string', minLength: 3, maxLength: 30, pattern: this.patterns.username },
                email: { type: 'string', isEmail: true },
                phone: { type: 'string', isPhone: true },
                age: { type: 'number', min: 0, max: 150 },
                isActive: { type: 'boolean' }
            },

            media: {
                buffer: { type: 'buffer', required: true },
                filename: { type: 'string', required: true, maxLength: 255 },
                mimeType: { type: 'string', required: true },
                size: { type: 'number', required: true, min: 1, max: 100 * 1024 * 1024 }
            },

            message: {
                text: { type: 'string', maxLength: 4096 },
                media: { type: 'object', properties: this.getCommonSchemas().media },
                sender: { type: 'string', required: true },
                recipient: { type: 'string', required: true },
                timestamp: { type: 'string', required: true }
            },

            group: {
                groupId: { type: 'string', required: true, minLength: 1, maxLength: 100 },
                name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
                description: { type: 'string', maxLength: 500 },
                isPublic: { type: 'boolean' },
                memberCount: { type: 'number', min: 1, max: 100000 }
            },

            location: {
                latitude: { type: 'number', required: true, min: -90, max: 90 },
                longitude: { type: 'number', required: true, min: -180, max: 180 },
                accuracy: { type: 'number', min: 0 },
                name: { type: 'string', maxLength: 100 },
                address: { type: 'string', maxLength: 500 }
            }
        };
    }

    /**
     * Sanitize input
     */
    sanitize(input, options = {}) {
        if (typeof input === 'string') {
            let sanitized = input;
            
            // Trim whitespace
            sanitized = sanitized.trim();
            
            // Remove script tags
            sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            
            // Remove dangerous characters
            if (options.removeSpecialChars) {
                sanitized = sanitized.replace(/[<>"'`;]/g, '');
            }
            
            // Escape HTML
            if (options.escapeHTML) {
                sanitized = sanitized
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
            }
            
            // Limit length
            if (options.maxLength && sanitized.length > options.maxLength) {
                sanitized = sanitized.substring(0, options.maxLength);
            }
            
            return sanitized;
        }
        
        return input;
    }

    /**
     * Validate image buffer
     */
    validateImageBuffer(buffer) {
        if (!Buffer.isBuffer(buffer)) {
            return { valid: false, message: 'Input is not a valid buffer' };
        }
        
        if (buffer.length === 0) {
            return { valid: false, message: 'Buffer is empty' };
        }
        
        // Check minimum size (100 bytes)
        if (buffer.length < 100) {
            return { valid: false, message: 'Buffer too small to be a valid image' };
        }
        
        // Check maximum size (20MB)
        if (buffer.length > 20 * 1024 * 1024) {
            return { valid: false, message: 'Image exceeds maximum size of 20MB' };
        }
        
        // Check magic bytes for common image formats
        const hex = buffer.toString('hex', 0, 4);
        const validMagicBytes = [
            'ffd8ff', // JPEG
            '89504e47', // PNG
            '47494638', // GIF
            '52494646' // WEBP (needs additional check)
        ];
        
        const isValidMagic = validMagicBytes.some(magic => hex.startsWith(magic));
        
        // Additional check for WEBP
        if (hex.startsWith('52494646') && buffer.length > 12) {
            const webpHeader = buffer.toString('ascii', 8, 12);
            if (webpHeader === 'WEBP') {
                return { valid: true, message: 'Valid WEBP image' };
            }
        }
        
        if (!isValidMagic) {
            return { valid: false, message: 'Buffer does not contain valid image data' };
        }
        
        return { valid: true, message: 'Valid image buffer' };
    }

    /**
     * Validate URL
     */
    validateURL(url, options = {}) {
        if (!url || typeof url !== 'string') {
            return { valid: false, message: 'URL must be a string' };
        }
        
        // Check length
        if (url.length > 2048) {
            return { valid: false, message: 'URL too long' };
        }
        
        // Basic URL pattern
        if (!this.patterns.url.test(url)) {
            return { valid: false, message: 'Invalid URL format' };
        }
        
        // Check protocol if required
        if (options.requireProtocol && !url.startsWith('http://') && !url.startsWith('https://')) {
            return { valid: false, message: 'URL must start with http:// or https://' };
        }
        
        // Check allowed domains
        if (options.allowedDomains && Array.isArray(options.allowedDomains)) {
            const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
            const isAllowed = options.allowedDomains.some(allowed => 
                domain === allowed || domain.endsWith(`.${allowed}`)
            );
            
            if (!isAllowed) {
                return { valid: false, message: 'Domain not allowed' };
            }
        }
        
        // Check blocked domains
        if (options.blockedDomains && Array.isArray(options.blockedDomains)) {
            const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
            const isBlocked = options.blockedDomains.some(blocked => 
                domain === blocked || domain.endsWith(`.${blocked}`)
            );
            
            if (isBlocked) {
                return { valid: false, message: 'Domain is blocked' };
            }
        }
        
        return { valid: true, message: 'Valid URL' };
    }

    /**
     * Validate email
     */
    validateEmail(email) {
        if (!email || typeof email !== 'string') {
            return { valid: false, message: 'Email must be a string' };
        }
        
        if (!validator.isEmail(email)) {
            return { valid: false, message: 'Invalid email format' };
        }
        
        // Check length
        if (email.length > 254) {
            return { valid: false, message: 'Email too long' };
        }
        
        // Check for disposable emails
        const disposableDomains = ['tempmail.com', 'mailinator.com', 'guerrillamail.com'];
        const domain = email.split('@')[1];
        if (disposableDomains.includes(domain)) {
            return { valid: false, message: 'Disposable email not allowed' };
        }
        
        return { valid: true, message: 'Valid email' };
    }

    /**
     * Validate phone number
     */
    validatePhone(phone) {
        if (!phone || typeof phone !== 'string') {
            return { valid: false, message: 'Phone must be a string' };
        }
        
        // Remove all non-digit characters except leading +
        const cleanPhone = phone.replace(/[^\d+]/g, '');
        
        if (!this.patterns.phone.test(cleanPhone)) {
            return { valid: false, message: 'Invalid phone number format' };
        }
        
        // Check length (including country code)
        if (cleanPhone.length < 10 || cleanPhone.length > 15) {
            return { valid: false, message: 'Phone number length invalid' };
        }
        
        return { valid: true, message: 'Valid phone number' };
    }

    /**
     * Validate date
     */
    validateDate(dateString, options = {}) {
        if (!dateString || typeof dateString !== 'string') {
            return { valid: false, message: 'Date must be a string' };
        }
        
        const date = new Date(dateString);
        
        if (isNaN(date.getTime())) {
            return { valid: false, message: 'Invalid date format' };
        }
        
        if (options.minDate) {
            const minDate = new Date(options.minDate);
            if (date < minDate) {
                return { valid: false, message: `Date must be after ${options.minDate}` };
            }
        }
        
        if (options.maxDate) {
            const maxDate = new Date(options.maxDate);
            if (date > maxDate) {
                return { valid: false, message: `Date must be before ${options.maxDate}` };
            }
        }
        
        if (options.futureOnly && date <= new Date()) {
            return { valid: false, message: 'Date must be in the future' };
        }
        
        if (options.pastOnly && date >= new Date()) {
            return { valid: false, message: 'Date must be in the past' };
        }
        
        return { valid: true, message: 'Valid date' };
    }
}

// Export singleton instance
module.exports = new Validator();
