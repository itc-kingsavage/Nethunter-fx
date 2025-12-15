// fx/ai/search.js
const axios = require('axios');

async function searchFunction(request) {
  try {
    const { query, engine = 'all', limit = 5 } = request.data;
    
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
    
    // Perform aggregated search
    const searchResults = await performAggregatedSearch(cleanQuery, engine, limit);
    
    return {
      success: true,
      result: {
        query: cleanQuery,
        engine: engine,
        results: searchResults,
        count: searchResults.length,
        formatted: formatSearchResults(cleanQuery, searchResults, engine)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'SEARCH_FAILED',
        message: error.message || 'Failed to perform search'
      }
    };
  }
}

async function performAggregatedSearch(query, engine, limit) {
  const engines = engine === 'all' ? ['web', 'images', 'videos', 'news'] : [engine];
  const allResults = [];
  
  for (const searchEngine of engines) {
    try {
      const results = await searchWithEngine(query, searchEngine, Math.ceil(limit / engines.length));
      allResults.push(...results.map(result => ({ ...result, engine: searchEngine })));
    } catch (error) {
      console.log(`Search engine ${searchEngine} failed:`, error.message);
    }
  }
  
  // Shuffle and limit results
  const shuffled = allResults.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
}

async function searchWithEngine(query, engine, limit) {
  switch (engine) {
    case 'web':
      return await searchWeb(query, limit);
    case 'images':
      return await searchImages(query, limit);
    case 'videos':
      return await searchVideos(query, limit);
    case 'news':
      return await searchNews(query, limit);
    default:
      return await searchWeb(query, limit);
  }
}

async function searchWeb(query, limit) {
  try {
    // Use DuckDuckGo HTML as fallback
    const response = await axios.get('https://html.duckduckgo.com/html/', {
      params: { q: query },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });
    
    const results = [];
    const html = response.data;
    
    // Extract web results (simplified parsing)
    const regex = /class="result__title".*?<a.*?href="([^"]+)".*?>(.*?)<\/a>.*?class="result__snippet".*?>(.*?)<\/a>/gs;
    let match;
    
    while ((match = regex.exec(html)) !== null && results.length < limit) {
      results.push({
        type: 'web',
        title: match[2].replace(/<[^>]*>/g, '').trim(),
        url: match[1],
        description: match[3].replace(/<[^>]*>/g, '').trim(),
        source: 'duckduckgo'
      });
    }
    
    return results.length > 0 ? results : getMockWebResults(query, limit);
    
  } catch (error) {
    console.log('Web search failed:', error.message);
    return getMockWebResults(query, limit);
  }
}

async function searchImages(query, limit) {
  try {
    // Use Unsplash API for images if available
    const unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY;
    
    if (unsplashAccessKey) {
      const response = await axios.get('https://api.unsplash.com/search/photos', {
        params: {
          query: query,
          per_page: limit,
          client_id: unsplashAccessKey
        },
        timeout: 10000
      });
      
      return response.data.results.map(photo => ({
        type: 'image',
        title: photo.alt_description || query,
        url: photo.urls.regular,
        thumbnail: photo.urls.thumb,
        source: 'unsplash',
        width: photo.width,
        height: photo.height,
        photographer: photo.user.name,
        photographer_url: photo.user.links.html
      }));
    }
    
    // Fallback to mock images
    return getMockImageResults(query, limit);
    
  } catch (error) {
    console.log('Image search failed:', error.message);
    return getMockImageResults(query, limit);
  }
}

async function searchVideos(query, limit) {
  try {
    // Use YouTube API if available
    const youtubeApiKey = process.env.YOUTUBE_API_KEY;
    
    if (youtubeApiKey) {
      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          q: query,
          maxResults: limit,
          type: 'video',
          key: youtubeApiKey
        },
        timeout: 10000
      });
      
      return response.data.items.map(item => ({
        type: 'video',
        title: item.snippet.title,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        thumbnail: item.snippet.thumbnails.medium?.url,
        channel: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        source: 'youtube'
      }));
    }
    
    // Fallback to mock videos
    return getMockVideoResults(query, limit);
    
  } catch (error) {
    console.log('Video search failed:', error.message);
    return getMockVideoResults(query, limit);
  }
}

async function searchNews(query, limit) {
  try {
    // Use NewsAPI if available
    const newsApiKey = process.env.NEWS_API_KEY;
    
    if (newsApiKey) {
      const response = await axios.get('https://newsapi.org/v2/everything', {
        params: {
          q: query,
          pageSize: limit,
          apiKey: newsApiKey,
          language: 'en',
          sortBy: 'relevancy'
        },
        timeout: 10000
      });
      
      return response.data.articles.map(article => ({
        type: 'news',
        title: article.title,
        url: article.url,
        description: article.description,
        source: article.source.name,
        publishedAt: article.publishedAt,
        author: article.author,
        image: article.urlToImage
      }));
    }
    
    // Fallback to mock news
    return getMockNewsResults(query, limit);
    
  } catch (error) {
    console.log('News search failed:', error.message);
    return getMockNewsResults(query, limit);
  }
}

function getMockWebResults(query, limit) {
  return Array.from({ length: limit }, (_, i) => ({
    type: 'web',
    title: `${query} - Result ${i + 1}`,
    url: `https://example.com/${encodeURIComponent(query)}-${i + 1}`,
    description: `This is a mock search result for "${query}". Configure search APIs for real results.`,
    source: 'mock'
  }));
}

function getMockImageResults(query, limit) {
  return Array.from({ length: limit }, (_, i) => ({
    type: 'image',
    title: `${query} Image ${i + 1}`,
    url: `https://via.placeholder.com/800x600/4A90E2/FFFFFF?text=${encodeURIComponent(query.substring(0, 15))}+${i + 1}`,
    thumbnail: `https://via.placeholder.com/150/4A90E2/FFFFFF?text=${encodeURIComponent(query.substring(0, 5))}`,
    source: 'mock',
    width: 800,
    height: 600
  }));
}

function getMockVideoResults(query, limit) {
  return Array.from({ length: limit }, (_, i) => ({
    type: 'video',
    title: `${query} - Video Tutorial ${i + 1}`,
    url: `https://www.youtube.com/watch?v=mock${i + 1}`,
    thumbnail: `https://via.placeholder.com/320x180/FF0000/FFFFFF?text=Video+${i + 1}`,
    channel: `Tutorial Channel ${i + 1}`,
    publishedAt: new Date().toISOString(),
    source: 'mock'
  }));
}

function getMockNewsResults(query, limit) {
  return Array.from({ length: limit }, (_, i) => ({
    type: 'news',
    title: `News about ${query} - ${i + 1}`,
    url: `https://news.example.com/${encodeURIComponent(query)}-${i + 1}`,
    description: `Latest news and updates about ${query}. This is mock data.`,
    source: 'Mock News Network',
    publishedAt: new Date().toISOString(),
    author: 'AI Reporter'
  }));
}

function formatSearchResults(query, results, engine) {
  const engineDisplay = engine === 'all' ? 'Aggregated' : engine.toUpperCase();
  
  let formatted = `🔍 *${engineDisplay} Search: "${query}"*\n\n`;
  formatted += `Found ${results.length} result${results.length !== 1 ? 's' : ''}\n\n`;
  
  // Group by type
  const byType = {};
  results.forEach(result => {
    if (!byType[result.type]) byType[result.type] = [];
    byType[result.type].push(result);
  });
  
  for (const [type, typeResults] of Object.entries(byType)) {
    const typeEmoji = type === 'web' ? '🌐' :
                      type === 'image' ? '🖼️' :
                      type === 'video' ? '🎬' :
                      type === 'news' ? '📰' : '🔗';
    
    formatted += `${typeEmoji} *${type.toUpperCase()} Results*\n`;
    
    typeResults.slice(0, 3).forEach((result, index) => {
      formatted += `${index + 1}. ${result.title}\n`;
      
      if (result.description) {
        const desc = result.description.length > 80 ? 
          result.description.substring(0, 80) + '...' : result.description;
        formatted += `   ${desc}\n`;
      }
      
      if (result.url) {
        formatted += `   🔗 ${result.url.substring(0, 40)}...\n`;
      }
      
      formatted += `\n`;
    });
    
    if (typeResults.length > 3) {
      formatted += `📋 ${typeResults.length - 3} more ${type} results\n\n`;
    }
  }
  
  formatted += `━━━━━━━━━━━━━━━━━━━━\n`;
  formatted += `⚡ Search engines used: ${engine}\n`;
  formatted += `💡 *Tip:* Use "engine: web/images/videos/news" to filter`;
  
  return formatted;
}

// Additional features
searchFunction.engines = function() {
  return {
    success: true,
    engines: [
      { id: 'all', name: 'All Engines', description: 'Search across all sources' },
      { id: 'web', name: 'Web Search', description: 'General web pages' },
      { id: 'images', name: 'Image Search', description: 'Search for images' },
      { id: 'videos', name: 'Video Search', description: 'Search for videos' },
      { id: 'news', name: 'News Search', description: 'Latest news articles' }
    ]
  };
};

module.exports = searchFunction;
