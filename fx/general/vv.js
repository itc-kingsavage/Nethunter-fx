// fx/general/vv.js
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // npm install uuid

// Temporary storage for processed media
const tempStorage = new Map();
const CLEANUP_INTERVAL = 3600000; // 1 hour

async function vvFunction(request) {
  try {
    const { mediaUrl, messageId, chatId, mediaType = 'auto' } = request.data;
    
    if (!mediaUrl && !messageId) {
      return {
        success: false,
        error: {
          code: 'MISSING_MEDIA',
          message: 'Either mediaUrl or messageId is required'
        }
      };
    }

    // Detect if it's view-once media (in production, this would come from WhatsApp metadata)
    const isViewOnce = await detectViewOnceMedia(mediaUrl || messageId);
    
    if (!isViewOnce) {
      return {
        success: false,
        error: {
          code: 'NOT_VIEW_ONCE',
          message: 'This is not a view-once media message'
        }
      };
    }

    // Download the media
    const mediaBuffer = await downloadMedia(mediaUrl || messageId);
    
    // Process based on media type
    const detectedType = mediaType === 'auto' ? detectMediaType(mediaBuffer) : mediaType;
    const processedMedia = await processMedia(mediaBuffer, detectedType);
    
    // Generate access token for temporary access
    const accessToken = uuidv4();
    const expiryTime = Date.now() + 3600000; // 1 hour expiry
    
    // Store in temporary storage
    tempStorage.set(accessToken, {
      buffer: processedMedia.buffer,
      type: processedMedia.type,
      originalType: detectedType,
      expiry: expiryTime,
      downloadedAt: new Date().toISOString()
    });
    
    // Schedule cleanup
    scheduleCleanup(accessToken, expiryTime);
    
    return {
      success: true,
      result: {
        accessToken: accessToken,
        mediaType: processedMedia.type,
        downloadUrl: `/media/${accessToken}`, // Your server should serve this
        filename: `viewonce_${Date.now()}.${getFileExtension(processedMedia.type)}`,
        size: processedMedia.buffer.length,
        expiresAt: new Date(expiryTime).toISOString(),
        formatted: formatSuccessMessage(processedMedia.type)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'VV_PROCESSING_FAILED',
        message: error.message || 'Failed to process view-once media'
      }
    };
  }
}

async function detectViewOnceMedia(identifier) {
  // In production, this would check WhatsApp metadata
  // For simulation, we assume all provided media URLs are view-once
  return true;
}

async function downloadMedia(source) {
  try {
    if (source.startsWith('http')) {
      // Download from URL
      const response = await axios({
        method: 'GET',
        url: source,
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (WhatsAppBot)'
        }
      });
      
      return Buffer.from(response.data);
    } else {
      // In production, fetch from WhatsApp message ID
      // This is a simulation
      throw new Error('Message ID download not implemented in simulation');
    }
  } catch (error) {
    console.error('Download failed:', error.message);
    throw new Error(`Failed to download media: ${error.message}`);
  }
}

function detectMediaType(buffer) {
  // Simple detection based on magic numbers
  const hex = buffer.toString('hex', 0, 4);
  
  if (hex.startsWith('ffd8ff')) return 'image/jpeg';
  if (hex.startsWith('89504e47')) return 'image/png';
  if (hex.startsWith('47494638')) return 'image/gif';
  if (hex.startsWith('52494646') && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buffer.toString('ascii', 0, 4) === 'ftyp') return 'video/mp4';
  if (hex.startsWith('494433') || hex.startsWith('fffb')) return 'audio/mpeg';
  
  return 'application/octet-stream';
}

async function processMedia(buffer, mediaType) {
  // Remove any metadata that might indicate view-once
  // For images, we can re-encode them
  
  if (mediaType.startsWith('image/')) {
    // For images, we can use sharp to re-encode and strip metadata
    try {
      const sharp = require('sharp'); // npm install sharp
      const processed = await sharp(buffer)
        .withMetadata() // Keep basic metadata but remove WhatsApp-specific
        .toBuffer();
      
      return {
        buffer: processed,
        type: mediaType,
        processed: true
      };
    } catch (error) {
      console.log('Sharp processing failed, using original:', error.message);
    }
  }
  
  // For audio/video or if processing failed, return original
  return {
    buffer: buffer,
    type: mediaType,
    processed: false
  };
}

function getFileExtension(mimeType) {
  const extensions = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/aac': 'aac'
  };
  
  return extensions[mimeType] || 'bin';
}

function formatSuccessMessage(mediaType) {
  const emoji = mediaType.startsWith('image/') ? '🖼️' : 
                mediaType.startsWith('video/') ? '🎬' : 
                mediaType.startsWith('audio/') ? '🎵' : '📁';
  
  return `${emoji} *View-Once Media Extracted!*\n\n` +
         `Media type: ${mediaType}\n` +
         `⚠️ This media will be accessible for 1 hour\n` +
         `🔗 Use the provided URL to download\n\n` +
         `_View-once protection has been removed_`;
}

function scheduleCleanup(token, expiryTime) {
  const timeUntilExpiry = expiryTime - Date.now();
  
  if (timeUntilExpiry > 0) {
    setTimeout(() => {
      tempStorage.delete(token);
    }, timeUntilExpiry);
  }
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of tempStorage.entries()) {
    if (data.expiry < now) {
      tempStorage.delete(token);
    }
  }
}, CLEANUP_INTERVAL);

// For serving the media (add this to your main server)
vvFunction.serveMedia = function(token) {
  const media = tempStorage.get(token);
  if (!media || media.expiry < Date.now()) {
    return null;
  }
  return media;
};

module.exports = vvFunction;
