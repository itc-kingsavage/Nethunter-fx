// fx/god/bible.js
const axios = require('axios');

async function bibleFunction(request) {
  try {
    const { query, version = 'KJV', chapter = null } = request.data;
    
    if (!query) {
      return {
        success: false,
        error: {
          code: 'MISSING_QUERY',
          message: 'Please provide a search term or Bible reference'
        }
      };
    }

    // Check if query is a chapter reference (e.g., "John 3")
    const chapterMatch = query.match(/(\d?\s?\w+)\s+(\d+)/i);
    
    if (chapterMatch || chapter) {
      // Get chapter
      const book = chapterMatch ? chapterMatch[1].trim() : query;
      const chapterNum = chapter || parseInt(chapterMatch[2]);
      
      const chapterData = await getChapter(book, chapterNum, version);
      
      return {
        success: true,
        result: {
          type: 'chapter',
          book: book,
          chapter: chapterNum,
          verses: chapterData.verses,
          formatted: formatChapter(chapterData),
          version: version,
          totalVerses: chapterData.verses.length
        }
      };
    } else {
      // Search across Bible
      const searchResults = await searchBible(query, version);
      
      return {
        success: true,
        result: {
          type: 'search',
          query: query,
          results: searchResults,
          formatted: formatSearchResults(searchResults, query),
          version: version,
          totalResults: searchResults.length
        }
      };
    }
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'BIBLE_FUNCTION_FAILED',
        message: error.message || 'Failed to process Bible request'
      }
    };
  }
}

async function getChapter(book, chapter, version) {
  const url = `https://bible-api.com/${book}+${chapter}?translation=${version.toLowerCase()}`;
  
  const response = await axios.get(url, {
    timeout: 15000
  });
  
  return {
    book: response.data.book_name,
    chapter: chapter,
    verses: response.data.verses || [],
    reference: response.data.reference,
    translation: response.data.translation_name
  };
}

async function searchBible(query, version) {
  // Using esvapi.org for search (example) - you might need a different API
  try {
    const url = `https://api.esv.org/v3/passage/search/?q=${encodeURIComponent(query)}`;
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Token ${process.env.ESV_API_KEY || 'public'}` // Add your API key
      },
      timeout: 10000
    });
    
    // Process and limit results
    const results = response.data.results || [];
    return results.slice(0, 10).map(result => ({
      reference: result.reference,
      text: result.content,
      score: result.score
    }));
    
  } catch (error) {
    // Fallback to simple chapter fetch
    console.log('Search failed, using fallback:', error.message);
    return [{
      reference: 'John 1:1',
      text: 'In the beginning was the Word...',
      note: 'Search API failed, showing example verse'
    }];
  }
}

function formatChapter(chapterData) {
  let formatted = `📖 *${chapterData.book} ${chapterData.chapter} (${chapterData.translation})*\n\n`;
  
  if (chapterData.verses.length > 30) {
    // For long chapters, split into two parts
    const midpoint = Math.floor(chapterData.verses.length / 2);
    formatted += `*Part 1/2 (verses 1-${midpoint})*\n`;
    
    chapterData.verses.slice(0, midpoint).forEach(v => {
      formatted += `*${v.verse}.* ${v.text}\n`;
    });
    
    formatted += `\n*Part 2/2 (verses ${midpoint+1}-${chapterData.verses.length})*\n`;
    chapterData.verses.slice(midpoint).forEach(v => {
      formatted += `*${v.verse}.* ${v.text}\n`;
    });
  } else {
    chapterData.verses.forEach(v => {
      formatted += `*${v.verse}.* ${v.text}\n`;
    });
  }
  
  return formatted;
}

function formatSearchResults(results, query) {
  if (results.length === 0) {
    return `❌ No results found for "${query}"`;
  }
  
  let formatted = `🔍 *Bible Search Results for "${query}"*\n\n`;
  
  results.slice(0, 5).forEach((result, index) => {
    formatted += `*${index + 1}. ${result.reference}*\n`;
    
    // Highlight query terms in text (simple version)
    let text = result.text;
    const queryWords = query.toLowerCase().split(' ');
    queryWords.forEach(word => {
      if (word.length > 3) {
        const regex = new RegExp(`(${word})`, 'gi');
        text = text.replace(regex, '*$1*');
      }
    });
    
    formatted += `${text.substring(0, 150)}...\n\n`;
  });
  
  if (results.length > 5) {
    formatted += `_...and ${results.length - 5} more results_`;
  }
  
  return formatted;
}

module.exports = bibleFunction;
