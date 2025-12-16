// lib/response.js
class ResponseError extends Error {
    constructor(message, code, details = null) {
        super(message);
        this.name = 'ResponseError';
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

/**
 * Standardized Response Format Utilities
 * Ensures all functions return consistent response structure
 */
class ResponseBuilder {
    constructor() {
        // Standard error codes
        this.errorCodes = {
            // Validation errors (1000-1099)
            VALIDATION_ERROR: 1000,
            MISSING_FIELD: 1001,
            INVALID_TYPE: 1002,
            INVALID_FORMAT: 1003,
            OUT_OF_RANGE: 1004,
            
            // Authentication errors (1100-1199)
            UNAUTHORIZED: 1100,
            FORBIDDEN: 1101,
            INVALID_TOKEN: 1102,
            EXPIRED_TOKEN: 1103,
            
            // Resource errors (1200-1299)
            NOT_FOUND: 1200,
            ALREADY_EXISTS: 1201,
            CONFLICT: 1202,
            LIMIT_EXCEEDED: 1203,
            
            // API errors (1300-1399)
            API_ERROR: 1300,
            RATE_LIMITED: 1301,
            SERVICE_UNAVAILABLE: 1302,
            TIMEOUT: 1303,
            
            // Media errors (1400-1499)
            MEDIA_ERROR: 1400,
            FILE_TOO_LARGE: 1401,
            UNSUPPORTED_FORMAT: 1402,
            PROCESSING_ERROR: 1403,
            
            // Database errors (1500-1599)
            DATABASE_ERROR: 1500,
            CONNECTION_ERROR: 1501,
            QUERY_ERROR: 1502,
            
            // Network errors (1600-1699)
            NETWORK_ERROR: 1600,
            CONNECTION_REFUSED: 1601,
            DNS_ERROR: 1602,
            
            // System errors (1700-1799)
            INTERNAL_ERROR: 1700,
            CONFIGURATION_ERROR: 1701,
            DEPENDENCY_ERROR: 1702,
            
            // Custom errors (1800-1899)
            CUSTOM_ERROR: 1800
        };

        // Standard HTTP status codes mapping
        this.statusCodes = {
            1000: 400, // Bad Request
            1100: 401, // Unauthorized
            1101: 403, // Forbidden
            1200: 404, // Not Found
            1201: 409, // Conflict
            1301: 429, // Too Many Requests
            1302: 503, // Service Unavailable
            1700: 500  // Internal Server Error
        };
    }

    /**
     * Create success response
     */
    createSuccessResponse(data, message = 'Operation completed successfully', metadata = {}) {
        const response = {
            success: true,
            timestamp: new Date().toISOString(),
            message,
            data: data || null,
            metadata: {
                ...metadata,
                version: process.env.APP_VERSION || '1.0.0',
                environment: process.env.NODE_ENV || 'development'
            },
            error: null
        };

        // Add pagination info if present
        if (data && data.pagination) {
            response.pagination = data.pagination;
            delete response.data.pagination;
        }

        // Add execution time if provided
        if (metadata.executionTime) {
            response.metadata.executionTime = metadata.executionTime;
        }

        return response;
    }

    /**
     * Create error response
     */
    createErrorResponse(code, message, details = null, httpStatus = null) {
        const errorCode = typeof code === 'string' 
            ? (this.errorCodes[code] || this.errorCodes.CUSTOM_ERROR)
            : code;

        const response = {
            success: false,
            timestamp: new Date().toISOString(),
            message,
            data: null,
            metadata: {
                version: process.env.APP_VERSION || '1.0.0',
                environment: process.env.NODE_ENV || 'development'
            },
            error: {
                code: errorCode,
                message,
                details,
                timestamp: new Date().toISOString(),
                httpStatus: httpStatus || this.statusCodes[errorCode] || 500
            }
        };

        return response;
    }

    /**
     * Create paginated response
     */
    createPaginatedResponse(data, page, limit, total, metadata = {}) {
        const totalPages = Math.ceil(total / limit);
        
        const pagination = {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
            nextPage: page < totalPages ? page + 1 : null,
            prevPage: page > 1 ? page - 1 : null
        };

        return this.createSuccessResponse(
            data,
            'Paginated results retrieved successfully',
            {
                ...metadata,
                pagination
            }
        );
    }

    /**
     * Create media response
     */
    createMediaResponse(mediaData, metadata = {}) {
        const response = {
            success: true,
            timestamp: new Date().toISOString(),
            message: 'Media processed successfully',
            data: {
                media: mediaData.buffer ? mediaData.buffer.toString('base64') : null,
                url: mediaData.url || null,
                filename: mediaData.filename,
                mimeType: mediaData.mimeType,
                size: mediaData.size,
                dimensions: mediaData.dimensions || null,
                format: mediaData.format,
                duration: mediaData.duration || null,
                metadata: mediaData.metadata || {}
            },
            metadata: {
                ...metadata,
                mediaType: mediaData.mimeType?.split('/')[0] || 'unknown',
                processedAt: new Date().toISOString()
            },
            error: null
        };

        return response;
    }

    /**
     * Create text response
     */
    createTextResponse(text, metadata = {}) {
        return this.createSuccessResponse(
            { text },
            'Text processed successfully',
            {
                ...metadata,
                textLength: text.length,
                wordCount: text.split(/\s+/).length,
                processedAt: new Date().toISOString()
            }
        );
    }

    /**
     * Create list response
     */
    createListResponse(items, metadata = {}) {
        return this.createSuccessResponse(
            { items },
            'List retrieved successfully',
            {
                ...metadata,
                count: items.length,
                type: Array.isArray(items) ? 'array' : typeof items,
                processedAt: new Date().toISOString()
            }
        );
    }

    /**
     * Create file download response
     */
    createFileDownloadResponse(fileInfo, metadata = {}) {
        return {
            success: true,
            timestamp: new Date().toISOString(),
            message: 'File ready for download',
            data: {
                fileId: fileInfo.fileId,
                filename: fileInfo.filename,
                originalName: fileInfo.originalName,
                size: fileInfo.size,
                mimeType: fileInfo.mimeType,
                downloadUrl: fileInfo.downloadUrl,
                expiresAt: fileInfo.expiresAt,
                directUrl: `/api/download/${fileInfo.fileId}`
            },
            metadata: {
                ...metadata,
                expiresIn: new Date(fileInfo.expiresAt) - new Date(),
                downloadCount: 0
            },
            error: null
        };
    }

    /**
     * Create AI response
     */
    createAIResponse(content, model = 'unknown', metadata = {}) {
        return this.createSuccessResponse(
            { content },
            'AI response generated successfully',
            {
                ...metadata,
                model,
                tokens: content.length / 4, // Rough estimate
                generatedAt: new Date().toISOString(),
                aiProvider: metadata.provider || 'unknown'
            }
        );
    }

    /**
     * Create settings response
     */
    createSettingsResponse(settings, action = 'updated', metadata = {}) {
        return this.createSuccessResponse(
            { settings },
            `Settings ${action} successfully`,
            {
                ...metadata,
                appliedAt: new Date().toISOString(),
                requiresRestart: metadata.requiresRestart || false
            }
        );
    }

    /**
     * Wrap async function with standardized response
     */
    async wrapAsync(fn, context = {}) {
        const startTime = Date.now();
        
        try {
            const result = await fn();
            const executionTime = Date.now() - startTime;
            
            if (result && result.success === false) {
                return result; // Already an error response
            }
            
            return this.createSuccessResponse(result, context.successMessage || 'Success', {
                ...context.metadata,
                executionTime
            });
            
        } catch (error) {
            const executionTime = Date.now() - startTime;
            
            // Handle known error types
            if (error.name === 'ValidationError') {
                return this.createErrorResponse(
                    'VALIDATION_ERROR',
                    error.message,
                    error.details || null,
                    400
                );
            }
            
            if (error.name === 'APIError') {
                return this.createErrorResponse(
                    'API_ERROR',
                    error.message,
                    { originalError: error.originalError?.message },
                    502
                );
            }
            
            if (error.name === 'MediaError') {
                return this.createErrorResponse(
                    'MEDIA_ERROR',
                    error.message,
                    null,
                    400
                );
            }
            
            if (error.name === 'StorageError') {
                return this.createErrorResponse(
                    'INTERNAL_ERROR',
                    error.message,
                    null,
                    500
                );
            }
            
            // Default error response
            return this.createErrorResponse(
                'INTERNAL_ERROR',
                error.message || 'An unexpected error occurred',
                {
                    executionTime,
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                },
                500
            );
        }
    }

    /**
     * Validate response structure
     */
    isValidResponse(response) {
        if (!response || typeof response !== 'object') {
            return false;
        }

        const requiredFields = ['success', 'timestamp', 'message'];
        for (const field of requiredFields) {
            if (!response.hasOwnProperty(field)) {
                return false;
            }
        }

        if (typeof response.success !== 'boolean') {
            return false;
        }

        if (response.success === false && (!response.error || typeof response.error !== 'object')) {
            return false;
        }

        if (response.success === true && response.data === undefined) {
            return false;
        }

        return true;
    }

    /**
     * Merge multiple responses
     */
    mergeResponses(responses, operation = 'batch') {
        const successful = responses.filter(r => r.success);
        const failed = responses.filter(r => !r.success);
        
        const mergedData = successful.reduce((acc, response) => {
            if (response.data) {
                Object.assign(acc, response.data);
            }
            return acc;
        }, {});
        
        const response = this.createSuccessResponse(
            mergedData,
            `${operation} completed with ${successful.length} success${successful.length !== 1 ? 'es' : ''} and ${failed.length} failure${failed.length !== 1 ? 's' : ''}`,
            {
                total: responses.length,
                successful: successful.length,
                failed: failed.length,
                failures: failed.map(f => f.error)
            }
        );
        
        return response;
    }

    /**
     * Create redirect response
     */
    createRedirectResponse(url, message = 'Redirecting...', permanent = false) {
        return {
            success: true,
            timestamp: new Date().toISOString(),
            message,
            data: { redirectTo: url },
            metadata: {
                redirect: true,
                permanent,
                statusCode: permanent ? 301 : 302
            },
            error: null
        };
    }

    /**
     * Create empty response
     */
    createEmptyResponse(message = 'No data found') {
        return this.createSuccessResponse(
            null,
            message,
            { isEmpty: true }
        );
    }

    /**
     * Create validation error response
     */
    createValidationErrorResponse(errors, message = 'Validation failed') {
        return this.createErrorResponse(
            'VALIDATION_ERROR',
            message,
            { errors },
            400
        );
    }

    /**
     * Create rate limit response
     */
    createRateLimitResponse(retryAfter = 60, message = 'Rate limit exceeded') {
        return this.createErrorResponse(
            'RATE_LIMITED',
            message,
            { retryAfter },
            429
        );
    }
}

// Export singleton instance
module.exports = new ResponseBuilder();
