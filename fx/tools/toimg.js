// fx/tools/toimg.js
const sharp = require('sharp');
const { createTempFile, cleanupTempFile } = require('../../lib/storage');
const { validateInput, validateImageBuffer } = require('../../lib/validation');
const { createErrorResponse, createSuccessResponse } = require('../../lib/response');

/**
 * Convert sticker/document to image format
 * Input: { stickerBuffer/documentBuffer, targetFormat(optional), quality(optional) }
 * Output: { imageBuffer, format, dimensions, mimeType }
 */
async function toimgFunction(request) {
    try {
        // Validate request structure
        if (!validateInput(request, ['data'])) {
            return createErrorResponse('INVALID_REQUEST', 'Request must contain data field');
        }

        const { data } = request;
        const { buffer, base64Data, url, targetFormat = 'jpeg', quality = 85 } = data;

        // Check if we have image data
        let imageBuffer;
        if (buffer) {
            imageBuffer = Buffer.from(buffer, 'base64');
        } else if (base64Data) {
            // Handle base64 string (with or without data URI prefix)
            const base64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
            imageBuffer = Buffer.from(base64, 'base64');
        } else if (url) {
            // Download image from URL
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

        // Determine output format
        const supportedFormats = ['jpeg', 'png', 'webp', 'gif', 'tiff'];
        const outputFormat = supportedFormats.includes(targetFormat.toLowerCase()) 
            ? targetFormat.toLowerCase() 
            : 'jpeg';

        // Process image
        let processedImage;
        const sharpInstance = sharp(imageBuffer);

        // Get original metadata
        const metadata = await sharpInstance.metadata();
        
        // Apply conversion based on format
        switch (outputFormat) {
            case 'jpeg':
                processedImage = await sharpInstance
                    .jpeg({ quality: Math.min(Math.max(quality, 1), 100) })
                    .toBuffer();
                break;
                
            case 'png':
                processedImage = await sharpInstance
                    .png({ compressionLevel: Math.floor((100 - quality) / 10) })
                    .toBuffer();
                break;
                
            case 'webp':
                processedImage = await sharpInstance
                    .webp({ quality: Math.min(Math.max(quality, 1), 100) })
                    .toBuffer();
                break;
                
            case 'gif':
                // For GIF, we need to handle animations
                processedImage = await sharpInstance
                    .gif()
                    .toBuffer();
                break;
                
            case 'tiff':
                processedImage = await sharpInstance
                    .tiff({ quality: Math.min(Math.max(quality, 1), 100) })
                    .toBuffer();
                break;
                
            default:
                processedImage = await sharpInstance
                    .jpeg({ quality: 85 })
                    .toBuffer();
        }

        // Create temp file (optional, for large images)
        const tempFile = await createTempFile(processedImage, `converted.${outputFormat}`);

        // Return success response
        return createSuccessResponse({
            imageBuffer: processedImage.toString('base64'),
            format: outputFormat,
            dimensions: {
                width: metadata.width,
                height: metadata.height,
                originalFormat: metadata.format
            },
            mimeType: `image/${outputFormat}`,
            size: processedImage.length,
            tempPath: tempFile.path,
            originalSize: imageBuffer.length,
            compressionRatio: `${((processedImage.length / imageBuffer.length) * 100).toFixed(1)}%`
        });

    } catch (error) {
        console.error('toimgFunction Error:', error);
        
        // Specific error handling
        if (error.message.includes('Input buffer contains unsupported image format')) {
            return createErrorResponse('UNSUPPORTED_FORMAT', 'The input image format is not supported');
        }
        
        if (error.message.includes('EPIPE') || error.message.includes('ECONNRESET')) {
            return createErrorResponse('PROCESSING_TIMEOUT', 'Image processing took too long');
        }
        
        return createErrorResponse('CONVERSION_FAILED', error.message);
    }
}

module.exports = toimgFunction;
