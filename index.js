// index.js - Main Express Server for Nethunter Functions
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('rate-limiter-flexible');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs').promises;

// Load environment variables
dotenv.config();

// Import response builder
const { createErrorResponse, createSuccessResponse } = require('/lib/response');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Rate limiting
const rateLimiter = new rateLimit.RateLimiterMemory({
    points: 100, // 100 requests
    duration: 60, // per 60 seconds
    blockDuration: 300 // block for 5 minutes if exceeded
});

// Apply rate limiting middleware
const rateLimiterMiddleware = async (req, res, next) => {
    try {
        const clientIP = req.ip || req.connection.remoteAddress;
        await rateLimiter.consume(clientIP);
        next();
    } catch (error) {
        res.status(429).json({
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests, please try again later',
                retryAfter: Math.ceil(error.msBeforeNext / 1000) || 60
            }
        });
    }
};

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = process.env.ALLOWED_ORIGINS 
            ? process.env.ALLOWED_ORIGINS.split(',') 
            : ['*'];
        
        if (allowedOrigins.includes('*') || !origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    credentials: true,
    maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
        req.rawBody = buf.toString();
    }
}));

app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb' 
}));

// Compression
app.use(compression({
    level: 6,
    threshold: 100 * 1024 // Compress responses larger than 100KB
}));

// Logging
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

// Static files (for temp file downloads)
app.use('/temp', express.static(path.join(__dirname, 'temp'), {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
        res.set('X-Content-Type-Options', 'nosniff');
    }
}));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'nethunter-fx',
        version: process.env.npm_package_version || '1.0.0',
        environment: NODE_ENV,
        uptime: process.uptime()
    });
});

// Function loader cache
const functionCache = new Map();

/**
 * Load a function dynamically from the fx/ directory
 */
async function loadFunction(category, functionName) {
    const cacheKey = `${category}:${functionName}`;
    
    // Check cache first
    if (functionCache.has(cacheKey)) {
        return functionCache.get(cacheKey);
    }
    
    try {
        const functionPath = path.join(__dirname, 'fx', category, `${functionName}.js`);
        
        // Check if file exists
        try {
            await fs.access(functionPath);
        } catch {
            throw new Error(`Function ${functionName} not found in category ${category}`);
        }
        
        // Load the module
        const functionModule = require(functionPath);
        
        // Validate the function
        if (typeof functionModule !== 'function') {
            throw new Error(`Invalid function export in ${category}/${functionName}.js`);
        }
        
        // Cache the function
        functionCache.set(cacheKey, functionModule);
        
        return functionModule;
    } catch (error) {
        console.error(`Failed to load function ${category}/${functionName}:`, error);
        throw error;
    }
}

/**
 * Get all available functions (for discovery)
 */
async function getAvailableFunctions() {
    const functions = {};
    const basePath = path.join(__dirname, 'fx');
    
    try {
        const categories = await fs.readdir(basePath);
        
        for (const category of categories) {
            const categoryPath = path.join(basePath, category);
            const stat = await fs.stat(categoryPath);
            
            if (stat.isDirectory()) {
                const files = await fs.readdir(categoryPath);
                const functionFiles = files.filter(file => file.endsWith('.js'));
                
                functions[category] = functionFiles.map(file => ({
                    name: file.replace('.js', ''),
                    path: `fx/${category}/${file}`,
                    category: category
                }));
            }
        }
        
        return functions;
    } catch (error) {
        console.error('Error scanning functions:', error);
        return {};
    }
}

/**
 * Main execution endpoint
 */
app.post('/execute', rateLimiterMiddleware, async (req, res) => {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Log request
    console.log(`[${requestId}] Execute request received`, {
        category: req.body?.category,
        function: req.body?.function,
        timestamp: new Date().toISOString()
    });
    
    try {
        // Validate request body
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json(createErrorResponse(
                'INVALID_REQUEST',
                'Request body must be a JSON object'
            ));
        }
        
        const { category, function: functionName, data = {}, metadata = {} } = req.body;
        
        // Validate required fields
        if (!category || !functionName) {
            return res.status(400).json(createErrorResponse(
                'MISSING_FIELDS',
                'Both category and function fields are required'
            ));
        }
        
        // Load the function
        const functionToExecute = await loadFunction(category, functionName);
        
        // Prepare execution context
        const executionContext = {
            requestId,
            category,
            function: functionName,
            timestamp: new Date().toISOString(),
            metadata: {
                ...metadata,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                contentType: req.get('Content-Type')
            }
        };
        
        // Create request object for the function
        const functionRequest = {
            category,
            function: functionName,
            data,
            metadata: executionContext.metadata,
            requestId,
            rawBody: req.rawBody
        };
        
        // Execute the function
        const result = await functionToExecute(functionRequest);
        
        // Validate response format
        if (!result || typeof result !== 'object') {
            throw new Error('Function must return an object');
        }
        
        // Calculate execution time
        const executionTime = Date.now() - startTime;
        
        // Add execution metadata
        result.metadata = {
            ...(result.metadata || {}),
            requestId,
            executionTime: `${executionTime}ms`,
            category,
            function: functionName,
            timestamp: new Date().toISOString(),
            cacheHit: functionCache.has(`${category}:${functionName}`)
        };
        
        // Log successful execution
        console.log(`[${requestId}] Function executed successfully`, {
            category,
            function: functionName,
            executionTime,
            success: result.success || false
        });
        
        // Return the result
        return res.status(result.error?.httpStatus || 200).json(result);
        
    } catch (error) {
        const executionTime = Date.now() - startTime;
        
        console.error(`[${requestId}] Execution failed:`, {
            error: error.message,
            stack: error.stack,
            executionTime,
            body: req.body
        });
        
        // Handle different error types
        let errorResponse;
        
        if (error.message.includes('not found')) {
            errorResponse = createErrorResponse(
                'FUNCTION_NOT_FOUND',
                `Function not found: ${req.body?.category}/${req.body?.function}`,
                { availableCategories: await getAvailableFunctions() },
                404
            );
        } else if (error.message.includes('must return an object')) {
            errorResponse = createErrorResponse(
                'INVALID_FUNCTION_RESPONSE',
                'Function returned invalid response format',
                null,
                500
            );
        } else {
            errorResponse = createErrorResponse(
                'EXECUTION_ERROR',
                error.message,
                {
                    requestId,
                    executionTime: `${executionTime}ms`,
                    stack: NODE_ENV === 'development' ? error.stack : undefined
                },
                500
            );
        }
        
        // Add execution metadata
        errorResponse.metadata = {
            ...errorResponse.metadata,
            requestId,
            executionTime: `${executionTime}ms`,
            timestamp: new Date().toISOString()
        };
        
        return res.status(errorResponse.error.httpStatus || 500).json(errorResponse);
    }
});

/**
 * Function discovery endpoint
 */
app.get('/functions', rateLimiterMiddleware, async (req, res) => {
    try {
        const functions = await getAvailableFunctions();
        
        // Count total functions
        let totalFunctions = 0;
        const functionList = [];
        
        for (const [category, funcs] of Object.entries(functions)) {
            totalFunctions += funcs.length;
            functionList.push(...funcs.map(f => ({
                name: f.name,
                category: f.category,
                endpoint: `/execute`,
                method: 'POST',
                exampleRequest: {
                    category: f.category,
                    function: f.name,
                    data: {},
                    metadata: {}
                }
            })));
        }
        
        res.status(200).json(createSuccessResponse({
            total: totalFunctions,
            categories: Object.keys(functions),
            functions: functionList,
            byCategory: functions
        }, 'Functions retrieved successfully', {
            cacheSize: functionCache.size,
            lastUpdated: new Date().toISOString()
        }));
    } catch (error) {
        res.status(500).json(createErrorResponse(
            'DISCOVERY_ERROR',
            'Failed to retrieve functions list',
            error.message
        ));
    }
});

/**
 * Function info endpoint
 */
app.get('/functions/:category/:function', rateLimiterMiddleware, async (req, res) => {
    try {
        const { category, function: functionName } = req.params;
        
        // Try to load the function
        try {
            const func = await loadFunction(category, functionName);
            
            // Get function source info
            const functionPath = path.join(__dirname, 'fx', category, `${functionName}.js`);
            const stats = await fs.stat(functionPath);
            const source = await fs.readFile(functionPath, 'utf8');
            
            // Extract function signature (first line)
            const firstLine = source.split('\n')[0];
            const isAsync = source.includes('async ');
            
            res.status(200).json(createSuccessResponse({
                name: functionName,
                category,
                path: `fx/${category}/${functionName}.js`,
                type: isAsync ? 'async function' : 'function',
                signature: firstLine.trim(),
                size: stats.size,
                modified: stats.mtime,
                cacheStatus: functionCache.has(`${category}:${functionName}`) ? 'cached' : 'not cached',
                exampleUsage: {
                    endpoint: '/execute',
                    method: 'POST',
                    requestBody: {
                        category,
                        function: functionName,
                        data: {
                            // Example data based on function name
                        },
                        metadata: {
                            timestamp: new Date().toISOString()
                        }
                    }
                }
            }, `Function ${functionName} info retrieved`));
            
        } catch (loadError) {
            res.status(404).json(createErrorResponse(
                'FUNCTION_NOT_FOUND',
                `Function ${category}/${functionName} not found`,
                { availableCategories: await getAvailableFunctions() }
            ));
        }
    } catch (error) {
        res.status(500).json(createErrorResponse(
            'INFO_ERROR',
            'Failed to get function info',
            error.message
        ));
    }
});

/**
 * Clear function cache endpoint (admin only)
 */
app.delete('/cache', rateLimiterMiddleware, async (req, res) => {
    // Check authorization
    const authHeader = req.headers.authorization;
    const adminToken = process.env.ADMIN_TOKEN;
    
    if (adminToken && (!authHeader || authHeader !== `Bearer ${adminToken}`)) {
        return res.status(403).json(createErrorResponse(
            'UNAUTHORIZED',
            'Admin token required'
        ));
    }
    
    const cacheSize = functionCache.size;
    functionCache.clear();
    
    res.status(200).json(createSuccessResponse({
        cleared: cacheSize,
        remaining: functionCache.size
    }, 'Function cache cleared successfully', {
        timestamp: new Date().toISOString()
    }));
});

/**
 * Statistics endpoint
 */
app.get('/stats', rateLimiterMiddleware, async (req, res) => {
    try {
        const functions = await getAvailableFunctions();
        const totalFunctions = Object.values(functions).reduce((sum, funcs) => sum + funcs.length, 0);
        
        // Get memory usage
        const memoryUsage = process.memoryUsage();
        
        // Get temp directory size
        let tempSize = 0;
        try {
            const tempDir = path.join(__dirname, 'temp');
            const files = await fs.readdir(tempDir);
            for (const file of files) {
                const stats = await fs.stat(path.join(tempDir, file));
                tempSize += stats.size;
            }
        } catch {
            tempSize = 0;
        }
        
        res.status(200).json(createSuccessResponse({
            service: 'nethunter-fx',
            version: process.env.npm_package_version || '1.0.0',
            environment: NODE_ENV,
            uptime: process.uptime(),
            memory: {
                rss: Math.round(memoryUsage.rss / 1024 / 1024),
                heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
                heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                external: Math.round(memoryUsage.external / 1024 / 1024)
            },
            functions: {
                total: totalFunctions,
                categories: Object.keys(functions).length,
                cached: functionCache.size
            },
            storage: {
                tempFiles: tempSize,
                tempSizeMB: Math.round(tempSize / 1024 / 1024 * 100) / 100
            },
            limits: {
                rateLimit: 100,
                rateWindow: '60 seconds',
                maxFileSize: '100MB',
                maxRequestSize: '10MB'
            }
        }, 'Service statistics', {
            timestamp: new Date().toISOString(),
            nodeVersion: process.version
        }));
    } catch (error) {
        res.status(500).json(createErrorResponse(
            'STATS_ERROR',
            'Failed to get statistics',
            error.message
        ));
    }
});

/**
 * Batch execution endpoint (execute multiple functions)
 */
app.post('/batch', rateLimiterMiddleware, async (req, res) => {
    const startTime = Date.now();
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
        if (!req.body || !Array.isArray(req.body.requests)) {
            return res.status(400).json(createErrorResponse(
                'INVALID_BATCH_REQUEST',
                'Request must contain a "requests" array'
            ));
        }
        
        const requests = req.body.requests.slice(0, 10); // Limit to 10 requests per batch
        const results = [];
        
        // Execute each request in parallel with concurrency limit
        const concurrencyLimit = 5;
        const chunks = [];
        
        for (let i = 0; i < requests.length; i += concurrencyLimit) {
            chunks.push(requests.slice(i, i + concurrencyLimit));
        }
        
        for (const chunk of chunks) {
            const chunkPromises = chunk.map(async (request, index) => {
                const requestStart = Date.now();
                
                try {
                    const { category, function: functionName, data = {} } = request;
                    
                    if (!category || !functionName) {
                        return {
                            success: false,
                            error: {
                                code: 'INVALID_REQUEST',
                                message: 'Missing category or function'
                            },
                            executionTime: Date.now() - requestStart
                        };
                    }
                    
                    const func = await loadFunction(category, functionName);
                    const result = await func({
                        category,
                        function: functionName,
                        data,
                        metadata: {
                            batchId,
                            requestIndex: index,
                            timestamp: new Date().toISOString()
                        }
                    });
                    
                    return {
                        ...result,
                        executionTime: Date.now() - requestStart
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: {
                            code: 'EXECUTION_ERROR',
                            message: error.message
                        },
                        executionTime: Date.now() - requestStart
                    };
                }
            });
            
            const chunkResults = await Promise.all(chunkPromises);
            results.push(...chunkResults);
        }
        
        const totalTime = Date.now() - startTime;
        
        res.status(200).json(createSuccessResponse({
            batchId,
            total: requests.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results
        }, 'Batch execution completed', {
            totalTime: `${totalTime}ms`,
            averageTime: `${Math.round(totalTime / requests.length)}ms`,
            concurrency: concurrencyLimit
        }));
        
    } catch (error) {
        res.status(500).json(createErrorResponse(
            'BATCH_EXECUTION_ERROR',
            'Batch execution failed',
            {
                batchId,
                error: error.message
            }
        ));
    }
});

/**
 * 404 handler
 */
app.use('*', (req, res) => {
    res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        `Route ${req.originalUrl} not found`,
        {
            availableEndpoints: [
                { path: '/health', method: 'GET', description: 'Health check' },
                { path: '/execute', method: 'POST', description: 'Execute a function' },
                { path: '/functions', method: 'GET', description: 'List all functions' },
                { path: '/batch', method: 'POST', description: 'Execute multiple functions' },
                { path: '/stats', method: 'GET', description: 'Get service statistics' }
            ]
        }
    ));
});

/**
 * Global error handler
 */
app.use((error, req, res, next) => {
    console.error('Global error handler:', {
        error: error.message,
        stack: error.stack,
        url: req.originalUrl,
        method: req.method
    });
    
    res.status(500).json(createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        'An unexpected error occurred',
        NODE_ENV === 'development' ? error.stack : undefined
    ));
});

/**
 * Start the server
 */
async function startServer() {
    try {
        // Create temp directory if it doesn't exist
        const tempDir = path.join(__dirname, 'temp');
        try {
            await fs.access(tempDir);
        } catch {
            await fs.mkdir(tempDir, { recursive: true });
            console.log('Created temp directory:', tempDir);
        }
        
        // Warm up function cache with common functions
        console.log('Warming up function cache...');
        const warmupFunctions = [
            { category: 'general', function: 'view' },
            { category: 'general', function: 'vv' },
            { category: 'tools', function: 'qr' },
            { category: 'tools', function: 'translate' }
        ];
        
        for (const { category, function: funcName } of warmupFunctions) {
            try {
                await loadFunction(category, funcName);
                console.log(`✓ Loaded ${category}/${funcName}`);
            } catch (error) {
                console.log(`✗ Failed to load ${category}/${funcName}: ${error.message}`);
            }
        }
        
        app.listen(PORT, () => {
            console.log(`
╔══════════════════════════════════════════════════════════╗
║           NETHUNTER FX SERVER STARTED                    ║
╠══════════════════════════════════════════════════════════╣
║ Server:   http://localhost:${PORT}                          ║
║ Environment: ${NODE_ENV.padEnd(30)} ║
║ Health:    http://localhost:${PORT}/health                 ║
║ Functions: http://localhost:${PORT}/functions              ║
║ Temp files: http://localhost:${PORT}/temp/[fileId]         ║
╚══════════════════════════════════════════════════════════╝
`);
            
            // Log available categories
            getAvailableFunctions().then(functions => {
                const categories = Object.keys(functions);
                console.log('\nAvailable categories:', categories.join(', '));
                
                let totalFuncs = 0;
                for (const [category, funcs] of Object.entries(functions)) {
                    console.log(`  ${category}: ${funcs.length} functions`);
                    totalFuncs += funcs.length;
                }
                
                console.log(`\nTotal functions: ${totalFuncs}`);
                console.log('\nReady to accept requests! 🚀');
            });
        });
        
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    process.exit(0);
});

// Start the server
if (require.main === module) {
    startServer();
}

module.exports = app;
