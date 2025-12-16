// lib/media.js
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const { createTempFile } = require('./storage');

class MediaError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'MediaError';
        this.code = code;
        this.timestamp = new Date().toISOString();
    }
}

/**
 * Media Processing Utilities
 * Handles images, audio, video processing
 */
class MediaProcessor {
    constructor() {
        this.supportedImageFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'tiff', 'bmp', 'svg'];
        this.supportedVideoFormats = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv'];
        this.supportedAudioFormats = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'];
    }

    /**
     * Validate media buffer
     */
    validateMedia(buffer, type = 'image') {
        if (!Buffer.isBuffer(buffer)) {
            throw new MediaError('Input is not a valid buffer', 'INVALID_BUFFER');
        }

        if (buffer.length === 0) {
            throw new MediaError('Buffer is empty', 'EMPTY_BUFFER');
        }

        const maxSizes = {
            image: 20 * 1024 * 1024, // 20MB
            video: 100 * 1024 * 1024, // 100MB
            audio: 50 * 1024 * 1024 // 50MB
        };

        if (buffer.length > maxSizes[type]) {
            throw new MediaError(
                `File too large. Max ${type} size: ${maxSizes[type] / 1024 / 1024}MB`,
                'FILE_TOO_LARGE'
            );
        }

        return true;
    }

    /**
     * Get media info
     */
    async getMediaInfo(buffer, filename = '') {
        try {
            const extension = filename.split('.').pop().toLowerCase();
            
            // Try to detect type from buffer
            const type = this.detectMediaType(buffer, extension);
            
            let info = {
                type,
                size: buffer.length,
                extension,
                isValid: true
            };

            if (type === 'image') {
                const metadata = await sharp(buffer).metadata();
                info = {
                    ...info,
                    width: metadata.width,
                    height: metadata.height,
                    format: metadata.format,
                    hasAlpha: metadata.hasAlpha,
                    channels: metadata.channels,
                    density: metadata.density,
                    isProgressive: metadata.isProgressive
                };
            }

            return info;
        } catch (error) {
            return {
                type: 'unknown',
                size: buffer.length,
                extension: filename.split('.').pop() || '',
                isValid: false,
                error: error.message
            };
        }
    }

    /**
     * Detect media type from buffer
     */
    detectMediaType(buffer, extension = '') {
        // Check magic bytes
        const hex = buffer.toString('hex', 0, 4);
        
        // Images
        if (hex.startsWith('ffd8ff')) return 'image'; // JPEG
        if (hex.startsWith('89504e47')) return 'image'; // PNG
        if (hex.startsWith('47494638')) return 'image'; // GIF
        if (hex.startsWith('52494646') && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image'; // WEBP
        
        // Videos
        if (hex.startsWith('000000') && buffer.length > 12) {
            const boxType = buffer.toString('ascii', 4, 8);
            if (['ftyp', 'moov', 'mdat'].includes(boxType)) return 'video'; // MP4/MOV
        }
        
        // Audio
        if (hex.startsWith('494433')) return 'audio'; // MP3 ID3 tag
        if (hex.startsWith('4f676753')) return 'audio'; // OGG
        
        // Fallback to extension
        if (this.supportedImageFormats.includes(extension)) return 'image';
        if (this.supportedVideoFormats.includes(extension)) return 'video';
        if (this.supportedAudioFormats.includes(extension)) return 'audio';
        
        return 'unknown';
    }

    /**
     * Resize image
     */
    async resizeImage(buffer, width, height, options = {}) {
        this.validateMedia(buffer, 'image');
        
        const {
            fit = 'cover',
            position = 'center',
            background = { r: 255, g: 255, b: 255, alpha: 1 }
        } = options;

        try {
            const resized = await sharp(buffer)
                .resize(width, height, { fit, position, background })
                .toBuffer();
            
            return {
                buffer: resized,
                originalSize: buffer.length,
                newSize: resized.length,
                dimensions: { width, height },
                compression: `${((resized.length / buffer.length) * 100).toFixed(1)}%`
            };
        } catch (error) {
            throw new MediaError(`Image resize failed: ${error.message}`, 'RESIZE_ERROR');
        }
    }

    /**
     * Convert image format
     */
    async convertImage(buffer, targetFormat, quality = 85) {
        this.validateMedia(buffer, 'image');
        
        const format = targetFormat.toLowerCase();
        if (!this.supportedImageFormats.includes(format)) {
            throw new MediaError(`Unsupported format: ${format}`, 'UNSUPPORTED_FORMAT');
        }

        try {
            let converted;
            const sharpInstance = sharp(buffer);

            switch (format) {
                case 'jpeg':
                case 'jpg':
                    converted = await sharpInstance.jpeg({ quality }).toBuffer();
                    break;
                case 'png':
                    converted = await sharpInstance.png({ compressionLevel: 9 }).toBuffer();
                    break;
                case 'webp':
                    converted = await sharpInstance.webp({ quality }).toBuffer();
                    break;
                case 'gif':
                    converted = await sharpInstance.gif().toBuffer();
                    break;
                default:
                    converted = await sharpInstance.toFormat(format).toBuffer();
            }

            return {
                buffer: converted,
                format,
                mimeType: `image/${format === 'jpg' ? 'jpeg' : format}`,
                originalSize: buffer.length,
                newSize: converted.length
            };
        } catch (error) {
            throw new MediaError(`Image conversion failed: ${error.message}`, 'CONVERSION_ERROR');
        }
    }

    /**
     * Compress image
     */
    async compressImage(buffer, quality = 80, maxWidth = 1920) {
        this.validateMedia(buffer, 'image');
        
        try {
            const metadata = await sharp(buffer).metadata();
            
            let compressBuffer = buffer;
            if (metadata.width > maxWidth) {
                compressBuffer = await sharp(buffer)
                    .resize(maxWidth, null, { fit: 'inside' })
                    .toBuffer();
            }

            // Convert to WebP for best compression
            const compressed = await sharp(compressBuffer)
                .webp({ quality, nearLossless: true })
                .toBuffer();

            return {
                buffer: compressed,
                format: 'webp',
                mimeType: 'image/webp',
                originalSize: buffer.length,
                compressedSize: compressed.length,
                reduction: `${(100 - (compressed.length / buffer.length) * 100).toFixed(1)}%`,
                dimensions: metadata.width > maxWidth 
                    ? { width: maxWidth, height: Math.round(metadata.height * (maxWidth / metadata.width)) }
                    : { width: metadata.width, height: metadata.height }
            };
        } catch (error) {
            throw new MediaError(`Image compression failed: ${error.message}`, 'COMPRESSION_ERROR');
        }
    }

    /**
     * Extract audio from video
     */
    async extractAudio(videoBuffer, audioFormat = 'mp3', bitrate = '128k') {
        this.validateMedia(videoBuffer, 'video');
        
        return new Promise((resolve, reject) => {
            const inputPath = path.join(__dirname, '../temp', `input_${Date.now()}.mp4`);
            const outputPath = path.join(__dirname, '../temp', `audio_${Date.now()}.${audioFormat}`);
            
            fs.writeFile(inputPath, videoBuffer)
                .then(() => {
                    ffmpeg(inputPath)
                        .audioCodec(audioFormat === 'mp3' ? 'libmp3lame' : 'aac')
                        .audioBitrate(bitrate)
                        .format(audioFormat)
                        .on('end', async () => {
                            try {
                                const audioBuffer = await fs.readFile(outputPath);
                                
                                // Cleanup temp files
                                await fs.unlink(inputPath);
                                await fs.unlink(outputPath);
                                
                                resolve({
                                    buffer: audioBuffer,
                                    format: audioFormat,
                                    mimeType: `audio/${audioFormat}`,
                                    bitrate,
                                    size: audioBuffer.length
                                });
                            } catch (error) {
                                reject(new MediaError(`Failed to read output: ${error.message}`, 'EXTRACT_ERROR'));
                            }
                        })
                        .on('error', (error) => {
                            reject(new MediaError(`Audio extraction failed: ${error.message}`, 'EXTRACT_ERROR'));
                        })
                        .save(outputPath);
                })
                .catch(error => {
                    reject(new MediaError(`Failed to write temp file: ${error.message}`, 'TEMP_FILE_ERROR'));
                });
        });
    }

    /**
     * Convert audio format
     */
    async convertAudio(audioBuffer, targetFormat, bitrate = '128k') {
        this.validateMedia(audioBuffer, 'audio');
        
        if (!this.supportedAudioFormats.includes(targetFormat)) {
            throw new MediaError(`Unsupported audio format: ${targetFormat}`, 'UNSUPPORTED_FORMAT');
        }

        return new Promise((resolve, reject) => {
            const inputPath = path.join(__dirname, '../temp', `audio_in_${Date.now()}.tmp`);
            const outputPath = path.join(__dirname, '../temp', `audio_out_${Date.now()}.${targetFormat}`);
            
            fs.writeFile(inputPath, audioBuffer)
                .then(() => {
                    ffmpeg(inputPath)
                        .audioCodec(targetFormat === 'mp3' ? 'libmp3lame' : 'aac')
                        .audioBitrate(bitrate)
                        .format(targetFormat)
                        .on('end', async () => {
                            try {
                                const outputBuffer = await fs.readFile(outputPath);
                                
                                // Cleanup
                                await fs.unlink(inputPath);
                                await fs.unlink(outputPath);
                                
                                resolve({
                                    buffer: outputBuffer,
                                    format: targetFormat,
                                    mimeType: `audio/${targetFormat}`,
                                    bitrate,
                                    originalSize: audioBuffer.length,
                                    newSize: outputBuffer.length
                                });
                            } catch (error) {
                                reject(new MediaError(`Failed to read output: ${error.message}`, 'CONVERSION_ERROR'));
                            }
                        })
                        .on('error', (error) => {
                            reject(new MediaError(`Audio conversion failed: ${error.message}`, 'CONVERSION_ERROR'));
                        })
                        .save(outputPath);
                })
                .catch(error => {
                    reject(new MediaError(`Failed to write temp file: ${error.message}`, 'TEMP_FILE_ERROR'));
                });
        });
    }

    /**
     * Create thumbnail from video
     */
    async createVideoThumbnail(videoBuffer, timeInSeconds = 1) {
        this.validateMedia(videoBuffer, 'video');
        
        return new Promise((resolve, reject) => {
            const inputPath = path.join(__dirname, '../temp', `video_${Date.now()}.mp4`);
            const outputPath = path.join(__dirname, '../temp', `thumb_${Date.now()}.jpg`);
            
            fs.writeFile(inputPath, videoBuffer)
                .then(() => {
                    ffmpeg(inputPath)
                        .screenshots({
                            timestamps: [timeInSeconds],
                            filename: path.basename(outputPath),
                            folder: path.dirname(outputPath),
                            size: '320x240'
                        })
                        .on('end', async () => {
                            try {
                                const thumbBuffer = await fs.readFile(outputPath);
                                
                                // Cleanup
                                await fs.unlink(inputPath);
                                await fs.unlink(outputPath);
                                
                                resolve({
                                    buffer: thumbBuffer,
                                    format: 'jpg',
                                    mimeType: 'image/jpeg',
                                    time: timeInSeconds,
                                    size: thumbBuffer.length
                                });
                            } catch (error) {
                                reject(new MediaError(`Failed to read thumbnail: ${error.message}`, 'THUMBNAIL_ERROR'));
                            }
                        })
                        .on('error', (error) => {
                            reject(new MediaError(`Thumbnail creation failed: ${error.message}`, 'THUMBNAIL_ERROR'));
                        });
                })
                .catch(error => {
                    reject(new MediaError(`Failed to write temp file: ${error.message}`, 'TEMP_FILE_ERROR'));
                });
        });
    }

    /**
     * Merge images into GIF
     */
    async createGif(imageBuffers, delay = 100, loop = 0) {
        if (!Array.isArray(imageBuffers) || imageBuffers.length < 2) {
            throw new MediaError('Need at least 2 images to create GIF', 'INVALID_INPUT');
        }

        try {
            const gifBuffer = await sharp(imageBuffers[0], { animated: true })
                .gif({ delay, loop })
                .toBuffer();

            return {
                buffer: gifBuffer,
                format: 'gif',
                mimeType: 'image/gif',
                frameCount: imageBuffers.length,
                delay,
                loop,
                size: gifBuffer.length
            };
        } catch (error) {
            throw new MediaError(`GIF creation failed: ${error.message}`, 'GIF_ERROR');
        }
    }

    /**
     * Add watermark to image
     */
    async addWatermark(imageBuffer, watermarkBuffer, position = 'southeast', opacity = 0.5) {
        this.validateMedia(imageBuffer, 'image');
        this.validateMedia(watermarkBuffer, 'image');
        
        try {
            const image = sharp(imageBuffer);
            const watermark = sharp(watermarkBuffer);
            
            const imageMetadata = await image.metadata();
            const watermarkMetadata = await watermark.metadata();
            
            // Calculate position
            let left, top;
            const margin = 10;
            
            switch (position) {
                case 'topleft':
                    left = margin;
                    top = margin;
                    break;
                case 'topright':
                    left = imageMetadata.width - watermarkMetadata.width - margin;
                    top = margin;
                    break;
                case 'bottomleft':
                    left = margin;
                    top = imageMetadata.height - watermarkMetadata.height - margin;
                    break;
                case 'bottomright':
                case 'southeast':
                    left = imageMetadata.width - watermarkMetadata.width - margin;
                    top = imageMetadata.height - watermarkMetadata.height - margin;
                    break;
                case 'center':
                    left = Math.floor((imageMetadata.width - watermarkMetadata.width) / 2);
                    top = Math.floor((imageMetadata.height - watermarkMetadata.height) / 2);
                    break;
                default:
                    left = margin;
                    top = margin;
            }
            
            const watermarked = await image
                .composite([{
                    input: await watermark.png().toBuffer(),
                    left,
                    top,
                    blend: 'over'
                }])
                .png()
                .toBuffer();
            
            return {
                buffer: watermarked,
                format: 'png',
                mimeType: 'image/png',
                watermarkPosition: { left, top },
                opacity,
                originalSize: imageBuffer.length,
                newSize: watermarked.length
            };
        } catch (error) {
            throw new MediaError(`Watermark failed: ${error.message}`, 'WATERMARK_ERROR');
        }
    }

    /**
     * Extract frames from GIF
     */
    async extractGifFrames(gifBuffer) {
        this.validateMedia(gifBuffer, 'image');
        
        try {
            const metadata = await sharp(gifBuffer, { animated: true }).metadata();
            const frames = [];
            
            for (let i = 0; i < metadata.pages; i++) {
                const frameBuffer = await sharp(gifBuffer, { page: i })
                    .png()
                    .toBuffer();
                
                frames.push({
                    index: i,
                    buffer: frameBuffer,
                    delay: metadata.delay ? metadata.delay[i] : 100,
                    width: metadata.width,
                    height: metadata.height
                });
            }
            
            return {
                frames,
                totalFrames: metadata.pages,
                width: metadata.width,
                height: metadata.height,
                format: 'png',
                delays: metadata.delay
            };
        } catch (error) {
            throw new MediaError(`GIF frame extraction failed: ${error.message}`, 'GIF_EXTRACTION_ERROR');
        }
    }
}

// Export singleton instance
module.exports = new MediaProcessor();
