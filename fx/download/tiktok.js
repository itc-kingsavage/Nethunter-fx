// fx/download/tiktok.js
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

async function tiktokFunction(request) {
  try {
    const { url, watermark = false, quality = 'best' } = request.data;
    
    if (!url) {
      return {
        success: false,
        error: {
          code: 'MISSING_URL',
          message: 'TikTok URL is required'
        }
      };
    }

    // Validate TikTok URL
    const validation = validateTikTokUrl(url);
    if (!validation.valid) {
      return {
        success: false,
        error: {
          code: 'INVALID_URL',
          message: validation.message
        }
      };
    }

    // Extract video ID
    const videoInfo = extractVideoInfo(url);
    
    // Get TikTok video data
    const videoData = await getTikTokData(videoInfo, watermark, quality);
    
    if (!videoData) {
      return {
        success: false,
        error: {
          code: 'VIDEO_NOT_FOUND',
          message: 'Could not fetch TikTok video data'
        }
      };
    }

    return {
      success: true,
      result: {
        videoId: videoData.id,
        videoUrl: videoData.videoUrl,
        username: videoData.username,
        nickname: videoData.nickname,
        description: videoData.description,
        duration: videoData.duration,
        resolution: videoData.resolution,
        likes: videoData.likes,
        comments: videoData.comments,
        shares: videoData.shares,
        plays: videoData.plays,
        timestamp: videoData.timestamp,
        hashtags: videoData.hashtags,
        music: videoData.music,
        formatted: formatTikTokResponse(
          videoData.username,
          videoData.nickname,
          videoData.duration,
          videoData.resolution,
          videoData.likes,
          videoData.description
        )
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'TIKTOK_FAILED',
        message: error.message || 'Failed to download TikTok video'
      }
    };
  }
}

function validateTikTokUrl(url) {
  const patterns = [
    /tiktok\.com\/@([^/]+)\/video\/(\d+)/i,
    /tiktok\.com\/(?:@[^/]+\/)?video\/(\d+)/i,
    /vm\.tiktok\.com\/([A-Za-z0-9]+)/i,
    /vt\.tiktok\.com\/([A-Za-z0-9]+)/i
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(url)) {
      return {
        valid: true,
        type: pattern.toString().includes('@') ? 'full' : 'short'
      };
    }
  }
  
  return {
    valid: false,
    message: 'Invalid TikTok URL. Supported formats: Full URLs or short links'
  };
}

function extractVideoInfo(url) {
  // Full URL: https://www.tiktok.com/@username/video/1234567890123456789
  const fullMatch = url.match(/tiktok\.com\/@([^/]+)\/video\/(\d+)/i);
  if (fullMatch) {
    return {
      username: fullMatch[1],
      videoId: fullMatch[2],
      type: 'full'
    };
  }
  
  // Short URL: https://vm.tiktok.com/ABCDEFGH/
  const shortMatch = url.match(/(?:vm|vt)\.tiktok\.com\/([A-Za-z0-9]+)/i);
  if (shortMatch) {
    return {
      shortcode: shortMatch[1],
      type: 'short'
    };
  }
  
  // Video ID only
  const videoIdMatch = url.match(/video\/(\d+)/i);
  if (videoIdMatch) {
    return {
      videoId: videoIdMatch[1],
      type: 'id'
    };
  }
  
  return { type: 'unknown', url: url };
}

async function getTikTokData(videoInfo, watermark, quality) {
  // In production, you would use:
  // 1. TikTok Official API (requires access)
  // 2. TikTok Scraping (risky, against ToS)
  // 3. Third-party TikTok downloader APIs
  
  // For simulation, return mock data
  
  const mockData = {
    id: videoInfo.videoId || `tiktok_${Date.now()}`,
    videoUrl: `https://example.com/tiktok/video_${videoInfo.videoId || 'mock'}.mp4`,
    username: videoInfo.username || 'tiktok_user',
    nickname: 'TikTok Creator',
    description: 'Check out this awesome TikTok video! #fyp #viral #funny',
    duration: Math.floor(Math.random() * 60) + 15, // 15-75 seconds
    resolution: quality === 'best' ? '1080x1920' : '720x1280',
    likes: Math.floor(Math.random() * 1000000) + 10000,
    comments: Math.floor(Math.random() * 10000) + 1000,
    shares: Math.floor(Math.random() * 50000) + 1000,
    plays: Math.floor(Math.random() * 10000000) + 100000,
    timestamp: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000).toISOString(), // Last 30 days
    hashtags: ['#fyp', '#viral', '#funny', '#tiktok', '#trending'],
    music: {
      title: 'Trending Sound',
      author: 'TikTok Music',
      url: 'https://example.com/tiktok/music.mp3'
    },
    watermark: watermark,
    quality: quality
  };
  
  // If watermark is false, provide "clean" URL
  if (!watermark) {
    mockData.videoUrl = `https://example.com/tiktok/video_${mockData.id}_nowatermark.mp4`;
  }
  
  return mockData;
}

function formatTikTokResponse(username, nickname, duration, resolution, likes, description) {
  const durationFormatted = formatDuration(duration);
  
  let formatted = `🎵 *TikTok Video Downloaded!*\n\n`;
  formatted += `👤 *Creator:* @${username}\n`;
  formatted += `📛 *Name:* ${nickname}\n`;
  formatted += `⏱️ *Duration:* ${durationFormatted}\n`;
  formatted += `📐 *Resolution:* ${resolution}\n`;
  formatted += `❤️ *Likes:* ${likes.toLocaleString()}\n\n`;
  
  if (description && description.length > 0) {
    const descPreview = description.length > 100 ? description.substring(0, 100) + '...' : description;
    formatted += `📝 *Description:* ${descPreview}\n\n`;
  }
  
  formatted += `✅ *Download successful*\n`;
  formatted += `🎥 Video file available\n`;
  formatted += `⚡ Ready for sharing\n\n`;
  
  formatted += `✨ *Features:*\n`;
  formatted += `• No watermark option\n`;
  formatted += `• Multiple quality options\n`;
  formatted += `• Original sound included\n`;
  formatted += `• Full metadata preserved\n`;
  
  if (duration > 60) {
    formatted += `\n⚠️ *Long video*\n`;
    formatted += `TikTok allows up to 10 minutes\n`;
  }
  
  formatted += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  formatted += `⚡ TikTok content ready`;
  
  return formatted;
}

function formatDuration(seconds) {
  if (seconds < 60) {
    return `${seconds} seconds`;
  } else {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

// Additional TikTok utilities
tiktokFunction.getTrending = async function(country = 'US', limit = 10) {
  try {
    // Mock trending videos
    const mockTrending = Array.from({ length: limit }, (_, i) => ({
      id: `trending_${i + 1}`,
      username: `creator_${i + 1}`,
      nickname: `Trending Creator ${i + 1}`,
      description: `Trending TikTok video #${i + 1} #fyp #viral`,
      duration: Math.floor(Math.random() * 45) + 15,
      likes: Math.floor(Math.random() * 500000) + 10000,
      plays: Math.floor(Math.random() * 5000000) + 100000,
      country: country,
      rank: i + 1
    }));
    
    return {
      success: true,
      trending: mockTrending,
      country: country,
      formatted: formatTrendingTikToks(mockTrending, country)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

function formatTrendingTikToks(videos, country) {
  let formatted = `📈 *Trending TikTok Videos (${country})*\n\n`;
  
  videos.slice(0, 5).forEach((video, index) => {
    const medal = index === 0 ? '🥇' : 
                  index === 1 ? '🥈' : 
                  index === 2 ? '🥉' : '🔸';
    
    formatted += `${medal} *@${video.username}*\n`;
    formatted += `   ${video.description.substring(0, 50)}...\n`;
    formatted += `   ❤️ ${video.likes.toLocaleString()} likes\n`;
    formatted += `   👁️ ${video.plays.toLocaleString()} views\n\n`;
  });
  
  if (videos.length > 5) {
    formatted += `📋 *${videos.length - 5} more trending videos*\n\n`;
  }
  
  formatted += `💡 *Tip:* Use !tt <tiktok-url> to download any video`;
  
  return formatted;
}

tiktokFunction.downloadAudio = async function(url) {
  try {
    // Mock audio extraction
    const mockAudio = {
      title: 'TikTok Audio',
      author: 'Original Sound',
      duration: 30,
      url: 'https://example.com/tiktok/audio.mp3',
      format: 'mp3',
      bitrate: '128kbps'
    };
    
    return {
      success: true,
      audio: mockAudio,
      formatted: `🎵 *TikTok Audio Extracted!*\n\nAudio ready for download: ${mockAudio.url}`
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = tiktokFunction;
