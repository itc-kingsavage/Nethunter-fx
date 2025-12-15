// fx/fun/joke.js
// Joke generator with various categories

async function jokeFunction(request) {
  try {
    const { category = 'any', type = 'single', language = 'en' } = request.data;
    
    // Validate category
    const validCategories = [
      'any', 'programming', 'misc', 'dark', 'pun', 
      'spooky', 'christmas', 'dad', 'knock-knock'
    ];
    
    if (!validCategories.includes(category.toLowerCase())) {
      return {
        success: false,
        error: {
          code: 'INVALID_CATEGORY',
          message: `Valid categories: ${validCategories.join(', ')}`
        }
      };
    }
    
    // Validate type
    const validTypes = ['single', 'twopart', 'any'];
    if (!validTypes.includes(type.toLowerCase())) {
      return {
        success: false,
        error: {
          code: 'INVALID_TYPE',
          message: 'Valid types: single, twopart, any'
        }
      };
    }
    
    // Get joke
    const joke = await getJoke(category, type, language);
    
    // Track joke stats
    trackJokeStats(joke.id || 'custom');
    
    return {
      success: true,
      result: {
        joke: joke,
        category: category,
        type: type,
        language: language,
        formatted: formatJoke(joke, category, type)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'JOKE_FAILED',
        message: error.message || 'Failed to get joke'
      }
    };
  }
}

async function getJoke(category, type, language) {
  // Try to fetch from JokeAPI
  try {
    const apiUrl = `https://v2.jokeapi.dev/joke/${category}`;
    const params = {
      type: type,
      lang: language,
      safeMode: category === 'dark' ? false : true
    };
    
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${apiUrl}?${queryString}`);
    
    if (!response.ok) {
      throw new Error(`JokeAPI failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.message);
    }
    
    return {
      id: data.id || Date.now(),
      category: data.category || category,
      type: data.type,
      setup: data.setup,
      delivery: data.delivery,
      joke: data.joke,
      flags: data.flags,
      safe: data.safe,
      lang: data.lang
    };
    
  } catch (apiError) {
    console.log('JokeAPI failed, using fallback:', apiError.message);
    return getFallbackJoke(category, type);
  }
}

function getFallbackJoke(category, type) {
  const jokes = {
    'programming': {
      single: [
        "Why do programmers prefer dark mode? Because light attracts bugs!",
        "A programmer's wife asks him to go to the store: 'Get a loaf of bread, and if they have eggs, get a dozen.' He comes back with 12 loaves of bread.",
        "Why do programmers confuse Halloween and Christmas? Because Oct 31 == Dec 25.",
        "How many programmers does it take to change a light bulb? None, that's a hardware problem.",
        "Why did the programmer quit his job? He didn't get arrays."
      ],
      twopart: [
        {
          setup: "Why did the programmer go broke?",
          delivery: "Because he used up all his cache!"
        },
        {
          setup: "What's a programmer's favorite place in the house?",
          delivery: "The loo-p!"
        },
        {
          setup: "Why do programmers hate nature?",
          delivery: "It has too many bugs."
        }
      ]
    },
    'dad': {
      single: [
        "I'm reading a book on anti-gravity. It's impossible to put down!",
        "Did you hear about the restaurant on the moon? Great food, no atmosphere.",
        "What do you call a fake noodle? An impasta.",
        "I told my wife she was drawing her eyebrows too high. She looked surprised.",
        "Why don't scientists trust atoms? Because they make up everything."
      ],
      twopart: [
        {
          setup: "What do you call a bear with no teeth?",
          delivery: "A gummy bear!"
        },
        {
          setup: "Why don't eggs tell jokes?",
          delivery: "They'd crack each other up."
        }
      ]
    },
    'knock-knock': {
      twopart: [
        {
          setup: "Knock knock.\nWho's there?\nLettuce.",
          delivery: "Lettuce who?\nLettuce in, it's cold out here!"
        },
        {
          setup: "Knock knock.\nWho's there?\nTank.",
          delivery: "Tank who?\nYou're welcome!"
        },
        {
          setup: "Knock knock.\nWho's there?\nBoo.",
          delivery: "Boo who?\nDon't cry, it's just a joke!"
        }
      ]
    },
    'any': {
      single: [
        "What do you call a fish wearing a bowtie? Sofishticated.",
        "What do you call a factory that makes okay products? A satisfactory.",
        "Why did the scarecrow win an award? He was outstanding in his field.",
        "What do you call a bear with no ears? B.",
        "Why don't skeletons fight each other? They don't have the guts."
      ],
      twopart: [
        {
          setup: "Why don't scientists trust atoms?",
          delivery: "Because they make up everything!"
        },
        {
          setup: "What do you call a sleeping bull?",
          delivery: "A bulldozer!"
        }
      ]
    }
  };
  
  // Select appropriate joke category and type
  const jokeCategory = jokes[category] || jokes.any;
  const jokeType = type === 'twopart' ? 'twopart' : 'single';
  
  // Get array of jokes for the type
  const jokeArray = jokeCategory[jokeType];
  
  if (!jokeArray || jokeArray.length === 0) {
    // Fallback to any category
    const fallbackArray = jokes.any[jokeType === 'twopart' ? 'twopart' : 'single'];
    const randomJoke = fallbackArray[Math.floor(Math.random() * fallbackArray.length)];
    
    return jokeType === 'twopart' 
      ? { type: 'twopart', setup: randomJoke.setup, delivery: randomJoke.delivery, category: 'any' }
      : { type: 'single', joke: randomJoke, category: 'any' };
  }
  
  // Select random joke
  const randomJoke = jokeArray[Math.floor(Math.random() * jokeArray.length)];
  
  return jokeType === 'twopart'
    ? { type: 'twopart', setup: randomJoke.setup, delivery: randomJoke.delivery, category: category }
    : { type: 'single', joke: randomJoke, category: category };
}

function formatJoke(joke, category, requestedType) {
  const categoryEmoji = getCategoryEmoji(category);
  const typeEmoji = joke.type === 'twopart' ? '🎭' : '😄';
  
  let formatted = `${categoryEmoji} *Joke Time!*\n\n`;
  formatted += `📂 *Category:* ${category.charAt(0).toUpperCase() + category.slice(1)}\n`;
  formatted += `${typeEmoji} *Type:* ${joke.type.charAt(0).toUpperCase() + joke.type.slice(1)}\n\n`;
  
  if (joke.type === 'twopart') {
    formatted += `🎤 *Setup:* ${joke.setup}\n\n`;
    formatted += `🎉 *Delivery:* ${joke.delivery}\n`;
  } else {
    formatted += `😄 *Joke:* ${joke.joke}\n`;
  }
  
  // Add joke rating prompt
  formatted += `\n⭐ *Rate this joke:*\n`;
  formatted += `👍 Funny | 👎 Not funny\n`;
  
  formatted += `\n🎮 *Get another:* !joke category:<category> type:<single/twopart>`;
  
  return formatted;
}

function getCategoryEmoji(category) {
  const emojis = {
    'programming': '💻',
    'dad': '👨',
    'knock-knock': '🚪',
    'dark': '🌚',
    'pun': '📝',
    'spooky': '👻',
    'christmas': '🎄',
    'misc': '🎭',
    'any': '😄'
  };
  
  return emojis[category] || '😄';
}

// Joke statistics
const jokeStats = {
  totalJokes: 0,
  byCategory: new Map(),
  ratings: new Map()
};

function trackJokeStats(jokeId) {
  jokeStats.totalJokes++;
}

jokeFunction.rateJoke = function(jokeId, rating) {
  if (!jokeStats.ratings.has(jokeId)) {
    jokeStats.ratings.set(jokeId, { likes: 0, dislikes: 0 });
  }
  
  const jokeRating = jokeStats.ratings.get(jokeId);
  
  if (rating === 'like') {
    jokeRating.likes++;
  } else if (rating === 'dislike') {
    jokeRating.dislikes++;
  }
  
  return {
    success: true,
    rating: jokeRating,
    formatted: `Thanks for rating! Current: 👍 ${jokeRating.likes} | 👎 ${jokeRating.dislikes}`
  };
};

jokeFunction.getStats = function() {
  const categories = Array.from(jokeStats.byCategory.entries());
  
  return {
    success: true,
    stats: {
      totalJokes: jokeStats.totalJokes,
      categories: categories
    },
    formatted: formatJokeStats(jokeStats.totalJokes, categories)
  };
};

function formatJokeStats(totalJokes, categories) {
  let formatted = `📊 *Joke Statistics*\n\n`;
  formatted += `🎭 *Total Jokes Delivered:* ${totalJokes}\n\n`;
  
  if (categories.length > 0) {
    formatted += `📁 *By Category:*\n`;
    categories.forEach(([category, count]) => {
      formatted += `   ${getCategoryEmoji(category)} ${category}: ${count} jokes\n`;
    });
  }
  
  formatted += `\n🎯 *Most Popular Categories:*\n`;
  formatted += `1. Programming 💻\n`;
  formatted += `2. Dad Jokes 👨\n`;
  formatted += `3. Puns 📝\n\n`;
  
  formatted += `💡 *Try:* !joke category:programming type:twopart`;
  
  return formatted;
}

jokeFunction.categories = function() {
  const categories = [
    { name: 'Programming', emoji: '💻', description: 'Tech and coding humor' },
    { name: 'Dad', emoji: '👨', description: 'Classic dad jokes' },
    { name: 'Knock-Knock', emoji: '🚪', description: 'Interactive knock-knock jokes' },
    { name: 'Pun', emoji: '📝', description: 'Wordplay and puns' },
    { name: 'Dark', emoji: '🌚', description: 'Dark humor (use with caution)' },
    { name: 'Spooky', emoji: '👻', description: 'Halloween and ghost jokes' },
    { name: 'Christmas', emoji: '🎄', description: 'Holiday-themed jokes' },
    { name: 'Misc', emoji: '🎭', description: 'Various other jokes' },
    { name: 'Any', emoji: '😄', description: 'Random from all categories' }
  ];
  
  return {
    success: true,
    categories: categories,
    formatted: formatCategoriesList(categories)
  };
};

function formatCategoriesList(categories) {
  let formatted = `📁 *Joke Categories*\n\n`;
  
  categories.forEach(cat => {
    formatted += `${cat.emoji} *${cat.name}*\n`;
    formatted += `   ${cat.description}\n\n`;
  });
  
  formatted += `🎮 *Usage:* !joke category:<name> type:<single/twopart>`;
  
  return formatted;
}

module.exports = jokeFunction;
