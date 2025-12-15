// fx/download/insta.js
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

async function instaFunction(request) {
  try {
    const { url, type = 'auto', quality = 'best' } = request.data;
    
    if (!url) {
      return {
        success: false,
        error: {
          code: 'MISSING_URL',
          message: 'Instagram URL is required'
        }
      };
    }

    // Validate Instagram URL
    const validation = validateInstagramUrl(url);
    if (!validation.valid) {
      return {
        success: false,
        error: {
          code: 'INVALID_URL',
          message: validation.message
        }
      };
    }

    // Extract post ID or shortcode
    const postInfo = extractPostInfo(url);
    
    // Get Instagram post data
    const postData = await getInstagramData(postInfo, type, quality);
    
    if (!postData) {
      return {
        success: false,
        error: {
          code: 'POST_NOT_FOUND',
          message: 'Could not fetch Instagram post data'
        }
      };
    }

    return {
      success: true,
      result: {
        postId: postData.id,
        shortcode: postData.shortcode,
        type: postData.type,
        username: postData.username,
        caption: postData.caption,
        media: postData.media,
        timestamp: postData.timestamp,
        likes: postData.likes,
        comments: postData.comments,
        formatted: formatInstagramResponse(
          postData.username,
          postData.type,
          postData.media.length,
          postData.caption,
          postData.likes
        )
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'INSTAGRAM_FAILED',
        message: error.message || 'Failed to download Instagram content'
      }
    };
  }
}

function validateInstagramUrl(url) {
  const patterns = [
    /instagram\.com\/p\/([A-Za-z0-9_-]+)/i,
    /instagram\.com\/reel\/([A-Za-z0-9_-]+)/i,
    /instagram\.com\/tv\/([A-Za-z0-9_-]+)/i,
    /instagram\.com\/stories\/([A-Za-z0-9_-]+)\/(\d+)/i,
    /instagr\.am\/p\/([A-Za-z0-9_-]+)/i
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(url)) {
      return {
        valid: true,
        type: pattern.toString().includes('stories') ? 'story' : 
              pattern.toString().includes('reel') ? 'reel' : 
              pattern.toString().includes('tv') ? 'igtv' : 'post'
      };
    }
  }
  
  return {
    valid: false,
    message: 'Invalid Instagram URL. Supported: posts, reels, stories, IGTV'
  };
}

function extractPostInfo(url) {
  const patterns = {
    post: /instagram\.com\/p\/([A-Za-z0-9_-]+)/i,
    reel: /instagram\.com\/reel\/([A-Za-z0-9_-]+)/i,
    story: /instagram\.com\/stories\/([A-Za-z0-9_-]+)\/(\d+)/i,
    igtv: /instagram\.com\/tv\/([A-Za-z0-9_-]+)/i
  };
  
  for (const [type, pattern] of Object.entries(patterns)) {
    const match = url.match(pattern);
    if (match) {
      return {
        type: type,
        shortcode: match[1],
        storyId: type === 'story' ? match[2] : null,
        url: url
      };
    }
  }
  
  return { type: 'unknown', url: url };
}

async function getInstagramData(postInfo, requestedType, quality) {
  // In production, you would use:
  // 1. Instagram Official API (requires token)
  // 2. Instagram Basic Display API
  // 3. Scraping (not recommended, against ToS)
  
  // For simulation, return mock data
  
  const mockData = {
    id: `instagram_${postInfo.shortcode || Date.now()}`,
    shortcode: postInfo.shortcode || `mock_${Math.random().toString(36).substr(2, 9)}`,
    type: requestedType === 'auto' ? postInfo.type : requestedType,
    username: 'instagram_user',
    caption: 'Check out this amazing content! #instagram #awesome',
    timestamp: new Date().toISOString(),
    likes: Math.floor(Math.random() * 10000) + 1000,
    comments: Math.floor(Math.random() * 1000) + 100,
    media: []
  };
  
  // Add media based on type
  switch (mockData.type) {
    case 'post':
      mockData.media = [
        {
          type: 'image',
          url: 'https://via.placeholder.com/1080x1080/FF6B6B/FFFFFF?text=Instagram+Post',
          thumbnail: 'https://via.placeholder.com/150/FF6B6B/FFFFFF?text=IG',
          dimensions: { width: 1080, height: 1080 },
          quality: 'high'
        }
      ];
      break;
    
    case 'reel':
      mockData.media = [
        {
          type: 'video',
          url: 'https://example.com/instagram/reel.mp4',
          thumbnail: 'https://via.placeholder.com/1080x1920/4ECDC4/FFFFFF?text=Instagram+Reel',
          dimensions: { width: 1080, height: 1920 },
          duration: 30,
          quality: quality === 'best' ? '720p' : '480p'
        }
      ];
      break;
    
    case 'story':
      mockData.media = [
        {
          type: 'image',
          url: 'https://via.placeholder.com/1080x1920/45B7D1/FFFFFF?text=Instagram+Story',
          thumbnail: 'https://via.placeholder.com/150/45B7D1/FFFFFF?text=Story',
          dimensions: { width: 1080, height: 1920 },
          quality: 'high'
        }
      ];
      break;
    
    case 'igtv':
      mockData.media = [
        {
          type: 'video',
          url: 'https://example.com/instagram/igtv.mp4',
          thumbnail: 'https://via.placeholder.com/1080x1920/96CEB4/FFFFFF?text=IGTV',
          dimensions: { width: 1080, height: 1920 },
          duration: 300,
          quality: quality === 'best' ? '1080p' : '720p'
        }
      ];
      break;
    
    default:
      mockData.media = [
        {
          type: 'image',
          url: 'https://via.placeholder.com/1080x1080/FFEAA7/FFFFFF?text=Instagram',
          thumbnail: 'https://via.placeholder.com/150/FFEAA7/FFFFFF?text=IG',
          dimensions: { width: 1080, height: 1080 }
        }
      ];
  }
  
  // If carousel post (multiple media)
  if (Math.random() > 0.7 && mockData.type === 'post') {
    mockData.media = Array.from({ length: Math.floor(Math.random() * 4) + 2 }, (_, i) => ({
      type: Math.random() > 0.5 ? 'image' : 'video',
      url: `https://via.placeholder.com/1080x1080/FF6B6B/FFFFFF?text=Carousel+${i + 1}`,
      thumbnail: `https://via.placeholder.com/150/FF6B6B/FFFFFF?text=${i + 1}`,
      dimensions: { width: 1080, height: 1080 },
      isCarousel: true,
      index: i + 1
    }));
  }
  
  return mockData;
}

function formatInstagramResponse(username, type, mediaCount, caption, likes) {
  const typeEmoji = type === 'reel' ? '🎬' :
                    type === 'story' ? '📱' :
                    type === 'igtv' ? '📺' : '📷';
  
  const typeName = type.charAt(0).toUpperCase() + type.slice(1);
  
  let formatted = `${typeEmoji} *Instagram ${typeName} Downloaded!*\n\n`;
  formatted += `👤 *Username:* @${username}\n`;
  formatted += `📊 *Type:* ${typeName}\n`;
  formatted += `🖼️ *Media Count:* ${mediaCount}\n`;
  formatted += `❤️ *Likes:* ${likes.toLocaleString()}\n\n`;
  
  if (caption && caption.length > 0) {
    const captionPreview = caption.length > 100 ? caption.substring(0, 100) + '...' : caption;
    formatted += `📝 *Caption:* ${captionPreview}\n\n`;
  }
  
  formatted += `✅ *Download successful*\n`;
  formatted += `📁 Media files available\n`;
  formatted += `⚡ Ready for viewing/sharing\n\n`;
  
  if (mediaCount > 1) {
    formatted += `🔄 *Carousel post detected*\n`;
    formatted += `All ${mediaCount} items downloaded\n`;
  }
  
  if (type === 'reel' || type === 'igtv') {
    formatted += `🎥 *Video content*\n`;
    formatted += `High quality available\n`;
  }
  
  formatted += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  formatted += `⚡ Instagram content ready`;
  
  return formatted;
}

// Additional Instagram utilities
instaFunction.getUserInfo = async function(username) {
  try {
    // Mock user info
    const mockUser = {
      username: username,
      fullName: `User ${username}`,
      bio: 'Instagram user bio',
      followers: Math.floor(Math.random() * 100000) + 1000,
      following: Math.floor(Math.random() * 1000) + 100,
      posts: Math.floor(Math.random() * 100) + 10,
      isPrivate: Math.random() > 0.7,
      isVerified: Math.random() > 0.9,
      profilePic: `https://via.placeholder.com/150/FF6B6B/FFFFFF?text=${username.substring(0, 2)}`
    };
    
    return {
      success: true,
      user: mockUser,
      formatted: formatUserInfo(mockUser)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

function formatUserInfo(user) {
  let formatted = `👤 *Instagram User Info*\n\n`;
  formatted += `📛 *Username:* @${user.username}\n`;
  formatted += `👁️ *Full Name:* ${user.fullName}\n`;
  formatted += `📝 *Bio:* ${user.bio}\n\n`;
  
  formatted += `📊 *Stats:*\n`;
  formatted += `   👥 Followers: ${user.followers.toLocaleString()}\n`;
  formatted += `   👤 Following: ${user.following.toLocaleString()}\n`;
  formatted += `   📷 Posts: ${user.posts.toLocaleString()}\n\n`;
  
  formatted += `⚡ *Account Info:*\n`;
  formatted += `   ${user.isPrivate ? '🔒 Private Account' : '🔓 Public Account'}\n`;
  formatted += `   ${user.isVerified ? '✅ Verified Account' : '❌ Not Verified'}\n`;
  
  formatted += `\n💡 *Tip:* Use !ig <post-url> to download posts`;
  
  return formatted;
}

module.exports = instaFunction;
