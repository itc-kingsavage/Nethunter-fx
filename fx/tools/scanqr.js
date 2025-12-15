// fx/tools/scanqr.js
const jsQR = require('jsqr');
const Jimp = require('jimp');
const axios = require('axios');

async function scanqrFunction(request) {
  try {
    const { imageUrl, imageBuffer } = request.data;
    
    if (!imageUrl && !imageBuffer) {
      return {
        success: false,
        error: {
          code: 'MISSING_IMAGE',
          message: 'Image URL or buffer is required to scan QR code'
        }
      };
    }

    // Load image
    const image = await loadImage(imageUrl, imageBuffer);
    
    // Scan for QR codes
    const scanResult = await scanQRCode(image);
    
    if (!scanResult.found) {
      return {
        success: false,
        error: {
          code: 'NO_QR_FOUND',
          message: 'No QR code found in the image'
        }
      };
    }

    // Parse QR code data
    const parsedData = parseQRData(scanResult.data);
    
    return {
      success: true,
      result: {
        data: scanResult.data,
        parsedData: parsedData,
        location: scanResult.location,
        version: scanResult.version,
        formatted: formatScanResponse(scanResult.data, parsedData, scanResult.location)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'SCANQR_FAILED',
        message: error.message || 'Failed to scan QR code'
      }
    };
  }
}

async function loadImage(imageUrl, imageBuffer) {
  if (imageBuffer) {
    // Load from buffer
    return await Jimp.read(imageBuffer);
  } else {
    // Download from URL
    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'arraybuffer',
      timeout: 30000,
      maxContentLength: 10 * 1024 * 1024 // 10MB limit
    });
    
    return await Jimp.read(response.data);
  }
}

async function scanQRCode(image) {
  // Resize image if too large for performance
  const maxSize = 1000;
  if (image.bitmap.width > maxSize || image.bitmap.height > maxSize) {
    const scale = maxSize / Math.max(image.bitmap.width, image.bitmap.height);
    image.resize(Math.floor(image.bitmap.width * scale), Math.floor(image.bitmap.height * scale));
  }
  
  // Convert to grayscale for QR scanning
  image.grayscale();
  
  // Get image data for jsQR
  const imageData = {
    data: new Uint8ClampedArray(image.bitmap.data),
    width: image.bitmap.width,
    height: image.bitmap.height
  };
  
  // Scan for QR codes
  const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
  
  if (qrCode) {
    return {
      found: true,
      data: qrCode.data,
      location: {
        topLeft: qrCode.location.topLeftCorner,
        topRight: qrCode.location.topRightCorner,
        bottomLeft: qrCode.location.bottomLeftCorner,
        bottomRight: qrCode.location.bottomRightCorner
      },
      version: qrCode.version
    };
  }
  
  // Try multiple rotations if not found
  const rotations = [90, 180, 270];
  
  for (const rotation of rotations) {
    const rotatedImage = image.clone().rotate(rotation);
    const rotatedData = {
      data: new Uint8ClampedArray(rotatedImage.bitmap.data),
      width: rotatedImage.bitmap.width,
      height: rotatedImage.bitmap.height
    };
    
    const rotatedQR = jsQR(rotatedData.data, rotatedData.width, rotatedData.height);
    
    if (rotatedQR) {
      return {
        found: true,
        data: rotatedQR.data,
        location: {
          topLeft: rotatedQR.location.topLeftCorner,
          topRight: rotatedQR.location.topRightCorner,
          bottomLeft: rotatedQR.location.bottomLeftCorner,
          bottomRight: rotatedQR.location.bottomRightCorner
        },
        version: rotatedQR.version,
        rotated: rotation
      };
    }
  }
  
  return { found: false };
}

function parseQRData(data) {
  const result = {
    type: 'unknown',
    parsed: null,
    actionable: false
  };
  
  // Check for URL
  const urlRegex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;
  if (urlRegex.test(data)) {
    result.type = 'url';
    result.parsed = { url: data };
    result.actionable = true;
    return result;
  }
  
  // Check for WiFi
  const wifiRegex = /^WIFI:S:(.+);T:(.+);P:(.+);;$/i;
  const wifiMatch = data.match(wifiRegex);
  if (wifiMatch) {
    result.type = 'wifi';
    result.parsed = {
      ssid: wifiMatch[1],
      security: wifiMatch[2],
      password: wifiMatch[3]
    };
    result.actionable = true;
    return result;
  }
  
  // Check for vCard (contact)
  if (data.includes('BEGIN:VCARD') && data.includes('END:VCARD')) {
    result.type = 'contact';
    const vcardData = {};
    
    // Parse vCard fields
    const lines = data.split('\n');
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (key && value) {
          vcardData[key.toLowerCase()] = value;
        }
      }
    });
    
    result.parsed = vcardData;
    result.actionable = true;
    return result;
  }
  
  // Check for SMS
  const smsRegex = /^SMSTO:(.+):(.+)$/i;
  const smsMatch = data.match(smsRegex);
  if (smsMatch) {
    result.type = 'sms';
    result.parsed = {
      number: smsMatch[1],
      message: decodeURIComponent(smsMatch[2])
    };
    result.actionable = true;
    return result;
  }
  
  // Check for Email
  const emailRegex = /^mailto:(.+)\?(.+)$/i;
  const emailMatch = data.match(emailRegex);
  if (emailMatch) {
    result.type = 'email';
    const params = new URLSearchParams(emailMatch[2]);
    result.parsed = {
      to: emailMatch[1],
      subject: decodeURIComponent(params.get('subject') || ''),
      body: decodeURIComponent(params.get('body') || '')
    };
    result.actionable = true;
    return result;
  }
  
  // Check for plain text
  if (data.length < 500) { // Reasonable text length
    result.type = 'text';
    result.parsed = { text: data };
    result.actionable = false;
    return result;
  }
  
  // Default to binary/data
  result.type = 'data';
  result.parsed = { raw: data };
  result.actionable = false;
  return result;
}

function formatScanResponse(data, parsedData, location) {
  const typeEmoji = getQRTypeEmoji(parsedData.type);
  const dataPreview = data.length > 150 ? data.substring(0, 150) + '...' : data;
  
  let formatted = `🔍 *QR Code Scanned Successfully!*\n\n`;
  formatted += `${typeEmoji} *Type:* ${parsedData.type.charAt(0).toUpperCase() + parsedData.type.slice(1)}\n`;
  formatted += `📏 *Data Length:* ${data.length} characters\n\n`;
  
  formatted += `📝 *Content:*\n${dataPreview}\n\n`;
  
  // Show parsed information based on type
  if (parsedData.parsed) {
    formatted += `📋 *Parsed Information:*\n`;
    
    switch (parsedData.type) {
      case 'url':
        formatted += `🔗 URL: ${parsedData.parsed.url}\n`;
        formatted += `🌐 Can be opened in browser\n`;
        break;
        
      case 'wifi':
        formatted += `📶 SSID: ${parsedData.parsed.ssid}\n`;
        formatted += `🔒 Security: ${parsedData.parsed.security}\n`;
        formatted += `🔑 Password: ${parsedData.parsed.password}\n`;
        formatted += `📱 Can connect to WiFi\n`;
        break;
        
      case 'contact':
        formatted += `👤 Contact Information:\n`;
        if (parsedData.parsed.fn) formatted += `   Name: ${parsedData.parsed.fn}\n`;
        if (parsedData.parsed.tel) formatted += `   Phone: ${parsedData.parsed.tel}\n`;
        if (parsedData.parsed.email) formatted += `   Email: ${parsedData.parsed.email}\n`;
        formatted += `📇 Can save to contacts\n`;
        break;
        
      case 'sms':
        formatted += `📲 SMS to: ${parsedData.parsed.number}\n`;
        formatted += `💬 Message: ${parsedData.parsed.message}\n`;
        formatted += `📤 Can send SMS\n`;
        break;
        
      case 'email':
        formatted += `📧 Email to: ${parsedData.parsed.to}\n`;
        if (parsedData.parsed.subject) formatted += `📝 Subject: ${parsedData.parsed.subject}\n`;
        if (parsedData.parsed.body) formatted += `📄 Body: ${parsedData.parsed.body.substring(0, 100)}...\n`;
        formatted += `📨 Can compose email\n`;
        break;
        
      case 'text':
        formatted += `📝 Plain text content\n`;
        break;
        
      default:
        formatted += `🔧 Raw data\n`;
    }
  }
  
  if (location) {
    formatted += `\n📍 *QR Location in Image:*\n`;
    formatted += `   Top-Left: (${location.topLeft.x}, ${location.topLeft.y})\n`;
    formatted += `   Size: Detected\n`;
  }
  
  formatted += `\n✅ *Scan complete*\n`;
  formatted += `🎮 *Scan another:* Upload image with QR code`;
  
  return formatted;
}

function getQRTypeEmoji(type) {
  const emojis = {
    'url': '🔗',
    'wifi': '📶',
    'contact': '👤',
    'sms': '💬',
    'email': '📧',
    'text': '📝',
    'data': '🔧',
    'unknown': '❓'
  };
  
  return emojis[type] || '❓';
}

// Additional scanning utilities
scanqrFunction.batchScan = async function(imageUrls) {
  try {
    const results = [];
    
    for (const url of imageUrls.slice(0, 10)) { // Limit to 10 images
      try {
        const result = await scanqrFunction({ data: { imageUrl: url } });
        if (result.success) {
          results.push({
            url: url,
            success: true,
            data: result.result.data,
            type: result.result.parsedData.type
          });
        } else {
          results.push({
            url: url,
            success: false,
            error: result.error.message
          });
        }
      } catch (error) {
        results.push({
          url: url,
          success: false,
          error: error.message
        });
      }
    }
    
    return {
      success: true,
      results: results,
      formatted: formatBatchResults(results)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

function formatBatchResults(results) {
  let formatted = `🔍 *Batch QR Scan Results*\n\n`;
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  formatted += `📊 *Summary:*\n`;
  formatted += `   ✅ Successful: ${successful.length}\n`;
  formatted += `   ❌ Failed: ${failed.length}\n`;
  formatted += `   📁 Total: ${results.length}\n\n`;
  
  if (successful.length > 0) {
    formatted += `🏆 *Successful Scans:*\n`;
    
    successful.slice(0, 5).forEach((result, index) => {
      const typeEmoji = getQRTypeEmoji(result.type);
      formatted += `${index + 1}. ${typeEmoji} ${result.type}: ${result.data.substring(0, 50)}...\n`;
    });
    
    if (successful.length > 5) {
      formatted += `   ...and ${successful.length - 5} more\n`;
    }
  }
  
  if (failed.length > 0) {
    formatted += `\n⚠️ *Failed Scans:*\n`;
    formatted += `   ${failed.length} images had no QR codes or errors\n`;
  }
  
  return formatted;
}

module.exports = scanqrFunction;
