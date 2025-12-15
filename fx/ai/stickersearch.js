// fx/ai/stickersearch.js
const axios = require('axios');
const sharp = require('sharp');

async function stickersearchFunction(request) {
  try {
    const { query, searchType = 'sticker', format = 'webp', limit = 10 } = request.data;
    
    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: {
          code: 'MISSING_QUERY',
          message: 'Search query is required'
        }
      };
    }

    const cleanQuery = query.trim();
    
    // Search for stickers
    const stickers = await searchStickers(cleanQuery, searchType, limit);
    
    if (stickers.length === 0) {
      return {
        success: false,
        error: {
          code: 'NO_RESULTS',
          message: `No stickers found for "${cleanQuery}"`
        }
      };
    }

    // Optionally convert format
    const processedStickers = await Promise.all(
      stickers.map(sticker => processSticker(sticker, format))
    );

    return {
      success: true,
      result: {
        query: cleanQuery,
        stickers: processedStickers,
        count: processedStickers.length,
        formatted: formatStickerResults(cleanQuery, processedStickers)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'STICKERSEARCH_FAILED',
        message: error.message || 'Failed to search for stickers'
      }
    };
  }
}

async function searchStickers(query, searchType, limit) {
  try {
    // Try Giphy API for sticker search
    const giphyApiKey = process.env.GIPHY_API_KEY;
    
    if (giphyApiKey) {
      const giphyResponse = await axios.get('https://api.giphy.com/v1/stickers/search', {
        params: {
          api_key: giphyApiKey,
          q: query,
          limit: Math.min(limit, 25),
          rating: 'g',
          lang: 'en'
        },
        timeout: 10000
      });
      
      return giphyResponse.data.data.map(gif => ({
        id: gif.id,
        title: gif.title || query,
        url: gif.images.original.url,
        preview: gif.images.preview_gif?.url || gif.images.fixed_height_small.url,
        source: 'giphy',
        dimensions: {
          width: gif.images.original.width,
          height: gif.images.original.height
        },
        size: gif.images.original.size
      }));
    }
    
    // Fallback to Tenor API
    const tenorApiKey = process.env.TENOR_API_KEY;
    
    if (tenorApiKey) {
      const tenorResponse = await axios.get('https://tenor.googleapis.com/v2/search', {
        params: {
          key: tenorApiKey,
          q: query,
          limit: Math.min(limit, 20),
          media_filter: 'minimal',
          contentfilter: 'high'
        },
        timeout: 10000
      });
      
      return tenorResponse.data.results.map(result => ({
        id: result.id,
        title: result.content_description || query,
        url: result.media_formats.gif.url,
        preview: result.media_formats.tinygif.url,
        source: 'tenor',
        dimensions: {
          width: result.media_formats.gif.dims[0],
          height: result.media_formats.gif.dims[1]
        }
      }));
    }
    
    // Ultimate fallback: mock data
    return getMockStickers(query, limit);
    
  } catch (error) {
    console.log('Sticker API failed, using mock data:', error.message);
    return getMockStickers(query, limit);
  }
}

async function processSticker(sticker, targetFormat) {
  try {
    if (targetFormat === 'webp' && sticker.url.endsWith('.gif')) {
      // Convert GIF to WebP (first frame only for stickers)
      const response = await axios({
        method: 'GET',
        url: sticker.preview || sticker.url,
        responseType: 'arraybuffer',
        timeout: 15000
      });
      
      const buffer = Buffer.from(response.data);
      
      // Convert to WebP using sharp
      const webpBuffer = await sharp(buffer, { animated: false })
        .resize(512, 512, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality: 80 })
        .toBuffer();
      
      return {
        ...sticker,
        processed: true,
        format: 'webp',
        buffer: webpBuffer,
        size: webpBuffer.length,
        dimensions: { width: 512, height: 512 }
      };
    }
    
    // Return original if no conversion needed or if conversion fails
    return {
      ...sticker,
      processed: false,
      format: sticker.url.split('.').pop(),
      buffer: null // Not loaded to save memory
    };
    
  } catch (error) {
    console.log('Sticker processing failed:', error.message);
    return {
      ...sticker,
      processed: false,
      format: sticker.url.split('.').pop(),
      error: error.message
    };
  }
}

function getMockStickers(query, limit) {
  const mockStickers = [
    {
      id: 'mock1',
      title: `${query} Sticker 1`,
      url: `https://via.placeholder.com/512/FF6B6B/FFFFFF?text=${encodeURIComponent(query.substring(0, 10))}`,
      preview: `https://via.placeholder.com/128/FF6B6B/FFFFFF?text=${encodeURIComponent(query.substring(0, 5))}`,
      source: 'mock',
      dimensions: { width: 512, height: 512 },
      size: 10240
    },
    {
      id: 'mock2',
      title: `${query} Sticker 2`,
      url: `https://via.placeholder.com/512/4ECDC4/FFFFFF?text=${encodeURIComponent(query.substring(0, 10))}`,
      preview: `https://via.placeholder.com/128/4ECDC4/FFFFFF?text=${encodeURIComponent(query.substring(0, 5))}`,
      source: 'mock',
      dimensions: { width: 512, height: 512 },
      size: 10240
    },
    {
      id: 'mock3',
      title: `${query} Sticker 3`,
      url: `https://via.placeholder.com/512/45B7D1/FFFFFF?text=${encodeURIComponent(query.substring(0, 10))}`,
      preview: `https://via.placeholder.com/128/45B7D1/FFFFFF?text=${encodeURIComponent(query.substring(0, 5))}`,
      source: 'mock',
      dimensions: { width: 512, height: 512 },
      size: 10240
    }
  ];
  
  return mockStickers.slice(0, limit);
}

function formatStickerResults(query, stickers) {
  let formatted = `🖼️ *Sticker Search: "${query}"*\n\n`;
  formatted += `Found ${stickers.length} sticker${stickers.length !== 1 ? 's' : ''}\n\n`;
  
  stickers.slice(0, 5).forEach((sticker, index) => {
    formatted += `${index + 1}. *${sticker.title}*\n`;
    formatted += `📏 ${sticker.dimensions.width}x${sticker.dimensions.height}\n`;
    formatted += `📦 ${sticker.source.toUpperCase()}\n`;
    
    if (sticker.processed) {
      formatted += `✨ Converted to ${sticker.format.toUpperCase()}\n`;
      formatted += `📊 ${Math.round(sticker.size / 1024)}KB\n`;
    }
    
    formatted += `🔗 ${sticker.url.substring(0, 50)}...\n\n`;
  });
  
  if (stickers.length > 5) {
    formatted += `📋 *${stickers.length - 5} more stickers available*\n`;
  }
  
  formatted += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  formatted += `💡 *Tip:* Use these URLs directly in WhatsApp sticker packs`;
  
  return formatted;
}

// Additional features
stickersearchFunction.trending = async function(limit = 10) {
  try {
    const giphyApiKey = process.env.GIPHY_API_KEY;
    
    if (giphyApiKey) {
      const response = await axios.get('https://api.giphy.com/v1/stickers/trending', {
        params: {
          api_key: giphyApiKey,
          limit: limit,
          rating: 'g'
        }
      });
      
      return {
        success: true,
        stickers: response.data.data
      };
    }
    
    // Return mock trending stickers
    const mockTrending = Array.from({ length: limit }, (_, i) => ({
      id: `trend${i + 1}`,
      title: `Trending Sticker ${i + 1}`,
      url: `https://via.placeholder.com/512/FF6B6B/FFFFFF?text=Trend${i + 1}`,
      source: 'mock',
      rank: i + 1
    }));
    
    return {
      success: true,
      stickers: mockTrending
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = stickersearchFunction;
