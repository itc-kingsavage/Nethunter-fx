// fx/ai/meta.js
const axios = require('axios');

async function metaFunction(request) {
  try {
    const { query, detailed = false } = request.data;
    
    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: {
          code: 'MISSING_QUERY',
          message: 'Query is required'
        }
      };
    }

    const cleanQuery = query.trim();
    
    // Meta AI search (simulated - in production use actual Meta AI API)
    const results = await searchMetaAI(cleanQuery, detailed);
    
    return {
      success: true,
      result: {
        query: cleanQuery,
        results: results,
        count: results.length,
        formatted: formatMetaResults(cleanQuery, results, detailed)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'META_FAILED',
        message: error.message || 'Failed to search with Meta AI'
      }
    };
  }
}

async function searchMetaAI(query, detailed) {
  // This is a simulation - Meta AI API access may require special permissions
  // For now, we'll use web search as a fallback
  
  try {
    // Try to use DuckDuckGo instant answer API as a proxy
    const ddgResponse = await axios.get('https://api.duckduckgo.com/', {
      params: {
        q: query,
        format: 'json',
        no_html: 1,
        skip_disambig: 1
      },
      timeout: 10000
    });
    
    const data = ddgResponse.data;
    
    if (data.AbstractText) {
      // Found direct answer
      return [{
        type: 'answer',
        title: data.Heading || query,
        content: data.AbstractText,
        source: data.AbstractSource,
        url: data.AbstractURL,
        image: data.Image ? `https://duckduckgo.com${data.Image}` : null
      }];
    } else if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      // Return related topics
      return data.RelatedTopics
        .filter(topic => topic.Text)
        .slice(0, detailed ? 10 : 5)
        .map(topic => ({
          type: 'related',
          title: topic.FirstURL ? topic.FirstURL.split('/').pop().replace(/_/g, ' ') : 'Related',
          content: topic.Text,
          url: topic.FirstURL
        }));
    } else {
      // Fallback to mock data
      return getMockMetaResults(query);
    }
    
  } catch (error) {
    console.log('Meta AI search failed, using mock data:', error.message);
    return getMockMetaResults(query);
  }
}

function getMockMetaResults(query) {
  const mockResponses = [
    {
      type: 'answer',
      title: `About ${query}`,
      content: `Meta AI provides information about ${query}. In a real implementation, this would fetch from Meta's AI models.`,
      source: 'Meta AI Simulated',
      url: `https://www.wikipedia.org/wiki/${encodeURIComponent(query)}`,
      confidence: 0.85
    },
    {
      type: 'related',
      title: 'Related Information',
      content: `For more accurate results, ensure you have proper API access to Meta's AI services.`,
      url: 'https://developers.facebook.com/products/ai'
    },
    {
      type: 'tip',
      title: 'AI Assistant Note',
      content: `This is a simulated Meta AI response. Actual Meta AI integration requires API access from Meta.`,
      source: 'System'
    }
  ];
  
  return mockResponses;
}

function formatMetaResults(query, results, detailed) {
  let formatted = `🔍 *Meta AI Search: "${query}"*\n\n`;
  
  if (results.length === 0) {
    formatted += `❌ No results found.\n`;
    formatted += `Try rephrasing your query or use !google for web search.`;
    return formatted;
  }
  
  results.forEach((result, index) => {
    const emoji = result.type === 'answer' ? '🎯' : 
                  result.type === 'related' ? '🔗' : '💡';
    
    formatted += `${emoji} *${result.title}*\n`;
    
    if (result.content) {
      const maxLength = detailed ? 300 : 150;
      const content = result.content.length > maxLength ? 
        result.content.substring(0, maxLength) + '...' : result.content;
      formatted += `${content}\n`;
    }
    
    if (result.source) {
      formatted += `📚 Source: ${result.source}\n`;
    }
    
    if (result.url) {
      formatted += `🔗 ${result.url}\n`;
    }
    
    if (result.confidence && detailed) {
      formatted += `📊 Confidence: ${(result.confidence * 100).toFixed(1)}%\n`;
    }
    
    formatted += `\n`;
  });
  
  if (!detailed && results.length > 3) {
    formatted += `📋 *${results.length - 3} more results available*\n`;
    formatted += `Add "detailed: true" to see all results.`;
  }
  
  formatted += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  formatted += `⚡ Powered by Meta AI simulation`;
  
  return formatted;
}

// Additional features
metaFunction.trending = async function() {
  try {
    // Simulated trending topics
    const trending = [
      { query: 'AI advancements 2024', volume: 'high' },
      { query: 'Machine learning trends', volume: 'medium' },
      { query: 'Meta AI updates', volume: 'high' },
      { query: 'LLM comparisons', volume: 'medium' },
      { query: 'Chatbot development', volume: 'low' }
    ];
    
    return {
      success: true,
      trending: trending,
      formatted: formatTrendingTopics(trending)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

function formatTrendingTopics(topics) {
  let formatted = `📈 *Meta AI Trending Topics*\n\n`;
  
  topics.forEach((topic, index) => {
    const trendEmoji = topic.volume === 'high' ? '🔥' : 
                       topic.volume === 'medium' ? '📈' : '📊';
    
    formatted += `${index + 1}. ${trendEmoji} ${topic.query}\n`;
  });
  
  formatted += `\n💡 *Tip:* Search any topic with !meta <query>`;
  
  return formatted;
}

module.exports = metaFunction;
