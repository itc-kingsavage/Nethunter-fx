// fx/fun/quote.js
// Quote generator with various categories and authors

async function quoteFunction(request) {
  try {
    const { 
      category = 'inspirational', 
      author = null,
      type = 'quote',
      count = 1 
    } = request.data;
    
    // Validate count
    const quoteCount = Math.min(Math.max(parseInt(count) || 1, 1), 5);
    
    // Get quotes
    const quotes = await getQuotes(category, author, type, quoteCount);
    
    // Track quote stats
    trackQuoteStats(category, author, quoteCount);
    
    return {
      success: true,
      result: {
        category: category,
        author: author,
        type: type,
        count: quoteCount,
        quotes: quotes,
        formatted: formatQuotes(category, author, type, quotes)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'QUOTE_FAILED',
        message: error.message || 'Failed to get quotes'
      }
    };
  }
}

async function getQuotes(category, author, type, count) {
  // Try to fetch from Quote API
  try {
    let apiUrl;
    
    if (author) {
      apiUrl = `https://api.quotable.io/quotes?author=${encodeURIComponent(author)}&limit=${count}`;
    } else if (category && category !== 'random') {
      apiUrl = `https://api.quotable.io/quotes?tags=${encodeURIComponent(category)}&limit=${count}`;
    } else {
      apiUrl = `https://api.quotable.io/quotes/random?limit=${count}`;
    }
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Quote API failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Handle different API response structures
    let quotesData;
    if (Array.isArray(data)) {
      quotesData = data;
    } else if (data.results) {
      quotesData = data.results;
    } else {
      quotesData = [data];
    }
    
    return quotesData.slice(0, count).map(quote => ({
      id: quote._id || quote.id || Date.now(),
      content: quote.content,
      author: quote.author,
      category: quote.tags ? quote.tags[0] : category,
      length: quote.length,
      tags: quote.tags || [category]
    }));
    
  } catch (apiError) {
    console.log('Quote API failed, using fallback:', apiError.message);
    return getFallbackQuotes(category, author, count);
  }
}

function getFallbackQuotes(category, author, count) {
  const quotesDatabase = {
    'inspirational': [
      {
        content: "The only way to do great work is to love what you do.",
        author: "Steve Jobs",
        category: "inspirational"
      },
      {
        content: "Believe you can and you're halfway there.",
        author: "Theodore Roosevelt",
        category: "inspirational"
      },
      {
        content: "Your time is limited, don't waste it living someone else's life.",
        author: "Steve Jobs",
        category: "inspirational"
      },
      {
        content: "The future belongs to those who believe in the beauty of their dreams.",
        author: "Eleanor Roosevelt",
        category: "inspirational"
      },
      {
        content: "It always seems impossible until it's done.",
        author: "Nelson Mandela",
        category: "inspirational"
      }
    ],
    'motivational': [
      {
        content: "Don't watch the clock; do what it does. Keep going.",
        author: "Sam Levenson",
        category: "motivational"
      },
      {
        content: "The only place where success comes before work is in the dictionary.",
        author: "Vidal Sassoon",
        category: "motivational"
      },
      {
        content: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
        author: "Winston Churchill",
        category: "motivational"
      },
      {
        content: "The harder I work, the more luck I seem to have.",
        author: "Thomas Jefferson",
        category: "motivational"
      },
      {
        content: "Don't be pushed around by the fears in your mind. Be led by the dreams in your heart.",
        author: "Roy T. Bennett",
        category: "motivational"
      }
    ],
    'life': [
      {
        content: "In the end, it's not the years in your life that count. It's the life in your years.",
        author: "Abraham Lincoln",
        category: "life"
      },
      {
        content: "Life is what happens to you while you're busy making other plans.",
        author: "Allen Saunders",
        category: "life"
      },
      {
        content: "The purpose of our lives is to be happy.",
        author: "Dalai Lama",
        category: "life"
      },
      {
        content: "Life is either a daring adventure or nothing at all.",
        author: "Helen Keller",
        category: "life"
      },
      {
        content: "You only live once, but if you do it right, once is enough.",
        author: "Mae West",
        category: "life"
      }
    ],
    'love': [
      {
        content: "The best thing to hold onto in life is each other.",
        author: "Audrey Hepburn",
        category: "love"
      },
      {
        content: "Love is composed of a single soul inhabiting two bodies.",
        author: "Aristotle",
        category: "love"
      },
      {
        content: "To love and be loved is to feel the sun from both sides.",
        author: "David Viscott",
        category: "love"
      },
      {
        content: "Love is when the other person's happiness is more important than your own.",
        author: "H. Jackson Brown Jr.",
        category: "love"
      },
      {
        content: "The greatest happiness of life is the conviction that we are loved.",
        author: "Victor Hugo",
        category: "love"
      }
    ],
    'wisdom': [
      {
        content: "Knowing yourself is the beginning of all wisdom.",
        author: "Aristotle",
        category: "wisdom"
      },
      {
        content: "The only true wisdom is in knowing you know nothing.",
        author: "Socrates",
        category: "wisdom"
      },
      {
        content: "The fool doth think he is wise, but the wise man knows himself to be a fool.",
        author: "William Shakespeare",
        category: "wisdom"
      },
      {
        content: "Wisdom is not a product of schooling but of the lifelong attempt to acquire it.",
        author: "Albert Einstein",
        category: "wisdom"
      },
      {
        content: "The wise man learns more from his enemies than the fool from his friends.",
        author: "Baltasar Gracián",
        category: "wisdom"
      }
    ]
  };
  
  // Filter by author if specified
  let quotes;
  
  if (author) {
    // Find quotes by this author
    quotes = [];
    for (const categoryQuotes of Object.values(quotesDatabase)) {
      for (const quote of categoryQuotes) {
        if (quote.author.toLowerCase().includes(author.toLowerCase())) {
          quotes.push(quote);
        }
      }
    }
    
    if (quotes.length === 0) {
      // Author not found, use inspirational
      quotes = quotesDatabase.inspirational;
    }
  } else {
    // Use specified category or default to inspirational
    quotes = quotesDatabase[category] || quotesDatabase.inspirational;
  }
  
  // Select random quotes
  const selectedQuotes = [];
  const usedIndices = new Set();
  
  for (let i = 0; i < Math.min(count, quotes.length); i++) {
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * quotes.length);
    } while (usedIndices.has(randomIndex));
    
    usedIndices.add(randomIndex);
    
    selectedQuotes.push({
      id: `${category}_${randomIndex}_${Date.now()}`,
      content: quotes[randomIndex].content,
      author: quotes[randomIndex].author,
      category: quotes[randomIndex].category
    });
  }
  
  return selectedQuotes;
}

function formatQuotes(category, author, type, quotes) {
  const categoryEmoji = getCategoryEmoji(category);
  const isMultiple = quotes.length > 1;
  
  let formatted = `${categoryEmoji} *${category.charAt(0).toUpperCase() + category.slice(1)} Quotes*\n\n`;
  
  if (author) {
    formatted += `✍️ *Author:* ${author}\n\n`;
  }
  
  if (isMultiple) {
    formatted += `📚 *${quotes.length} Quotes:*\n\n`;
    
    quotes.forEach((quote, index) => {
      formatted += `${index + 1}. "${quote.content}"\n`;
      formatted += `   — ${quote.author}\n\n`;
    });
  } else {
    formatted += `💬 *Quote:* "${quotes[0].content}"\n\n`;
    formatted += `✍️ *Author:* ${quotes[0].author}\n\n`;
  }
  
  formatted += `⭐ *Save your favorite quotes*\n`;
  
  if (!isMultiple) {
    formatted += `📚 *More quotes:* !quote category:${category} count:3\n`;
  }
  
  formatted += `\n🎯 *Categories:* inspirational, motivational, life, love, wisdom`;
  
  return formatted;
}

function getCategoryEmoji(category) {
  const emojis = {
    'inspirational': '✨',
    'motivational': '⚡',
    'life': '🌱',
    'love': '❤️',
    'wisdom': '🧠',
    'random': '🎲'
  };
  
  return emojis[category] || '💬';
}

// Quote statistics
const quoteStats = {
  totalQuotes: 0,
  byCategory: new Map(),
  byAuthor: new Map(),
  favorites: new Map()
};

function trackQuoteStats(category, author, count) {
  quoteStats.totalQuotes += count;
  
  // Track by category
  if (!quoteStats.byCategory.has(category)) {
    quoteStats.byCategory.set(category, 0);
  }
  quoteStats.byCategory.set(category, quoteStats.byCategory.get(category) + count);
  
  // Track by author if specified
  if (author) {
    if (!quoteStats.byAuthor.has(author)) {
      quoteStats.byAuthor.set(author, 0);
    }
    quoteStats.byAuthor.set(author, quoteStats.byAuthor.get(author) + count);
  }
}

quoteFunction.getStats = function() {
  const topCategories = Array.from(quoteStats.byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
    
  const topAuthors = Array.from(quoteStats.byAuthor.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  return {
    success: true,
    stats: {
      totalQuotes: quoteStats.totalQuotes,
      topCategories: topCategories,
      topAuthors: topAuthors
    },
    formatted: formatQuoteStats(quoteStats.totalQuotes, topCategories, topAuthors)
  };
};

function formatQuoteStats(totalQuotes, topCategories, topAuthors) {
  let formatted = `📊 *Quote Statistics*\n\n`;
  formatted += `💬 *Total Quotes Shared:* ${totalQuotes}\n\n`;
  
  if (topCategories.length > 0) {
    formatted += `🏆 *Popular Categories:*\n`;
    
    topCategories.forEach(([category, count], index) => {
      const medal = index === 0 ? '🥇' :
                    index === 1 ? '🥈' :
                    index === 2 ? '🥉' : '🔸';
      
      formatted += `${medal} ${getCategoryEmoji(category)} ${category}: ${count} quotes\n`;
    });
    
    formatted += `\n`;
  }
  
  if (topAuthors.length > 0) {
    formatted += `✍️ *Popular Authors:*\n`;
    
    topAuthors.forEach(([author, count], index) => {
      const medal = index === 0 ? '🥇' :
                    index === 1 ? '🥈' :
                    index === 2 ? '🥉' : '🔸';
      
      formatted += `${medal} ${author}: ${count} quotes\n`;
    });
  }
  
  formatted += `\n💭 *Get quotes:* !quote category:<name> count:<number>`;
  
  return formatted;
}

quoteFunction.categories = function() {
  const categories = [
    { name: 'Inspirational', emoji: '✨', description: 'Uplifting and encouraging quotes' },
    { name: 'Motivational', emoji: '⚡', description: 'Energetic and driving quotes' },
    { name: 'Life', emoji: '🌱', description: 'Quotes about life and living' },
    { name: 'Love', emoji: '❤️', description: 'Quotes about love and relationships' },
    { name: 'Wisdom', emoji: '🧠', description: 'Thoughtful and insightful quotes' },
    { name: 'Random', emoji: '🎲', description: 'Random quotes from all categories' }
  ];
  
  return {
    success: true,
    categories: categories,
    formatted: formatQuoteCategories(categories)
  };
};

function formatQuoteCategories(categories) {
  let formatted = `📁 *Quote Categories*\n\n`;
  
  categories.forEach(cat => {
    formatted += `${cat.emoji} *${cat.name}*\n`;
    formatted += `   ${cat.description}\n\n`;
  });
  
  formatted += `🎮 *Usage:* !quote category:<name> count:<number>\n`;
  formatted += `✍️ *By author:* !quote author:"Author Name"`;
  
  return formatted;
}

quoteFunction.favorite = function(userId, quoteId) {
  if (!quoteStats.favorites.has(userId)) {
    quoteStats.favorites.set(userId, new Set());
  }
  
  const userFavorites = quoteStats.favorites.get(userId);
  userFavorites.add(quoteId);
  
  return {
    success: true,
    message: 'Quote added to favorites',
    formatted: `⭐ Quote saved to your favorites!\n\nView with: !quote favorites`
  };
};

quoteFunction.getFavorites = function(userId) {
  const userFavorites = quoteStats.favorites.get(userId);
  
  if (!userFavorites || userFavorites.size === 0) {
    return {
      success: false,
      error: 'No favorite quotes yet'
    };
  }
  
  return {
    success: true,
    favorites: Array.from(userFavorites),
    count: userFavorites.size,
    formatted: `⭐ *Your Favorite Quotes*\n\nYou have ${userFavorites.size} favorite quotes.\n\n💡 Keep collecting inspirational quotes!`
  };
};

// Daily quote feature
quoteFunction.daily = function(userId) {
  const today = new Date().toDateString();
  const categories = ['inspirational', 'motivational', 'life', 'wisdom'];
  const randomCategory = categories[Math.floor(Math.random() * categories.length)];
  
  const quote = getFallbackQuotes(randomCategory, null, 1)[0];
  
  return {
    success: true,
    result: {
      daily: true,
      date: today,
      category: randomCategory,
      quote: quote
    },
    formatted: `📅 *Daily Quote (${today})*\n\n💬 "${quote.content}"\n\n✍️ — ${quote.author}\n\n⭐ Start your day inspired!`
  };
};

module.exports = quoteFunction;
