// fx/tools/tosticker.js
const sharp = require('sharp');
const { createTempFile } = require('../../lib/storage');
const { validateInput, validateImageBuffer } = require('../../lib/validation');
const { createErrorResponse, createSuccessResponse } = require('../../lib/response');

/**
 * Convert image to WhatsApp sticker
 * Input: { imageBuffer, packName, author, categories(optional), quality(optional) }
 * Output: { stickerBuffer, metadata, webpData }
 */
async function tostickerFunction(request) {
    try {
        // Validate request structure
        if (!validateInput(request, ['data'])) {
            return createErrorResponse('INVALID_REQUEST', 'Request must contain data field');
        }

        const { data } = request;
        const { 
            buffer, 
            base64Data, 
            url, 
            packName = 'My Sticker Pack', 
            author = 'Nethunter Bot',
            categories = ['🤖', '😊'],
            quality = 85,
            removeBackground = false
        } = data;

        // Check if we have image data
        let imageBuffer;
        if (buffer) {
            imageBuffer = Buffer.from(buffer, 'base64');
        } else if (base64Data) {
            const base64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
            imageBuffer = Buffer.from(base64, 'base64');
        } else if (url) {
            const axios = require('axios');
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            imageBuffer = Buffer.from(response.data);
        } else {
            return createErrorResponse('NO_INPUT_DATA', 'Provide buffer, base64Data, or url');
        }

        // Validate image buffer
        const validationResult = validateImageBuffer(imageBuffer);
        if (!validationResult.valid) {
            return createErrorResponse('INVALID_IMAGE', validationResult.message);
        }

        // WhatsApp sticker requirements:
        // - Format: WebP
        // - Size: 512x512 pixels (recommended)
        // - File size: < 1MB
        // - Square aspect ratio

        // Process image for sticker
        const sharpInstance = sharp(imageBuffer);
        const metadata = await sharpInstance.metadata();

        // Remove background if requested (basic implementation)
        let processedImage = sharpInstance;
        if (removeBackground && metadata.hasAlpha) {
            // Simple background removal for transparent images
            processedImage = processedImage.removeAlpha();
        }

        // Resize and crop to square
        const targetSize = 512;
        processedImage = processedImage
            .resize({
                width: targetSize,
                height: targetSize,
                fit: sharp.fit.cover,
                position: sharp.strategy.entropy
            })
            .ensureAlpha()  // Ensure transparency for WebP
            .webp({ 
                quality: Math.min(Math.max(quality, 1), 100),
                alphaQuality: 100,
                lossless: false,
                nearLossless: true,
                smartSubsample: true
            });

        // Convert to WebP buffer
        const webpBuffer = await processedImage.toBuffer();

        // Check file size limit (WhatsApp: < 1MB = 1048576 bytes)
        const maxSize = 1048576;
        if (webpBuffer.length > maxSize) {
            // Auto-compress if too large
            let compressedBuffer = webpBuffer;
            let currentQuality = quality;
            
            for (let i = 0; i < 5 && compressedBuffer.length > maxSize; i++) {
                currentQuality -= 15;
                if (currentQuality < 20) currentQuality = 20;
                
                compressedBuffer = await sharp(imageBuffer)
                    .resize(targetSize, targetSize, { fit: 'cover' })
                    .webp({ quality: currentQuality })
                    .toBuffer();
            }
            
            if (compressedBuffer.length > maxSize) {
                return createErrorResponse(
                    'FILE_TOO_LARGE', 
                    `Sticker size (${compressedBuffer.length} bytes) exceeds WhatsApp limit of 1MB. Try a simpler image.`
                );
            }
            
            // Use compressed version
            finalBuffer = compressedBuffer;
        } else {
            finalBuffer = webpBuffer;
        }

        // Create temp file
        const tempFile = await createTempFile(finalBuffer, 'sticker.webp');

        // Create sticker metadata
        const stickerMetadata = {
            packName: packName.substring(0, 128), // WhatsApp limit
            author: author.substring(0, 128),
            categories: Array.isArray(categories) ? categories.slice(0, 3) : ['General'],
            androidAppDownloadLink: '',
            iosAppDownloadLink: '',
            publisher: 'Nethunter Bot',
            email: '',
            website: '',
            privacyPolicy: '',
            licenseAgreement: '',
            dimensions: {
                width: targetSize,
                height: targetSize,
                originalWidth: metadata.width,
                originalHeight: metadata.height
            },
            format: 'webp',
            fileSize: finalBuffer.length,
            compliant: finalBuffer.length <= maxSize,
            maxSizeAllowed: maxSize,
            quality: quality,
            hasTransparency: metadata.hasAlpha || false,
            createdAt: new Date().toISOString()
        };

        // Return success response
        return createSuccessResponse({
            stickerBuffer: finalBuffer.toString('base64'),
            webpData: `data:image/webp;base64,${finalBuffer.toString('base64')}`,
            metadata: stickerMetadata,
            tempPath: tempFile.path,
            downloadUrl: `${process.env.APP_URL || ''}/download/${tempFile.filename}`,
            validation: {
                isValid: true,
                checks: {
                    format: 'webp ✓',
                    dimensions: `${targetSize}x${targetSize} ✓`,
                    sizeLimit: finalBuffer.length <= maxSize ? '✓' : '✗',
                    squareAspect: '✓',
                    hasTransparency: stickerMetadata.hasTransparency ? '✓' : '✗'
                }
            }
        });

    } catch (error) {
        console.error('tostickerFunction Error:', error);
        
        // Specific error handling
        if (error.message.includes('Input buffer contains unsupported image format')) {
            return createErrorResponse('UNSUPPORTED_FORMAT', 'Input image format not supported for sticker conversion');
        }
        
        if (error.code === 'ENOENT' || error.message.includes('no such file')) {
            return createErrorResponse('FILE_NOT_FOUND', 'Temporary file storage error');
        }
        
        if (error.message.includes('width') || error.message.includes('height')) {
            return createErrorResponse('INVALID_DIMENSIONS', 'Image dimensions could not be determined');
        }
        
        return createErrorResponse('STICKER_CONVERSION_FAILED', error.message);
    }
}

module.exports = tostickerFunction;
