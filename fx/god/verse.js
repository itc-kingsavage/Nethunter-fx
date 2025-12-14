// fx/god/verse.js
const axios = require('axios');

async function verseFunction(request) {
  try {
    const { reference, version = 'KJV' } = request.data;
    
    if (!reference) {
      return {
        success: false,
        error: {
          code: 'MISSING_REFERENCE',
          message: 'Please provide a Bible reference (e.g., John 3:16)'
        }
      };
    }

    // Parse reference (simple version - can be enhanced)
    const parsedRef = parseBibleReference(reference);
    if (!parsedRef) {
      return {
        success: false,
        error: {
          code: 'INVALID_REFERENCE',
          message: 'Invalid Bible reference format. Use format like: John 3:16'
        }
      };
    }

    // Fetch verse from API
    const verse = await fetchVerse(parsedRef, version);
    
    return {
      success: true,
      result: {
        reference: verse.reference,
        text: verse.text,
        version: verse.version,
        book: verse.book_name,
        chapter: verse.chapter,
        verse: verse.verse,
        formatted: formatVerse(verse)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'VERSE_FETCH_FAILED',
        message: error.message || 'Failed to fetch verse'
      }
    };
  }
}

// Helper functions
function parseBibleReference(ref) {
  // Simple parser for formats like: John 3:16, Genesis 1:1-3, Psalm 23
  const match = ref.match(/(\d?\s?\w+)\s+(\d+)(?::(\d+))?(?:-(\d+))?/i);
  if (!match) return null;
  
  return {
    book: match[1].trim(),
    chapter: parseInt(match[2]),
    verse: match[3] ? parseInt(match[3]) : 1,
    endVerse: match[4] ? parseInt(match[4]) : null
  };
}

async function fetchVerse(parsedRef, version) {
  // Using Bible API (example using bible-api.com)
  const url = `https://bible-api.com/${parsedRef.book}+${parsedRef.chapter}:${parsedRef.verse}${parsedRef.endVerse ? `-${parsedRef.endVerse}` : ''}?translation=${version.toLowerCase()}`;
  
  const response = await axios.get(url, {
    timeout: 10000
  });
  
  return {
    reference: response.data.reference,
    text: response.data.text,
    version: response.data.translation_name,
    book_name: response.data.book_name,
    chapter: parsedRef.chapter,
    verse: parsedRef.verse,
    verses: response.data.verses
  };
}

function formatVerse(verseData) {
  let formatted = `📖 *${verseData.reference} (${verseData.version})*\n\n`;
  
  if (verseData.verses && Array.isArray(verseData.verses)) {
    verseData.verses.forEach(v => {
      formatted += `*${v.verse}.* ${v.text}\n`;
    });
  } else {
    formatted += verseData.text;
  }
  
  formatted += `\n_${verseData.book_name} ${verseData.chapter}:${verseData.verse}_`;
  
  return formatted;
}

module.exports = verseFunction;
