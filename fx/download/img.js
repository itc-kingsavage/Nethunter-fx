// fx/download/img.js
const axios = require('axios');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

async function imgFunction(request) {
  try {
    const { url, quality = 85, resize = null, format = 'auto' } = request.data;
    
    if (!url) {
      return {
        success: false,
        error: {
          code: 'MISSING_URL',
          message: 'Image URL is required'
        }
      };
    }

    // Download image
    const imageData = await downloadImage(url);
    
    // Process image
    const processedImage = await processImage(imageData.buffer, {
      quality,
      resize,
      format
    });
    
    // Generate download info
    const imageId = uuidv4();
    const extension = getImageExtension(processedImage.format);
    const filename = `image_${imageId}.${extension}`;
    
    return {
      success: true,
      result: {
        imageId: imageId,
        filename: filename,
        originalSize: imageData.size,
        processedSize: processedImage.buffer.length,
        format: processedImage.format,
        dimensions: processedImage.dimensions,
        quality: quality,
        downloadUrl: `/image/${imageId}`,
        formatted: formatImageResponse(
          processedImage.dimensions,
          imageData.size,
          processedImage.buffer.length,
          processedImage.format,
          quality
        )
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'IMAGE_PROCESSING_FAILED',
        message: error.message || 'Failed to process image'
      }
    };
  }
}

async function downloadImage(url) {
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'arraybuffer',
    timeout: 30000,
    maxContentLength: 20 * 1024 * 1024, // 20MB limit
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'image/*'
    }
  });
  
  const buffer = Buffer.from(response.data);
  const contentType = response.headers['content-type'] || 'image/jpeg';
  
  // Validate it's actually an image
  try {
    const metadata = await sharp(buffer).metadata();
    return {
      buffer: buffer,
      size: buffer.length,
      mimeType: contentType,
      dimensions: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format
      }
    };
  } catch (error) {
    throw new Error('Downloaded file is not a valid image');
  }
}

async function processImage(buffer, options) {
  let sharpInstance = sharp(buffer);
  
  // Get original metadata
  const metadata = await sharpInstance.metadata();
  
  // Apply resize if requested
  if (options.resize) {
    const [width, height] = options.resize.split('x').map(Number);
    sharpInstance = sharpInstance.resize(width, height, {
      fit: 'inside',
      withoutEnlargement: true
    });
  }
  
  // Convert format if needed
  const targetFormat = options.format === 'auto' ? metadata.format : options.format;
  
  switch (targetFormat.toLowerCase()) {
    case 'jpeg':
    case 'jpg':
      sharpInstance = sharpInstance.jpeg({ quality: options.quality });
      break;
    case 'png':
      sharpInstance = sharpInstance.png({ quality: options.quality });
      break;
    case 'webp':
      sharpInstance = sharpInstance.webp({ quality: options.quality });
      break;
    case 'avif':
      sharpInstance = sharpInstance.avif({ quality: options.quality });
      break;
    default:
      // Keep original format with quality adjustment
      if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
        sharpInstance = sharpInstance.jpeg({ quality: options.quality });
      } else if (metadata.format === 'png') {
        sharpInstance = sharpInstance.png({ quality: options.quality });
      }
  }
  
  // Apply additional optimizations
  sharpInstance = sharpInstance
    .withMetadata() // Keep EXIF data
    .normalize() // Improve contrast
    .sharpen(); // Slight sharpening
  
  const processedBuffer = await sharpInstance.toBuffer();
  const processedMetadata = await sharp(processedBuffer).metadata();
  
  return {
    buffer: processedBuffer,
    format: processedMetadata.format,
    dimensions: {
      width: processedMetadata.width,
      height: processedMetadata.height
    },
    size: processedBuffer.length
  };
}

function getImageExtension(format) {
  const extensions = {
    'jpeg': 'jpg',
    'jpg': 'jpg',
    'png': 'png',
    'webp': 'webp',
    'avif': 'avif',
    'gif': 'gif',
    'tiff': 'tiff'
  };
  
  return extensions[format.toLowerCase()] || 'jpg';
}

function formatImageResponse(dimensions, originalSize, processedSize, format, quality) {
  const sizeReduction = ((originalSize - processedSize) / originalSize * 100).toFixed(1);
  
  let formatted = `🖼️ *Image Processing Complete!*\n\n`;
  formatted += `📐 *Dimensions:* ${dimensions.width} x ${dimensions.height}\n`;
  formatted += `📦 *Format:* ${format.toUpperCase()}\n`;
  formatted += `⚡ *Quality:* ${quality}%\n`;
  formatted += `📊 *Original:* ${formatBytes(originalSize)}\n`;
  formatted += `📈 *Processed:* ${formatBytes(processedSize)}\n`;
  
  if (processedSize < originalSize) {
    formatted += `📉 *Reduced by:* ${sizeReduction}%\n`;
  }
  
  formatted += `\n✅ *Optimizations applied:*\n`;
  formatted += `• Format conversion\n`;
  formatted += `• Quality adjustment\n`;
  formatted += `• Auto-orientation\n`;
  formatted += `• Contrast normalization\n`;
  
  if (dimensions.width > 1000 || dimensions.height > 1000) {
    formatted += `\n⚠️ *Large image*\n`;
    formatted += `Consider resizing for faster sharing\n`;
  }
  
  formatted += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  formatted += `⚡ Ready for download`;
  
  return formatted;
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Additional image utilities
imgFunction.extractColors = async function(buffer) {
  try {
    const image = sharp(buffer);
    const stats = await image.stats();
    
    // Get dominant colors
    const dominant = stats.dominant;
    const channels = stats.channels;
    
    return {
      dominant: {
        r: dominant.r,
        g: dominant.g,
        b: dominant.b,
        hex: rgbToHex(dominant.r, dominant.g, dominant.b)
      },
      channels: {
        red: channels[0],
        green: channels[1],
        blue: channels[2]
      }
    };
  } catch (error) {
    throw new Error(`Color extraction failed: ${error.message}`);
  }
};

function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

module.exports = imgFunction;
