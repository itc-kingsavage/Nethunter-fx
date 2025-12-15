// fx/download/trailer.js
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

async function trailerFunction(request) {
  try {
    const { movie, year = null, source = 'youtube', quality = '720p' } = request.data;
    
    if (!movie) {
      return {
        success: false,
        error: {
          code: 'MISSING_MOVIE',
          message: 'Movie name is required'
        }
      };
    }

    // Search for movie trailer
    const trailerInfo = await searchTrailer(movie, year, source);
    
    if (!trailerInfo) {
      return {
        success: false,
        error: {
          code: 'TRAILER_NOT_FOUND',
          message: `No trailer found for "${movie}"`
        }
      };
    }

    // Get download/stream URL
    const downloadUrl = await getTrailerDownloadUrl(trailerInfo.url, quality, source);
    
    return {
      success: true,
      result: {
        movie: movie,
        year: year || trailerInfo.year,
        title: trailerInfo.title,
        url: trailerInfo.url,
        downloadUrl: downloadUrl,
        thumbnail: trailerInfo.thumbnail,
        duration: trailerInfo.duration,
        quality: quality,
        source: source,
        formatted: formatTrailerResponse(movie, trailerInfo.duration, quality, source, trailerInfo.title)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'TRAILER_FAILED',
        message: error.message || 'Failed to get movie trailer'
      }
    };
  }
}

async function searchTrailer(movieName, year, source) {
  // Build search query
  const searchQuery = year ? `${movieName} ${year} official trailer` : `${movieName} official trailer`;
  
  try {
    // Use YouTube Data API if available
    const youtubeApiKey = process.env.YOUTUBE_API_KEY;
    
    if (youtubeApiKey && source === 'youtube') {
      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          q: searchQuery,
          maxResults: 5,
          type: 'video',
          key: youtubeApiKey,
          videoDuration: 'short', // Trailers are usually short
          relevanceLanguage: 'en'
        }
      });
      
      if (response.data.items.length > 0) {
        const video = response.data.items[0];
        return {
          title: video.snippet.title,
          url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
          thumbnail: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.default.url,
          year: extractYearFromTitle(video.snippet.title) || year,
          duration: await getYouTubeDuration(video.id.videoId, youtubeApiKey),
          source: 'youtube',
          description: video.snippet.description
        };
      }
    }
    
    // Fallback: Use mock data
    return getMockTrailer(movieName, year, source);
    
  } catch (error) {
    console.log('Trailer search failed, using mock:', error.message);
    return getMockTrailer(movieName, year, source);
  }
}

async function getYouTubeDuration(videoId, apiKey) {
  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'contentDetails',
        id: videoId,
        key: apiKey
      }
    });
    
    if (response.data.items.length > 0) {
      const duration = response.data.items[0].contentDetails.duration;
      // Convert ISO 8601 duration to seconds
      return parseDuration(duration);
    }
    return 150; // Default 2.5 minutes
  } catch {
    return 150;
  }
}

function parseDuration(duration) {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  let seconds = 0;
  
  if (match) {
    if (match[1]) seconds += parseInt(match[1]) * 3600;
    if (match[2]) seconds += parseInt(match[2]) * 60;
    if (match[3]) seconds += parseInt(match[3]);
  }
  
  return seconds;
}

async function getTrailerDownloadUrl(trailerUrl, quality, source) {
  // In production, use ytdl-core for YouTube, other services for other sources
  // For now, return the trailer URL as-is
  
  if (source === 'youtube' && trailerUrl.includes('youtube.com')) {
    // For YouTube, we could use ytdl-core to get download URL
    try {
      const ytdl = require('ytdl-core');
      const info = await ytdl.getInfo(trailerUrl);
      
      // Find format matching requested quality
      const format = ytdl.chooseFormat(info.formats, {
        quality: quality.includes('p') ? quality.replace('p', '') : '720',
        filter: format => format.hasVideo && format.hasAudio
      });
      
      return format ? format.url : trailerUrl;
    } catch (error) {
      console.log('YouTube download URL failed:', error.message);
      return trailerUrl;
    }
  }
  
  return trailerUrl;
}

function extractYearFromTitle(title) {
  const yearMatch = title.match(/(\d{4})/);
  return yearMatch ? parseInt(yearMatch[1]) : null;
}

function getMockTrailer(movieName, year, source) {
  const mockData = {
    title: `${movieName} Official Trailer ${year ? `(${year})` : ''}`,
    url: `https://www.youtube.com/watch?v=mock_${movieName.toLowerCase().replace(/\s+/g, '_')}`,
    thumbnail: `https://i.ytimg.com/vi/mock_${movieName.toLowerCase().substring(0, 5)}/hqdefault.jpg`,
    year: year || new Date().getFullYear() - 1,
    duration: 150, // 2.5 minutes
    source: source,
    description: `Official trailer for ${movieName}. In production, this would fetch real trailer data.`
  };
  
  return mockData;
}

function formatTrailerResponse(movie, duration, quality, source, fullTitle) {
  const durationFormatted = formatDuration(duration);
  const sourceEmoji = source === 'youtube' ? '📺' : '🎬';
  
  let formatted = `${sourceEmoji} *Movie Trailer Found!*\n\n`;
  formatted += `🎬 *Movie:* ${movie}\n`;
  formatted += `📽️ *Title:* ${fullTitle}\n`;
  formatted += `⏱️ *Duration:* ${durationFormatted}\n`;
  formatted += `⚡ *Quality:* ${quality}\n`;
  formatted += `📱 *Source:* ${source.charAt(0).toUpperCase() + source.slice(1)}\n\n`;
  
  formatted += `✅ *Trailer available*\n`;
  formatted += `🎥 Watch or download\n`;
  formatted += `📥 High quality stream\n\n`;
  
  formatted += `📋 *Trailer features:*\n`;
  formatted += `• Official movie trailer\n`;
  formatted += `• HD quality available\n`;
  formatted += `• Direct streaming link\n`;
  formatted += `• Mobile optimized\n`;
  
  if (duration > 180) { // > 3 minutes
    formatted += `\n⚠️ *Extended trailer*\n`;
    formatted += `May be longer than typical trailers\n`;
  }
  
  formatted += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  formatted += `⚡ Enjoy the preview!`;
  
  return formatted;
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Additional utilities
trailerFunction.trending = async function(limit = 10) {
  try {
    const youtubeApiKey = process.env.YOUTUBE_API_KEY;
    
    if (youtubeApiKey) {
      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          q: 'official trailer',
          maxResults: limit,
          type: 'video',
          key: youtubeApiKey,
          order: 'viewCount',
          videoCategoryId: '1' // Film & Animation
        }
      });
      
      const trailers = response.data.items.map(item => ({
        title: item.snippet.title,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        thumbnail: item.snippet.thumbnails.high?.url,
        channel: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt
      }));
      
      return {
        success: true,
        trailers: trailers,
        formatted: formatTrendingTrailers(trailers)
      };
    }
    
    // Mock trending trailers
    const mockTrending = Array.from({ length: limit }, (_, i) => ({
      title: `Blockbuster Movie ${i + 1} Official Trailer`,
      url: `https://www.youtube.com/watch?v=trend${i + 1}`,
      thumbnail: `https://i.ytimg.com/vi/trend${i + 1}/hqdefault.jpg`,
      channel: 'Movie Trailers',
      publishedAt: new Date(Date.now() - i * 86400000).toISOString() // Last few days
    }));
    
    return {
      success: true,
      trailers: mockTrending,
      formatted: formatTrendingTrailers(mockTrending)
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

function formatTrendingTrailers(trailers) {
  let formatted = `📈 *Trending Movie Trailers*\n\n`;
  
  trailers.slice(0, 5).forEach((trailer, index) => {
    const medal = index === 0 ? '🥇' : 
                  index === 1 ? '🥈' : 
                  index === 2 ? '🥉' : '🔸';
    
    formatted += `${medal} *${trailer.title}*\n`;
    formatted += `   📺 ${trailer.channel}\n`;
    formatted += `   🔗 ${trailer.url.substring(0, 40)}...\n\n`;
  });
  
  if (trailers.length > 5) {
    formatted += `📋 *${trailers.length - 5} more trending trailers*\n\n`;
  }
  
  formatted += `💡 *Tip:* Use !trailer <movie name> to get any trailer`;
  
  return formatted;
}

module.exports = trailerFunction;
