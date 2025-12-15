// fx/tools/dictionary.js
const axios = require('axios');

async function dictionaryFunction(request) {
  try {
    const { word, language = 'en', detailed = false } = request.data;
    
    if (!word) {
      return {
        success: false,
        error: {
          code: 'MISSING_WORD',
          message: 'Word to look up is required'
        }
      };
    }

    // Clean and validate word
    const cleanWord = word.trim().toLowerCase();
    
    if (cleanWord.length < 2) {
      return {
        success: false,
        error: {
          code: 'WORD_TOO_SHORT',
          message: 'Word must be at least 2 characters long'
        }
      };
    }

    // Look up word in dictionary
    const definition = await lookupWord(cleanWord, language, detailed);
    
    if (!definition.found) {
      return {
        success: false,
        error: {
          code: 'WORD_NOT_FOUND',
          message: `No definition found for "${word}"`
        }
      };
    }

    return {
      success: true,
      result: {
        word: definition.word,
        definitions: definition.definitions,
        pronunciation: definition.pronunciation,
        language: definition.language,
        phonetic: definition.phonetic,
        synonyms: definition.synonyms,
        antonyms: definition.antonyms,
        examples: definition.examples,
        etymology: definition.etymology,
        formatted: formatDictionaryResponse(definition, detailed)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'DICTIONARY_FAILED',
        message: error.message || 'Failed to look up word'
      }
    };
  }
}

async function lookupWord(word, language, detailed) {
  // Try multiple dictionary APIs
  try {
    // First try: Free Dictionary API
    return await lookupFreeDictionary(word, language, detailed);
  } catch (error1) {
    console.log('Free Dictionary failed:', error1.message);
    
    try {
      // Second try: Oxford Dictionary (if API key available)
      if (process.env.OXFORD_DICTIONARY_API_KEY) {
        return await lookupOxfordDictionary(word, language, detailed);
      }
    } catch (error2) {
      console.log('Oxford Dictionary failed:', error2.message);
    }
    
    // Fallback to mock data
    return lookupMockDictionary(word, language, detailed);
  }
}

async function lookupFreeDictionary(word, language, detailed) {
  const apiUrl = `https://api.dictionaryapi.dev/api/v2/entries/${language}/${encodeURIComponent(word)}`;
  
  const response = await axios.get(apiUrl, {
    timeout: 10000
  });
  
  if (!response.data || response.data.length === 0) {
    throw new Error('Word not found');
  }
  
  const data = response.data[0];
  
  // Parse definitions
  const definitions = [];
  
  if (data.meanings && data.meanings.length > 0) {
    data.meanings.forEach(meaning => {
      if (meaning.definitions && meaning.definitions.length > 0) {
        meaning.definitions.forEach(def => {
          definitions.push({
            partOfSpeech: meaning.partOfSpeech,
            definition: def.definition,
            example: def.example
          });
        });
      }
    });
  }
  
  // Parse other data
  const synonyms = [];
  const antonyms = [];
  const examples = [];
  
  if (data.meanings) {
    data.meanings.forEach(meaning => {
      if (meaning.synonyms) synonyms.push(...meaning.synonyms);
      if (meaning.antonyms) antonyms.push(...meaning.antonyms);
      
      if (meaning.definitions) {
        meaning.definitions.forEach(def => {
          if (def.example) examples.push(def.example);
        });
      }
    });
  }
  
  return {
    found: true,
    word: data.word,
    phonetic: data.phonetic,
    pronunciation: data.phonetics && data.phonetics.length > 0 ? data.phonetics[0].audio : null,
    language: language,
    definitions: definitions,
    synonyms: [...new Set(synonyms)].slice(0, 10),
    antonyms: [...new Set(antonyms)].slice(0, 10),
    examples: [...new Set(examples)].slice(0, 5),
    etymology: data.origin || null,
    source: 'Free Dictionary API'
  };
}

async function lookupOxfordDictionary(word, language, detailed) {
  const appId = process.env.OXFORD_DICTIONARY_APP_ID;
  const appKey = process.env.OXFORD_DICTIONARY_API_KEY;
  
  const apiUrl = `https://od-api.oxforddictionaries.com/api/v2/entries/${language}/${word.toLowerCase()}`;
  
  const response = await axios.get(apiUrl, {
    headers: {
      'app_id': appId,
      'app_key': appKey
    },
    timeout: 10000
  });
  
  const data = response.data;
  
  // Parse Oxford API response (simplified)
  const definitions = [];
  const examples = [];
  const synonyms = [];
  
  // This is a simplified parser - actual Oxford API has complex structure
  if (data.results && data.results[0] && data.results[0].lexicalEntries) {
    data.results[0].lexicalEntries.forEach(entry => {
      if (entry.entries && entry.entries[0] && entry.entries[0].senses) {
        entry.entries[0].senses.forEach(sense => {
          if (sense.definitions) {
            sense.definitions.forEach(def => {
              definitions.push({
                partOfSpeech: entry.lexicalCategory.text,
                definition: def
              });
            });
          }
          
          if (sense.examples) {
            sense.examples.forEach(ex => {
              examples.push(ex.text);
            });
          }
          
          if (sense.synonyms) {
            sense.synonyms.forEach(syn => {
              synonyms.push(syn.text);
            });
          }
        });
      }
    });
  }
  
  return {
    found: true,
    word: word,
    phonetic: null,
    pronunciation: null,
    language: language,
    definitions: definitions.slice(0, 10),
    synonyms: [...new Set(synonyms)].slice(0, 10),
    antonyms: [],
    examples: [...new Set(examples)].slice(0, 5),
    etymology: null,
    source: 'Oxford Dictionary API'
  };
}

function lookupMockDictionary(word, language, detailed) {
  // Mock dictionary data for common words
  const mockDictionary = {
    'hello': {
      definitions: [
        {
          partOfSpeech: 'interjection',
          definition: 'used as a greeting or to begin a telephone conversation'
        },
        {
          partOfSpeech: 'noun',
          definition: 'an utterance of "hello"; a greeting'
        }
      ],
      synonyms: ['hi', 'greetings', 'salutations', 'hey', 'howdy'],
      antonyms: ['goodbye', 'farewell'],
      examples: [
        'Hello there! How are you today?',
        'She gave me a cheerful hello as I entered the room.'
      ],
      etymology: 'Early 19th century: variant of earlier hollo; related to holla.',
      phonetic: 'həˈləʊ'
    },
    'world': {
      definitions: [
        {
          partOfSpeech: 'noun',
          definition: 'the earth, together with all of its countries and peoples'
        },
        {
          partOfSpeech: 'noun',
          definition: 'a particular region or group of countries'
        }
      ],
      synonyms: ['earth', 'globe', 'planet', 'universe', 'cosmos'],
      antonyms: [],
      examples: [
        'She traveled around the world.',
        'The ancient world had different customs.'
      ],
      etymology: 'Old English weorold, from a Germanic compound meaning "age of man".',
      phonetic: 'wəːld'
    },
    'computer': {
      definitions: [
        {
          partOfSpeech: 'noun',
          definition: 'an electronic device for storing and processing data'
        }
      ],
      synonyms: ['PC', 'machine', 'processor', 'calculator', 'device'],
      antonyms: [],
      examples: [
        'I use my computer for work and entertainment.',
        'Modern computers are incredibly powerful.'
      ],
      etymology: 'Mid 17th century: from compute + -er.',
      phonetic: 'kəmˈpjuːtə'
    },
    'knowledge': {
      definitions: [
        {
          partOfSpeech: 'noun',
          definition: 'facts, information, and skills acquired through experience or education'
        }
      ],
      synonyms: ['understanding', 'wisdom', 'expertise', 'know-how', 'awareness'],
      antonyms: ['ignorance', 'unawareness'],
      examples: [
        'He has extensive knowledge of history.',
        'The pursuit of knowledge is important.'
      ],
      etymology: 'Middle English: from an Old English compound based on cnāwan (see know).',
      phonetic: 'ˈnɒlɪdʒ'
    }
  };
  
  const mockData = mockDictionary[word.toLowerCase()];
  
  if (!mockData) {
    // Generate mock definition for unknown words
    return {
      found: true,
      word: word,
      phonetic: null,
      pronunciation: null,
      language: language,
      definitions: [
        {
          partOfSpeech: 'noun',
          definition: `A term meaning "${word}". (Mock definition - real dictionary would provide accurate definition)`
        }
      ],
      synonyms: ['related term', 'similar word'],
      antonyms: ['opposite'],
      examples: [
        `Example sentence using "${word}".`,
        `Another example with "${word}".`
      ],
      etymology: 'Origin unknown in mock dictionary.',
      source: 'Mock Dictionary'
    };
  }
  
  return {
    found: true,
    word: word,
    phonetic: mockData.phonetic,
    pronunciation: null,
    language: language,
    definitions: mockData.definitions,
    synonyms: mockData.synonyms,
    antonyms: mockData.antonyms,
    examples: mockData.examples,
    etymology: mockData.etymology,
    source: 'Mock Dictionary'
  };
}

function formatDictionaryResponse(definition, detailed) {
  const wordCapitalized = definition.word.charAt(0).toUpperCase() + definition.word.slice(1);
  
  let formatted = `📚 *Dictionary: ${wordCapitalized}*\n\n`;
  
  if (definition.phonetic) {
    formatted += `🔊 *Phonetic:* /${definition.phonetic}/\n`;
  }
  
  if (definition.pronunciation) {
    formatted += `🎵 *Pronunciation:* Available (audio)\n`;
  }
  
  formatted += `🌍 *Language:* ${definition.language.toUpperCase()}\n\n`;
  
  formatted += `📖 *Definitions:*\n`;
  
  definition.definitions.slice(0, detailed ? 10 : 3).forEach((def, index) => {
    const pos = def.partOfSpeech ? `*${def.partOfSpeech}*` : '';
    formatted += `${index + 1}. ${pos} ${def.definition}\n`;
    
    if (def.example && detailed) {
      formatted += `   *Example:* "${def.example}"\n`;
    }
    
    formatted += `\n`;
  });
  
  if (definition.definitions.length > (detailed ? 10 : 3)) {
    formatted += `📋 *${definition.definitions.length - (detailed ? 10 : 3)} more definitions available*\n\n`;
  }
  
  if (definition.synonyms && definition.synonyms.length > 0) {
    formatted += `🔄 *Synonyms:* ${definition.synonyms.slice(0, 5).join(', ')}\n`;
  }
  
  if (definition.antonyms && definition.antonyms.length > 0) {
    formatted += `⚖️ *Antonyms:* ${definition.antonyms.slice(0, 5).join(', ')}\n`;
  }
  
  if (definition.etymology && detailed) {
    formatted += `\n📜 *Etymology:* ${definition.etymology}\n`;
  }
  
  if (definition.examples && definition.examples.length > 0 && detailed) {
    formatted += `\n💬 *Examples:*\n`;
    definition.examples.slice(0, 3).forEach((example, index) => {
      formatted += `${index + 1}. "${example}"\n`;
    });
  }
  
  formatted += `\n✅ *Source:* ${definition.source}\n`;
  
  if (!detailed) {
    formatted += `\n💡 *For detailed information:* !dict ${definition.word} detailed:true`;
  }
  
  return formatted;
}

// Additional dictionary utilities
dictionaryFunction.synonyms = async function(word, language = 'en') {
  try {
    const definition = await lookupWord(word, language, false);
    
    if (!definition.found || !definition.synonyms || definition.synonyms.length === 0) {
      return {
        success: false,
        error: 'No synonyms found'
      };
    }
    
    return {
      success: true,
      synonyms: definition.synonyms,
      formatted: formatSynonymsResponse(word, definition.synonyms)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

function formatSynonymsResponse(word, synonyms) {
  let formatted = `🔄 *Synonyms for "${word}"*\n\n`;
  
  // Group synonyms by similarity
  const groups = [];
  const chunkSize = 5;
  
  for (let i = 0; i < synonyms.length; i += chunkSize) {
    groups.push(synonyms.slice(i, i + chunkSize));
  }
  
  groups.forEach((group, index) => {
    formatted += `${index + 1}. ${group.join(', ')}\n`;
  });
  
  formatted += `\n📊 *Total Synonyms:* ${synonyms.length}\n`;
  formatted += `💡 *Usage:* Replace "${word}" with any of these words`;
  
  return formatted;
}

dictionaryFunction.antonyms = async function(word, language = 'en') {
  try {
    const definition = await lookupWord(word, language, false);
    
    if (!definition.found || !definition.antonyms || definition.antonyms.length === 0) {
      return {
        success: false,
        error: 'No antonyms found'
      };
    }
    
    return {
      success: true,
      antonyms: definition.antonyms,
      formatted: formatAntonymsResponse(word, definition.antonyms)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

function formatAntonymsResponse(word, antonyms) {
  let formatted = `⚖️ *Antonyms for "${word}"*\n\n`;
  
  antonyms.forEach((antonym, index) => {
    formatted += `${index + 1}. ${antonym}\n`;
  });
  
  formatted += `\n📊 *Total Antonyms:* ${antonyms.length}\n`;
  formatted += `💡 *Usage:* Words with opposite meaning to "${word}"`;
  
  return formatted;
}

dictionaryFunction.random = async function(language = 'en') {
  try {
    // Get random word from word list
    const wordList = [
      'serendipity', 'ephemeral', 'ubiquitous', 'melancholy', 'paradox',
      'nostalgia', 'lucid', 'ineffable', 'eloquent', 'resilient',
      'euphoria', 'oblivion', 'ethereal', 'surreal', 'vicarious'
    ];
    
    const randomWord = wordList[Math.floor(Math.random() * wordList.length)];
    const definition = await lookupWord(randomWord, language, true);
    
    return {
      success: true,
      word: randomWord,
      definition: definition,
      formatted: `🎲 *Word of the Moment:*\n\n${formatDictionaryResponse(definition, true)}`
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

dictionaryFunction.wordOfTheDay = function() {
  const wordsOfTheDay = {
    'Monday': { word: 'Ephemeral', definition: 'Lasting for a very short time' },
    'Tuesday': { word: 'Ubiquitous', definition: 'Present, appearing, or found everywhere' },
    'Wednesday': { word: 'Serendipity', definition: 'The occurrence of events by chance in a happy or beneficial way' },
    'Thursday': { word: 'Melancholy', definition: 'A feeling of pensive sadness, typically with no obvious cause' },
    'Friday': { word: 'Quintessential', definition: 'Representing the most perfect example of a quality or class' },
    'Saturday': { word: 'Nostalgia', definition: 'A sentimental longing for the past' },
    'Sunday': { word: 'Resilient', definition: 'Able to withstand or recover quickly from difficult conditions' }
  };
  
  const day = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const wordData = wordsOfTheDay[day];
  
  return {
    success: true,
    day: day,
    word: wordData.word,
    definition: wordData.definition,
    formatted: `📅 *Word of the Day (${day})*\n\n📚 **${wordData.word}**\n\n💡 ${wordData.definition}\n\n🎮 Learn more: !dict ${wordData.word.toLowerCase()}`
  };
};

module.exports = dictionaryFunction;
