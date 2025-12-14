// fx/god/devotional.js
const axios = require('axios');
const NodeCache = require('node-cache'); // You'll need to install: npm install node-cache

// Cache devotional for 24 hours
const devotionalCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

async function devotionalFunction(request) {
  try {
    const { date = null, language = 'english' } = request.data;
    
    // Use today's date if not specified
    const targetDate = date ? new Date(date) : new Date();
    
    // Check cache first
    const cacheKey = `${targetDate.toISOString().split('T')[0]}_${language}`;
    const cached = devotionalCache.get(cacheKey);
    
    if (cached) {
      return {
        success: true,
        result: {
          ...cached,
          cached: true,
          formatted: formatDevotional(cached)
        }
      };
    }
    
    // Fetch fresh devotional
    const devotional = await fetchDevotional(targetDate, language);
    
    // Cache it
    devotionalCache.set(cacheKey, devotional);
    
    return {
      success: true,
      result: {
        ...devotional,
        cached: false,
        formatted: formatDevotional(devotional)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'DEVOTIONAL_FETCH_FAILED',
        message: error.message || 'Failed to fetch devotional'
      }
    };
  }
}

async function fetchDevotional(date, language) {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  
  try {
    // Using Our Daily Bread API (example - you might need actual API key)
    const response = await axios.get(`https://api.ourdailybread.org/v1/devotionals/${dateStr}`, {
      params: {
        language: language,
        include: 'scripture,prayer,reflection'
      },
      headers: {
        'Authorization': `Bearer ${process.env.ODB_API_KEY || 'public'}`,
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    
    return {
      date: dateStr,
      title: response.data.title || 'Daily Devotional',
      scripture: response.data.scripture || 'John 3:16',
      verseText: response.data.verse_text || 'For God so loved the world...',
      content: response.data.content || 'God\'s love is everlasting...',
      prayer: response.data.prayer || 'Lord, help us to understand Your love...',
      reflection: response.data.reflection || 'Today, remember that God loves you...',
      author: response.data.author || 'Our Daily Bread',
      language: language,
      source: 'Our Daily Bread'
    };
    
  } catch (apiError) {
    console.log('Primary API failed, using fallback:', apiError.message);
    
    // Fallback to public APIs or static devotionals
    return getFallbackDevotional(date, language);
  }
}

function getFallbackDevotional(date, language) {
  // Fallback to a simple static devotional
  const devotionals = {
    english: [
      {
        title: "God's Unfailing Love",
        scripture: "Lamentations 3:22-23",
        verseText: "The steadfast love of the Lord never ceases; his mercies never come to an end; they are new every morning; great is your faithfulness.",
        content: "Each new day is an opportunity to experience God's fresh mercies. No matter what yesterday held, today brings new grace.",
        prayer: "Lord, thank you for new mercies every morning. Help me to trust in your unfailing love today.",
        reflection: "How can you recognize God's new mercies in your life today?",
        author: "Daily Faith"
      },
      {
        title: "Peace in Christ",
        scripture: "Philippians 4:6-7",
        verseText: "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.",
        content: "When anxiety threatens to overwhelm you, remember that prayer is your direct line to the Prince of Peace.",
        prayer: "Heavenly Father, I bring my worries to you. Grant me your peace that passes understanding.",
        reflection: "What anxieties can you surrender to God today?",
        author: "Daily Faith"
      }
    ],
    spanish: [
      {
        title: "El Amor Infalible de Dios",
        scripture: "Lamentaciones 3:22-23",
        verseText: "Nunca decayeron sus misericordias. Nuevas son cada mañana; grande es tu fidelidad.",
        content: "Cada nuevo día es una oportunidad para experimentar las misericordias frescas de Dios.",
        prayer: "Señor, gracias por tus nuevas misericordias cada mañana.",
        reflection: "¿Cómo puedes reconocer las nuevas misericordias de Dios hoy?",
        author: "Fe Diaria"
      }
    ]
  };
  
  // Select devotional based on date hash (so it changes daily)
  const langDevotionals = devotionals[language] || devotionals.english;
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
  const index = dayOfYear % langDevotionals.length;
  
  return {
    date: date.toISOString().split('T')[0],
    ...langDevotionals[index],
    language: language,
    source: 'Fallback'
  };
}

function formatDevotional(devotional) {
  let formatted = `📖 *${devotional.title}*\n`;
  formatted += `_${devotional.date}_\n\n`;
  
  formatted += `✨ *Scripture:* ${devotional.scripture}\n`;
  formatted += `"${devotional.verseText}"\n\n`;
  
  formatted += `📝 *Devotion:*\n${devotional.content}\n\n`;
  
  formatted += `🙏 *Prayer:*\n${devotional.prayer}\n\n`;
  
  if (devotional.reflection) {
    formatted += `💭 *Reflection:*\n${devotional.reflection}\n\n`;
  }
  
  formatted += `_— ${devotional.author}_\n`;
  
  if (devotional.cached) {
    formatted += `\n_♻️ From cache_`;
  }
  
  return formatted;
}

module.exports = devotionalFunction;
