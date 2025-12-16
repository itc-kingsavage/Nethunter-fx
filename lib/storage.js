// lib/storage.js
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');

class StorageError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'StorageError';
        this.code = code;
        this.timestamp = new Date().toISOString();
    }
}

/**
 * Temporary File Storage Manager
 * Handles file operations, cleanup, and temp storage
 */
class StorageManager {
    constructor() {
        this.baseTempDir = path.join(os.tmpdir(), 'nethunter-fx');
        this.fileLifetime = 3600000; // 1 hour in milliseconds
        this.maxTotalSize = 500 * 1024 * 1024; // 500MB max total storage
        this.maxFileSize = 100 * 1024 * 1024; // 100MB per file
        this.activeFiles = new Map(); // Track active files
        
        // Initialize on creation
        this.initialize();
    }

    /**
     * Initialize storage directory
     */
    async initialize() {
        try {
            await fs.access(this.baseTempDir);
        } catch {
            await fs.mkdir(this.baseTempDir, { recursive: true });
        }
        
        // Schedule cleanup every 30 minutes
        setInterval(() => this.cleanupOldFiles(), 1800000);
        
        // Initial cleanup
        this.cleanupOldFiles();
    }

    /**
     * Create a temporary file
     */
    async createTempFile(buffer, filename, options = {}) {
        // Validate buffer
        if (!Buffer.isBuffer(buffer)) {
            throw new StorageError('Input must be a Buffer', 'INVALID_BUFFER');
        }

        // Check file size limit
        if (buffer.length > this.maxFileSize) {
            throw new StorageError(
                `File too large. Max: ${this.maxFileSize / 1024 / 1024}MB`,
                'FILE_TOO_LARGE'
            );
        }

        // Check total storage usage
        const currentUsage = await this.getStorageUsage();
        if (currentUsage.totalSize + buffer.length > this.maxTotalSize) {
            await this.cleanupOldFiles(true); // Force cleanup
        }

        // Generate unique filename
        const originalExt = path.extname(filename) || '';
        const originalName = path.basename(filename, originalExt);
        const uniqueId = crypto.randomBytes(8).toString('hex');
        const safeFilename = `${originalName}_${uniqueId}${originalExt}`.replace(/[^a-zA-Z0-9._-]/g, '_');
        
        const filePath = path.join(this.baseTempDir, safeFilename);
        
        try {
            // Write file
            await fs.writeFile(filePath, buffer);
            
            // Set file metadata
            const stats = await fs.stat(filePath);
            const fileId = crypto.randomBytes(16).toString('hex');
            
            const fileMetadata = {
                id: fileId,
                path: filePath,
                filename: safeFilename,
                originalName: filename,
                size: buffer.length,
                mimeType: options.mimeType || this.detectMimeType(filename, buffer),
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + (options.lifetime || this.fileLifetime)),
                accessCount: 0,
                lastAccessed: new Date().toISOString(),
                tags: options.tags || [],
                metadata: options.metadata || {}
            };
            
            // Store in active files map
            this.activeFiles.set(fileId, fileMetadata);
            
            // Schedule auto-delete
            setTimeout(() => this.deleteFile(fileId), fileMetadata.expiresAt - Date.now());
            
            return {
                success: true,
                fileId,
                filePath,
                filename: safeFilename,
                originalName: filename,
                size: buffer.length,
                mimeType: fileMetadata.mimeType,
                downloadUrl: `/temp/${fileId}`,
                expiresAt: fileMetadata.expiresAt,
                metadata: fileMetadata
            };
            
        } catch (error) {
            throw new StorageError(`Failed to create temp file: ${error.message}`, 'CREATE_ERROR');
        }
    }

    /**
     * Read temporary file
     */
    async readTempFile(fileId) {
        const metadata = this.activeFiles.get(fileId);
        if (!metadata) {
            throw new StorageError('File not found or expired', 'FILE_NOT_FOUND');
        }

        try {
            // Check if file exists on disk
            await fs.access(metadata.path);
            
            // Update access metadata
            metadata.accessCount++;
            metadata.lastAccessed = new Date().toISOString();
            this.activeFiles.set(fileId, metadata);
            
            // Read file
            const buffer = await fs.readFile(metadata.path);
            
            return {
                success: true,
                buffer,
                metadata: {
                    ...metadata,
                    bufferSize: buffer.length
                }
            };
            
        } catch (error) {
            // File might have been deleted externally
            this.activeFiles.delete(fileId);
            throw new StorageError('File no longer exists on disk', 'FILE_MISSING');
        }
    }

    /**
     * Delete temporary file
     */
    async deleteFile(fileId) {
        const metadata = this.activeFiles.get(fileId);
        if (!metadata) {
            return { success: false, error: 'File not found' };
        }

        try {
            await fs.unlink(metadata.path);
            this.activeFiles.delete(fileId);
            
            return {
                success: true,
                fileId,
                filename: metadata.filename,
                size: metadata.size,
                deletedAt: new Date().toISOString()
            };
            
        } catch (error) {
            // File might already be deleted
            this.activeFiles.delete(fileId);
            return {
                success: false,
                fileId,
                error: error.message
            };
        }
    }

    /**
     * Get file metadata
     */
    async getFileInfo(fileId) {
        const metadata = this.activeFiles.get(fileId);
        if (!metadata) {
            throw new StorageError('File not found', 'FILE_NOT_FOUND');
        }

        try {
            const stats = await fs.stat(metadata.path);
            
            return {
                success: true,
                metadata: {
                    ...metadata,
                    diskSize: stats.size,
                    modifiedAt: stats.mtime,
                    accessedAt: stats.atime
                }
            };
            
        } catch (error) {
            this.activeFiles.delete(fileId);
            throw new StorageError('File not found on disk', 'FILE_MISSING');
        }
    }

    /**
     * List all temporary files
     */
    async listFiles(filter = {}) {
        const files = [];
        
        for (const [fileId, metadata] of this.activeFiles.entries()) {
            try {
                const stats = await fs.stat(metadata.path);
                
                // Apply filters
                if (filter.mimeType && !metadata.mimeType.includes(filter.mimeType)) continue;
                if (filter.minSize && metadata.size < filter.minSize) continue;
                if (filter.maxSize && metadata.size > filter.maxSize) continue;
                if (filter.tags && !filter.tags.every(tag => metadata.tags.includes(tag))) continue;
                
                files.push({
                    fileId,
                    ...metadata,
                    diskSize: stats.size,
                    exists: true
                });
                
            } catch {
                // File no longer exists, remove from map
                this.activeFiles.delete(fileId);
            }
        }
        
        // Sort by creation date (newest first)
        files.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        return {
            success: true,
            count: files.length,
            totalSize: files.reduce((sum, file) => sum + file.size, 0),
            files
        };
    }

    /**
     * Cleanup old files
     */
    async cleanupOldFiles(force = false) {
        const now = new Date();
        let deletedCount = 0;
        let freedSpace = 0;
        
        for (const [fileId, metadata] of this.activeFiles.entries()) {
            try {
                const expired = new Date(metadata.expiresAt) < now;
                const fileExists = await fs.access(metadata.path).then(() => true).catch(() => false);
                
                if (force || expired || !fileExists) {
                    if (fileExists) {
                        await fs.unlink(metadata.path);
                        freedSpace += metadata.size;
                    }
                    this.activeFiles.delete(fileId);
                    deletedCount++;
                }
            } catch (error) {
                // Ignore errors during cleanup
                this.activeFiles.delete(fileId);
            }
        }
        
        // Also scan directory for orphaned files
        try {
            const files = await fs.readdir(this.baseTempDir);
            for (const file of files) {
                const filePath = path.join(this.baseTempDir, file);
                try {
                    const stats = await fs.stat(filePath);
                    const fileAge = Date.now() - stats.mtimeMs;
                    
                    // Delete files older than 2 hours
                    if (fileAge > 2 * 3600000) {
                        await fs.unlink(filePath);
                        deletedCount++;
                        freedSpace += stats.size;
                    }
                } catch {
                    // Ignore errors
                }
            }
        } catch {
            // Directory might not exist
        }
        
        return {
            success: true,
            deletedCount,
            freedSpace,
            remainingFiles: this.activeFiles.size,
            timestamp: now.toISOString()
        };
    }

    /**
     * Get storage usage statistics
     */
    async getStorageUsage() {
        let totalSize = 0;
        let fileCount = 0;
        
        for (const metadata of this.activeFiles.values()) {
            totalSize += metadata.size;
            fileCount++;
        }
        
        // Get disk usage
        let diskUsage = 0;
        try {
            const files = await fs.readdir(this.baseTempDir);
            for (const file of files) {
                try {
                    const stats = await fs.stat(path.join(this.baseTempDir, file));
                    diskUsage += stats.size;
                } catch {
                    // Ignore individual file errors
                }
            }
        } catch {
            diskUsage = totalSize;
        }
        
        return {
            totalSize,
            fileCount,
            diskUsage,
            maxTotalSize: this.maxTotalSize,
            maxFileSize: this.maxFileSize,
            usagePercentage: ((totalSize / this.maxTotalSize) * 100).toFixed(1),
            fileLifetime: this.fileLifetime
        };
    }

    /**
     * Detect MIME type from filename and buffer
     */
    detectMimeType(filename, buffer) {
        const extension = path.extname(filename).toLowerCase().replace('.', '');
        
        const mimeTypes = {
            // Images
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            webp: 'image/webp',
            bmp: 'image/bmp',
            tiff: 'image/tiff',
            svg: 'image/svg+xml',
            
            // Videos
            mp4: 'video/mp4',
            webm: 'video/webm',
            mov: 'video/quicktime',
            avi: 'video/x-msvideo',
            mkv: 'video/x-matroska',
            
            // Audio
            mp3: 'audio/mpeg',
            wav: 'audio/wav',
            ogg: 'audio/ogg',
            m4a: 'audio/mp4',
            flac: 'audio/flac',
            
            // Documents
            pdf: 'application/pdf',
            txt: 'text/plain',
            json: 'application/json',
            xml: 'application/xml',
            zip: 'application/zip',
            
            // Default
            default: 'application/octet-stream'
        };
        
        return mimeTypes[extension] || mimeTypes.default;
    }

    /**
     * Create file stream for large files
     */
    createReadStream(fileId) {
        const metadata = this.activeFiles.get(fileId);
        if (!metadata) {
            throw new StorageError('File not found', 'FILE_NOT_FOUND');
        }
        
        // Update access metadata
        metadata.accessCount++;
        metadata.lastAccessed = new Date().toISOString();
        this.activeFiles.set(fileId, metadata);
        
        return fs.createReadStream(metadata.path);
    }

    /**
     * Store JSON data
     */
    async storeJSON(data, filename = 'data.json') {
        const buffer = Buffer.from(JSON.stringify(data, null, 2));
        return this.createTempFile(buffer, filename, {
            mimeType: 'application/json',
            tags: ['json', 'data']
        });
    }

    /**
     * Read JSON data
     */
    async readJSON(fileId) {
        const result = await this.readTempFile(fileId);
        try {
            const jsonData = JSON.parse(result.buffer.toString());
            return {
                success: true,
                data: jsonData,
                metadata: result.metadata
            };
        } catch (error) {
            throw new StorageError('Invalid JSON data', 'INVALID_JSON');
        }
    }
}

// Export singleton instance
module.exports = new StorageManager();
