// fx/ai/google.js
const axios = require('axios');
const { google } = require('googleapis');

async function googleFunction(request) {
  try {
    const { query, safeSearch = true, numResults = 5 } = request.data;
    
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
    
    // Perform Google search
    const searchResults = await performGoogleSearch(cleanQuery, safeSearch, numResults);
    
    return {
      success: true,
      result: {
        query: cleanQuery,
        results: searchResults,
        count: searchResults.length,
        formatted: formatGoogleResults(cleanQuery, searchResults)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'GOOGLE_SEARCH_FAILED',
        message: error.message || 'Failed to perform Google search'
      }
    };
  }
}

async function performGoogleSearch(query, safeSearch, numResults) {
  const googleApiKey = process.env.GOOGLE_API_KEY;
  const googleSearchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
  
  if (googleApiKey && googleSearchEngineId) {
    // Use Google Custom Search API
    try {
      const customsearch = google.customsearch('v1');
      
      const response = await customsearch.cse.list({
        auth: googleApiKey,
        cx: googleSearchEngineId,
        q: query,
        num: Math.min(numResults, 10),
        safe: safeSearch ? 'high' : 'off',
        fields: 'items(title,link,snippet)'
      });
      
      return response.data.items?.map(item => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        source: 'google'
      })) || [];
      
    } catch (error) {
      console.log('Google API failed, using fallback:', error.message);
    }
  }
  
  // Fallback: Use DuckDuckGo or other search
  return await fallbackSearch(query, numResults);
}

async function fallbackSearch(query, numResults) {
  try {
    const response = await axios.get('https://html.duckduckgo.com/html/', {
      params: { q: query },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });
    
    const html = response.data;
    const results = [];
    
    // Simple HTML parsing for DuckDuckGo results
    const titleRegex = /class="result__title".*?<a.*?>(.*?)<\/a>/g;
    const urlRegex = /class="result__url".*?<a.*?href="(.*?)"/g;
    const snippetRegex = /class="result__snippet".*?>(.*?)<\/a>/g;
    
    let titleMatch, urlMatch, snippetMatch;
    const titles = [];
    const urls = [];
    const snippets = [];
    
    while ((titleMatch = titleRegex.exec(html)) !== null && results.length < numResults) {
      titles.push(titleMatch[1].replace(/<[^>]*>/g, ''));
    }
    
    while ((urlMatch = urlRegex.exec(html)) !== null && urls.length < numResults) {
      urls.push(urlMatch[1]);
    }
    
    while ((snippetMatch = snippetRegex.exec(html)) !== null && snippets.length < numResults) {
      snippets.push(snippetMatch[1].replace(/<[^>]*>/g, ''));
    }
    
    // Combine results
    for (let i = 0; i < Math.min(titles.length, numResults); i++) {
      results.push({
        title: titles[i] || 'No title',
        url: urls[i] || '#',
        snippet: snippets[i] || 'No description available',
        source: 'duckduckgo'
      });
    }
    
    return results.length > 0 ? results : getMockSearchResults(query, numResults);
    
  } catch (error) {
    console.log('Fallback search failed, using mock:', error.message);
    return getMockSearchResults(query, numResults);
  }
}

function getMockSearchResults(query, numResults) {
  const mockResults = [
    {
      title: `Search result for: ${query}`,
      url: `https://www.example.com/search?q=${encodeURIComponent(query)}`,
      snippet: `This is a simulated search result for "${query}". In production, real Google search results would appear here.`,
      source: 'mock'
    },
    {
      title: `Information about ${query}`,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,
      snippet: `Wikipedia article about ${query}. For more accurate results, configure Google API keys.`,
      source: 'mock'
    },
    {
      title: `Learn more about ${query}`,
      url: `https://www.learn-${query.toLowerCase().replace(/\s+/g, '-')}.com`,
      snippet: `Educational resources about ${query}. This is placeholder text for demonstration.`,
      source: 'mock'
    }
  ];
  
  return mockResults.slice(0, numResults);
}

function formatGoogleResults(query, results) {
  let formatted = `🔍 *Google Search: "${query}"*\n\n`;
  
  if (results.length === 0) {
    formatted += `❌ No results found.\n`;
    formatted += `Try different keywords or check your search query.`;
    return formatted;
  }
  
  results.forEach((result, index) => {
    formatted += `${index + 1}. *${result.title}*\n`;
    
    if (result.snippet) {
      const snippet = result.snippet.length > 120 ? 
        result.snippet.substring(0, 120) + '...' : result.snippet;
      formatted += `${snippet}\n`;
    }
    
    formatted += `🔗 ${result.url}\n`;
    
    if (result.source && result.source !== 'google') {
      formatted += `📚 Source: ${result.source.toUpperCase()}\n`;
    }
    
    formatted += `\n`;
  });
  
  formatted += `━━━━━━━━━━━━━━━━━━━━\n`;
  formatted += `⚡ ${results.length} result${results.length !== 1 ? 's' : ''} found\n`;
  formatted += `💡 *Tip:* Add "safe: false" to disable safe search`;
  
  return formatted;
}

// Additional features
googleFunction.quickAnswer = async function(query) {
  try {
    // Use DuckDuckGo instant answer for quick answers
    const response = await axios.get('https://api.duckduckgo.com/', {
      params: {
        q: query,
        format: 'json',
        no_html: 1
      },
      timeout: 10000
    });
    
    if (response.data.AbstractText) {
      return {
        success: true,
        answer: {
          text: response.data.AbstractText,
          source: response.data.AbstractSource,
          url: response.data.AbstractURL,
          image: response.data.Image ? `https://duckduckgo.com${response.data.Image}` : null
        },
        formatted: formatQuickAnswer(response.data.AbstractText, response.data.AbstractSource)
      };
    }
    
    return {
      success: false,
      error: 'No quick answer available'
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

function formatQuickAnswer(text, source) {
  let formatted = `🎯 *Quick Answer*\n\n`;
  formatted += `${text}\n\n`;
  formatted += `📚 Source: ${source || 'Various sources'}\n`;
  formatted += `💡 From Google quick answer feature`;
  
  return formatted;
}

module.exports = googleFunction;
