// fx/download/download.js
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');

async function downloadFunction(request) {
  try {
    const { url, filename = null, timeout = 30000, maxSize = 50 * 1024 * 1024 } = request.data;
    
    if (!url) {
      return {
        success: false,
        error: {
          code: 'MISSING_URL',
          message: 'Download URL is required'
        }
      };
    }

    // Validate URL
    const urlValidation = validateUrl(url);
    if (!urlValidation.valid) {
      return {
        success: false,
        error: {
          code: 'INVALID_URL',
          message: urlValidation.message
        }
      };
    }

    // Check if URL is accessible
    const headers = await getUrlHeaders(url);
    if (!headers) {
      return {
        success: false,
        error: {
          code: 'URL_UNREACHABLE',
          message: 'Cannot access the URL'
        }
      };
    }

    // Check file size
    const contentLength = headers['content-length'];
    if (contentLength && parseInt(contentLength) > maxSize) {
      return {
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File size (${formatBytes(contentLength)}) exceeds limit (${formatBytes(maxSize)})`
        }
      };
    }

    // Generate filename if not provided
    const finalFilename = filename || generateFilename(url, headers['content-type']);

    // Download the file
    const downloadResult = await downloadFile(url, finalFilename, timeout, maxSize);
    
    return {
      success: true,
      result: {
        filename: finalFilename,
        url: url,
        size: downloadResult.size,
        mimeType: downloadResult.mimeType,
        downloadTime: downloadResult.downloadTime,
        downloadSpeed: downloadResult.downloadSpeed,
        formatted: formatDownloadResponse(finalFilename, downloadResult.size, downloadResult.mimeType)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'DOWNLOAD_FAILED',
        message: error.message || 'Failed to download file'
      }
    };
  }
}

function validateUrl(url) {
  try {
    const urlObj = new URL(url);
    
    // Check protocol
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return {
        valid: false,
        message: 'Only HTTP and HTTPS URLs are supported'
      };
    }
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\.exe$/i,
      /\.bat$/i,
      /\.cmd$/i,
      /\.scr$/i,
      /\.msi$/i
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(urlObj.pathname)) {
        return {
          valid: false,
          message: 'Executable files are not allowed for security reasons'
        };
      }
    }
    
    return { valid: true };
  } catch {
    return {
      valid: false,
      message: 'Invalid URL format'
    };
  }
}

async function getUrlHeaders(url) {
  try {
    const response = await axios.head(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    return response.headers;
  } catch (error) {
    console.log('HEAD request failed, trying GET:', error.message);
    return null;
  }
}

function generateFilename(url, mimeType = null) {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;
  
  // Try to extract filename from URL
  const basename = path.basename(pathname);
  if (basename && basename.includes('.') && basename.length > 3) {
    return basename;
  }
  
  // Generate filename based on mime type
  const ext = mimeType ? mime.extension(mimeType) || 'bin' : 'bin';
  return `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
}

async function downloadFile(url, filename, timeout, maxSize) {
  const startTime = Date.now();
  
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'arraybuffer',
    timeout: timeout,
    maxContentLength: maxSize,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': '*/*'
    },
    onDownloadProgress: (progressEvent) => {
      // Optional: Send progress updates
      const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || maxSize));
      if (percent % 25 === 0) {
        console.log(`Download ${filename}: ${percent}%`);
      }
    }
  });
  
  const endTime = Date.now();
  const downloadTime = (endTime - startTime) / 1000; // in seconds
  
  const buffer = Buffer.from(response.data);
  const size = buffer.length;
  const mimeType = response.headers['content-type'] || 'application/octet-stream';
  
  // Calculate download speed
  const downloadSpeed = size / downloadTime; // bytes per second
  
  // In production, you might want to save the file to disk or cloud storage
  // For now, we'll just return the buffer info
  // If you need to save: await fs.writeFile(`/tmp/${filename}`, buffer);
  
  return {
    buffer: buffer,
    size: size,
    mimeType: mimeType,
    downloadTime: downloadTime,
    downloadSpeed: downloadSpeed,
    headers: response.headers
  };
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatDownloadResponse(filename, size, mimeType) {
  const ext = filename.split('.').pop().toUpperCase();
  const sizeFormatted = formatBytes(size);
  
  let formatted = `📥 *Download Complete!*\n\n`;
  formatted += `📄 *File:* ${filename}\n`;
  formatted += `📊 *Size:* ${sizeFormatted}\n`;
  formatted += `📦 *Type:* ${mimeType}\n`;
  formatted += `🔤 *Extension:* ${ext}\n\n`;
  
  formatted += `✅ *Download successful*\n`;
  formatted += `⚡ Ready for use\n`;
  formatted += `📁 File buffer available\n\n`;
  
  if (size > 10 * 1024 * 1024) {
    formatted += `⚠️ *Large file detected*\n`;
    formatted += `Consider compressing for sharing\n`;
  }
  
  formatted += `━━━━━━━━━━━━━━━━━━━━\n`;
  formatted += `⚡ Use !img, !mp3, !mp4 for media processing`;
  
  return formatted;
}

// File type detection helper
downloadFunction.detectFileType = function(buffer) {
  const signatures = {
    'image/jpeg': Buffer.from([0xFF, 0xD8, 0xFF]),
    'image/png': Buffer.from([0x89, 0x50, 0x4E, 0x47]),
    'image/gif': Buffer.from([0x47, 0x49, 0x46]),
    'video/mp4': Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]),
    'audio/mpeg': Buffer.from([0x49, 0x44, 0x33]), // MP3
    'application/pdf': Buffer.from([0x25, 0x50, 0x44, 0x46]),
    'application/zip': Buffer.from([0x50, 0x4B, 0x03, 0x04]),
    'application/x-rar-compressed': Buffer.from([0x52, 0x61, 0x72, 0x21])
  };
  
  for (const [mimeType, signature] of Object.entries(signatures)) {
    if (buffer.slice(0, signature.length).equals(signature)) {
      return mimeType;
    }
  }
  
  return 'application/octet-stream';
};

module.exports = downloadFunction;
