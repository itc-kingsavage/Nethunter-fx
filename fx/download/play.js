// fx/download/play.js
const axios = require('axios');
const ytdl = require('ytdl-core');
const { v4: uuidv4 } = require('uuid');

async function playFunction(request) {
  try {
    const { query, platform = 'youtube', quality = 'highest', duration = 'short' } = request.data;
    
    if (!query) {
      return {
        success: false,
        error: {
          code: 'MISSING_QUERY',
          message: 'Search query or URL is required'
        }
      };
    }

    let result;
    
    // Check if input is a URL
    if (isUrl(query)) {
      // Direct URL download
      result = await downloadFromUrl(query, platform, quality);
    } else {
      // Search for media
      result = await searchAndDownload(query, platform, quality, duration);
    }
    
    return {
      success: true,
      result: {
        title: result.title,
        url: result.url,
        duration: result.duration,
        platform: result.platform,
        quality: result.quality,
        downloadUrl: result.downloadUrl,
        thumbnail: result.thumbnail,
        formatted: formatPlayResponse(result.title, result.duration, result.platform, result.quality)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'PLAY_FAILED',
        message: error.message || 'Failed to play/download media'
      }
    };
  }
}

function isUrl(string) {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

async function downloadFromUrl(url, platform, quality) {
  switch (platform) {
    case 'youtube':
      return await downloadFromYouTube(url, quality);
    case 'soundcloud':
      return await downloadFromSoundCloud(url, quality);
    case 'spotify':
      return await downloadFromSpotify(url, quality);
    default:
      throw new Error(`Platform ${platform} not supported`);
  }
}

async function downloadFromYouTube(url, quality) {
  try {
    // Validate YouTube URL
    if (!ytdl.validateURL(url)) {
      throw new Error('Invalid YouTube URL');
    }
    
    // Get video info
    const info = await ytdl.getInfo(url);
    const videoDetails = info.videoDetails;
    
    // Choose format based on quality
    let format;
    if (quality === 'highest') {
      format = ytdl.chooseFormat(info.formats, { quality: 'highest' });
    } else if (quality === 'lowest') {
      format = ytdl.chooseFormat(info.formats, { quality: 'lowest' });
    } else if (quality === 'audio') {
      format = ytdl.chooseFormat(info.formats, { filter: 'audioonly' });
    } else {
      // Try to match resolution like '720p', '1080p'
      const resolution = quality.replace('p', '');
      format = ytdl.chooseFormat(info.formats, { 
        quality: resolution + 'p',
        filter: format => format.hasVideo && format.hasAudio
      });
    }
    
    if (!format) {
      throw new Error(`No format available for quality: ${quality}`);
    }
    
    // Generate stream URL (ytdl-core provides direct download)
    const downloadUrl = format.url;
    
    return {
      title: videoDetails.title,
      url: url,
      duration: parseInt(videoDetails.lengthSeconds),
      platform: 'youtube',
      quality: format.qualityLabel || quality,
      downloadUrl: downloadUrl,
      thumbnail: videoDetails.thumbnails[0]?.url,
      format: format.container,
      size: format.contentLength ? parseInt(format.contentLength) : null
    };
    
  } catch (error) {
    throw new Error(`YouTube download failed: ${error.message}`);
  }
}

async function downloadFromSoundCloud(url, quality) {
  // SoundCloud download simulation
  // In production, you would use soundcloud-dl or similar
  
  return {
    title: 'SoundCloud Track',
    url: url,
    duration: 180, // 3 minutes
    platform: 'soundcloud',
    quality: '128kbps',
    downloadUrl: `${url}/download`, // Mock
    thumbnail: 'https://soundcloud.com/thumbnail.jpg',
    format: 'mp3'
  };
}

async function downloadFromSpotify(url, quality) {
  // Spotify download simulation
  // In production, you would need Spotify API or use spotify-dl
  
  return {
    title: 'Spotify Track',
    url: url,
    duration: 210, // 3.5 minutes
    platform: 'spotify',
    quality: 'high',
    downloadUrl: `${url}/stream`, // Mock
    thumbnail: 'https://spotify.com/thumbnail.jpg',
    format: 'ogg'
  };
}

async function searchAndDownload(query, platform, quality, durationFilter) {
  // Search for media based on query
  const searchResults = await searchMedia(query, platform, durationFilter);
  
  if (searchResults.length === 0) {
    throw new Error(`No results found for "${query}"`);
  }
  
  // Pick first result or filter by duration
  let selectedResult = searchResults[0];
  
  if (durationFilter === 'short' && searchResults.length > 1) {
    const shortResults = searchResults.filter(r => r.duration < 300); // < 5 minutes
    if (shortResults.length > 0) {
      selectedResult = shortResults[0];
    }
  } else if (durationFilter === 'long' && searchResults.length > 1) {
    const longResults = searchResults.filter(r => r.duration > 300); // > 5 minutes
    if (longResults.length > 0) {
      selectedResult = longResults[0];
    }
  }
  
  // Download the selected result
  return await downloadFromUrl(selectedResult.url, platform, quality);
}

async function searchMedia(query, platform, durationFilter) {
  // Mock search results
  // In production, use YouTube Data API, SoundCloud API, etc.
  
  const mockResults = [
    {
      title: `${query} - Official Music Video`,
      url: `https://www.youtube.com/watch?v=mock1`,
      duration: 240, // 4 minutes
      thumbnail: `https://i.ytimg.com/vi/mock1/hqdefault.jpg`,
      platform: 'youtube',
      views: '1.5M'
    },
    {
      title: `${query} - Live Performance`,
      url: `https://www.youtube.com/watch?v=mock2`,
      duration: 360, // 6 minutes
      thumbnail: `https://i.ytimg.com/vi/mock2/hqdefault.jpg`,
      platform: 'youtube',
      views: '850K'
    },
    {
      title: `${query} - Audio Only`,
      url: `https://www.youtube.com/watch?v=mock3`,
      duration: 210, // 3.5 minutes
      thumbnail: `https://i.ytimg.com/vi/mock3/hqdefault.jpg`,
      platform: 'youtube',
      views: '2.1M'
    }
  ];
  
  return mockResults;
}

function formatPlayResponse(title, duration, platform, quality) {
  const durationFormatted = formatDuration(duration);
  const platformEmoji = platform === 'youtube' ? '📺' : 
                        platform === 'soundcloud' ? '🎵' : 
                        platform === 'spotify' ? '🎧' : '🎬';
  
  let formatted = `${platformEmoji} *Media Ready to Play!*\n\n`;
  formatted += `🎵 *Title:* ${title}\n`;
  formatted += `⏱️ *Duration:* ${durationFormatted}\n`;
  formatted += `📱 *Platform:* ${platform.charAt(0).toUpperCase() + platform.slice(1)}\n`;
  formatted += `⚡ *Quality:* ${quality}\n\n`;
  
  formatted += `✅ *Download available*\n`;
  formatted += `🎧 Can be played directly\n`;
  formatted += `📥 Stream or download\n\n`;
  
  formatted += `📋 *Supported platforms:*\n`;
  formatted += `• YouTube (videos/audio)\n`;
  formatted += `• SoundCloud (tracks)\n`;
  formatted += `• Spotify (tracks)\n`;
  formatted += `• Direct URLs\n`;
  
  formatted += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  formatted += `⚡ Use the download URL to get the media`;
  
  return formatted;
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Additional utilities
playFunction.getInfo = async function(url) {
  try {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const info = await ytdl.getInfo(url);
      return {
        success: true,
        info: {
          title: info.videoDetails.title,
          duration: info.videoDetails.lengthSeconds,
          author: info.videoDetails.author.name,
          views: info.videoDetails.viewCount,
          uploadDate: info.videoDetails.uploadDate,
          description: info.videoDetails.description.substring(0, 200) + '...',
          formats: info.formats.map(f => ({
            quality: f.qualityLabel,
            container: f.container,
            hasVideo: f.hasVideo,
            hasAudio: f.hasAudio
          }))
        }
      };
    }
    
    return {
      success: false,
      error: 'URL analysis not supported for this platform'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = playFunction;
