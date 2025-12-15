// fx/tools/shortlink.js
const axios = require('axios');
const validUrl = require('valid-url');
const { v4: uuidv4 } = require('uuid');

// URL shortener storage
const shortLinks = new Map();
const userShortLinks = new Map();

async function shortlinkFunction(request) {
  try {
    const { 
      url, 
      customSlug = null,
      userId = null,
      expiresIn = null,
      password = null
    } = request.data;
    
    if (!url) {
      return {
        success: false,
        error: {
          code: 'MISSING_URL',
          message: 'URL to shorten is required'
        }
      };
    }

    // Validate URL
    if (!validUrl.isWebUri(url)) {
      return {
        success: false,
        error: {
          code: 'INVALID_URL',
          message: 'Please provide a valid URL (include http:// or https://)'
        }
      };
    }

    // Generate or validate custom slug
    const slug = await generateSlug(customSlug, url);
    
    if (!slug) {
      return {
        success: false,
        error: {
          code: 'SLUG_UNAVAILABLE',
          message: 'Custom slug is already taken. Try a different one.'
        }
      };
    }

    // Calculate expiration
    const expiresAt = expiresIn ? calculateExpiration(expiresIn) : null;
    
    // Create short link
    const shortLink = createShortLink(url, slug, userId, expiresAt, password);
    
    // Store in memory
    shortLinks.set(slug, shortLink);
    
    // Track user's short links
    if (userId) {
      if (!userShortLinks.has(userId)) {
        userShortLinks.set(userId, []);
      }
      userShortLinks.get(userId).push(slug);
      
      // Keep only last 100 links per user
      if (userShortLinks.get(userId).length > 100) {
        const oldSlug = userShortLinks.get(userId).shift();
        shortLinks.delete(oldSlug);
      }
    }

    return {
      success: true,
      result: {
        originalUrl: url,
        shortUrl: shortLink.shortUrl,
        slug: slug,
        createdAt: shortLink.createdAt,
        expiresAt: shortLink.expiresAt,
        clicks: shortLink.clicks,
        hasPassword: !!password,
        statsUrl: shortLink.statsUrl,
        formatted: formatShortLinkResponse(shortLink)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'SHORTLINK_FAILED',
        message: error.message || 'Failed to create short link'
      }
    };
  }
}

async function generateSlug(customSlug, url) {
  if (customSlug) {
    // Validate custom slug
    if (!/^[a-zA-Z0-9_-]+$/.test(customSlug)) {
      throw new Error('Slug can only contain letters, numbers, underscores, and hyphens');
    }
    
    if (customSlug.length < 3 || customSlug.length > 30) {
      throw new Error('Slug must be between 3 and 30 characters');
    }
    
    // Check if slug is available
    if (shortLinks.has(customSlug)) {
      return null;
    }
    
    return customSlug;
  }
  
  // Generate random slug
  let slug;
  let attempts = 0;
  
  do {
    if (attempts < 3) {
      // Short random slug
      slug = Math.random().toString(36).substring(2, 8);
    } else if (attempts < 6) {
      // Medium random slug
      slug = Math.random().toString(36).substring(2, 10);
    } else {
      // Longer random slug with timestamp
      slug = Math.random().toString(36).substring(2, 7) + Date.now().toString(36).substring(4, 8);
    }
    
    attempts++;
  } while (shortLinks.has(slug) && attempts < 10);
  
  if (attempts >= 10) {
    throw new Error('Failed to generate unique slug');
  }
  
  return slug;
}

function calculateExpiration(expiresIn) {
  const now = new Date();
  
  if (typeof expiresIn === 'string') {
    const match = expiresIn.match(/^(\d+)([dhm])$/);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];
      
      switch (unit) {
        case 'd':
          now.setDate(now.getDate() + value);
          break;
        case 'h':
          now.setHours(now.getHours() + value);
          break;
        case 'm':
          now.setMinutes(now.getMinutes() + value);
          break;
      }
      return now.toISOString();
    }
  }
  
  // Default: 30 days
  now.setDate(now.getDate() + 30);
  return now.toISOString();
}

function createShortLink(originalUrl, slug, userId, expiresAt, password) {
  const baseUrl = process.env.SHORTLINK_BASE_URL || 'https://short.example.com';
  const shortUrl = `${baseUrl}/${slug}`;
  const statsUrl = `${baseUrl}/stats/${slug}`;
  
  const shortLink = {
    id: uuidv4(),
    originalUrl: originalUrl,
    shortUrl: shortUrl,
    slug: slug,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt,
    userId: userId,
    hasPassword: !!password,
    passwordHash: password ? Buffer.from(password).toString('base64') : null,
    clicks: 0,
    clickHistory: [],
    lastClicked: null,
    metadata: {
      userAgent: request?.headers?.['user-agent'],
      ip: request?.ip
    }
  };
  
  return shortLink;
}

function formatShortLinkResponse(shortLink) {
  const expiresInfo = shortLink.expiresAt 
    ? new Date(shortLink.expiresAt).toLocaleDateString()
    : 'Never';
  
  let formatted = `🔗 *Short Link Created!*\n\n`;
  formatted += `📝 *Original URL:*\n${shortLink.originalUrl.substring(0, 80)}...\n\n`;
  formatted += `✨ *Short URL:*\n${shortLink.shortUrl}\n\n`;
  
  formatted += `📊 *Stats URL:* ${shortLink.statsUrl}\n`;
  formatted += `📅 *Created:* ${new Date(shortLink.createdAt).toLocaleDateString()}\n`;
  formatted += `⏰ *Expires:* ${expiresInfo}\n`;
  formatted += `👆 *Clicks:* ${shortLink.clicks}\n\n`;
  
  if (shortLink.hasPassword) {
    formatted += `🔒 *Password Protected*\n`;
    formatted += `Requires password to access\n\n`;
  }
  
  formatted += `✅ *Features:*\n`;
  formatted += `• Click tracking\n`;
  formatted += `• Custom slugs\n`;
  formatted += `• Expiration dates\n`;
  formatted += `• Password protection\n`;
  formatted += `• Usage statistics\n\n`;
  
  formatted += `🎮 *Create another:* !short <url> custom:<slug> expires:<time>`;
  
  return formatted;
}

// URL resolution function
shortlinkFunction.resolve = function(slug, password = null) {
  const shortLink = shortLinks.get(slug);
  
  if (!shortLink) {
    return {
      success: false,
      error: 'Short link not found'
    };
  }
  
  // Check expiration
  if (shortLink.expiresAt && new Date(shortLink.expiresAt) < new Date()) {
    // Clean up expired link
    shortLinks.delete(slug);
    return {
      success: false,
      error: 'Short link has expired'
    };
  }
  
  // Check password
  if (shortLink.hasPassword) {
    const providedHash = password ? Buffer.from(password).toString('base64') : null;
    if (providedHash !== shortLink.passwordHash) {
      return {
        success: false,
        error: 'Password required or incorrect'
      };
    }
  }
  
  // Update click stats
  shortLink.clicks++;
  shortLink.lastClicked = new Date().toISOString();
  shortLink.clickHistory.push({
    timestamp: new Date().toISOString(),
    userAgent: request?.headers?.['user-agent'],
    ip: request?.ip
  });
  
  // Keep only last 1000 click records
  if (shortLink.clickHistory.length > 1000) {
    shortLink.clickHistory = shortLink.clickHistory.slice(-1000);
  }
  
  return {
    success: true,
    url: shortLink.originalUrl,
    clicks: shortLink.clicks
  };
};

// Statistics function
shortlinkFunction.getStats = function(slug, userId = null) {
  // If slug provided, get stats for that link
  if (slug) {
    const shortLink = shortLinks.get(slug);
    
    if (!shortLink) {
      return {
        success: false,
        error: 'Short link not found'
      };
    }
    
    // Check if user owns this link
    if (userId && shortLink.userId !== userId) {
      return {
        success: false,
        error: 'You do not have permission to view these stats'
      };
    }
    
    return {
      success: true,
      stats: {
        shortLink: shortLink,
        clickHistory: shortLink.clickHistory.slice(-100),
        uniqueClicks: new Set(shortLink.clickHistory.map(c => c.ip)).size,
        last7Days: shortLink.clickHistory.filter(c => 
          new Date(c.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ).length
      },
      formatted: formatLinkStats(shortLink)
    };
  }
  
  // If userId provided, get all user's links
  if (userId) {
    const userLinks = userShortLinks.get(userId) || [];
    const links = userLinks.map(slug => shortLinks.get(slug)).filter(Boolean);
    
    const totalClicks = links.reduce((sum, link) => sum + link.clicks, 0);
    const activeLinks = links.filter(link => 
      !link.expiresAt || new Date(link.expiresAt) > new Date()
    ).length;
    
    return {
      success: true,
      stats: {
        totalLinks: links.length,
        activeLinks: activeLinks,
        totalClicks: totalClicks,
        averageClicks: links.length > 0 ? (totalClicks / links.length).toFixed(1) : 0,
        links: links.map(link => ({
          slug: link.slug,
          url: link.shortUrl,
          clicks: link.clicks,
          created: link.createdAt
        }))
      },
      formatted: formatUserStats(links, totalClicks, activeLinks)
    };
  }
  
  return {
    success: false,
    error: 'Slug or userId required'
  };
};

function formatLinkStats(shortLink) {
  const last7Days = shortLink.clickHistory.filter(c => 
    new Date(c.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  ).length;
  
  const uniqueClicks = new Set(shortLink.clickHistory.map(c => c.ip)).size;
  
  let formatted = `📊 *Short Link Statistics*\n\n`;
  formatted += `🔗 *URL:* ${shortLink.shortUrl}\n`;
  formatted += `🎯 *Destination:* ${shortLink.originalUrl.substring(0, 60)}...\n\n`;
  
  formatted += `📈 *Click Statistics:*\n`;
  formatted += `   👆 Total Clicks: ${shortLink.clicks}\n`;
  formatted += `   👥 Unique Visitors: ${uniqueClicks}\n`;
  formatted += `   📅 Last 7 Days: ${last7Days}\n`;
  formatted += `   🕒 Last Click: ${shortLink.lastClicked ? new Date(shortLink.lastClicked).toLocaleString() : 'Never'}\n\n`;
  
  if (shortLink.clickHistory.length > 0) {
    formatted += `📅 *Recent Clicks (last 10):*\n`;
    
    shortLink.clickHistory.slice(-10).reverse().forEach((click, index) => {
      const time = new Date(click.timestamp).toLocaleTimeString();
      formatted += `   ${index + 1}. ${time} - ${click.ip || 'Unknown'}\n`;
    });
  }
  
  return formatted;
}

function formatUserStats(links, totalClicks, activeLinks) {
  let formatted = `📊 *Your Short Links*\n\n`;
  formatted += `📁 *Total Links:* ${links.length}\n`;
  formatted += `✅ *Active Links:* ${activeLinks}\n`;
  formatted += `👆 *Total Clicks:* ${totalClicks}\n`;
  formatted += `📈 *Average per Link:* ${links.length > 0 ? (totalClicks / links.length).toFixed(1) : 0}\n\n`;
  
  if (links.length > 0) {
    formatted += `🏆 *Top 5 Links:*\n`;
    
    links
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5)
      .forEach((link, index) => {
        const medal = index === 0 ? '🥇' :
                      index === 1 ? '🥈' :
                      index === 2 ? '🥉' : `${index + 1}.`;
        
        formatted += `${medal} ${link.slug}: ${link.clicks} clicks\n`;
        formatted += `   ${link.shortUrl}\n\n`;
      });
  }
  
  formatted += `🎮 *Create new:* !short <url> custom:<slug> expires:<time>`;
  
  return formatted;
}

module.exports = shortlinkFunction;
