// fx/fun/advice.js
// Advice generator for various life situations

async function adviceFunction(request) {
  try {
    const { topic = 'general', type = 'short', count = 1 } = request.data;
    
    // Validate count
    const adviceCount = Math.min(Math.max(parseInt(count) || 1, 1), 10);
    
    // Get advice
    const adviceList = await getAdvice(topic, type, adviceCount);
    
    // Track advice stats
    trackAdviceStats(topic, adviceCount);
    
    return {
      success: true,
      result: {
        topic: topic,
        type: type,
        count: adviceCount,
        advice: adviceList,
        formatted: formatAdvice(topic, type, adviceList)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'ADVICE_FAILED',
        message: error.message || 'Failed to get advice'
      }
    };
  }
}

async function getAdvice(topic, type, count) {
  // Try to fetch from Advice Slip API
  try {
    if (topic === 'random') {
      const adviceList = [];
      
      for (let i = 0; i < count; i++) {
        const response = await fetch('https://api.adviceslip.com/advice');
        
        if (!response.ok) {
          throw new Error(`Advice API failed: ${response.status}`);
        }
        
        const data = await response.json();
        adviceList.push({
          id: data.slip.id,
          advice: data.slip.advice,
          topic: 'random',
          type: 'short'
        });
        
        // Small delay to avoid rate limiting
        if (i < count - 1) await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      return adviceList;
    }
  } catch (apiError) {
    console.log('Advice API failed, using fallback:', apiError.message);
  }
  
  // Fallback to local advice database
  return getFallbackAdvice(topic, type, count);
}

function getFallbackAdvice(topic, type, count) {
  const adviceDatabase = {
    'general': [
      "Take one day at a time.",
      "Learn from your mistakes.",
      "Be kind to yourself and others.",
      "Stay curious and keep learning.",
      "Don't compare your journey to others.",
      "Practice gratitude daily.",
      "Take breaks when you need them.",
      "Trust your instincts.",
      "Celebrate small victories.",
      "Keep moving forward."
    ],
    'work': [
      "Prioritize your tasks.",
      "Take regular breaks to avoid burnout.",
      "Communicate clearly with your team.",
      "Set realistic deadlines.",
      "Learn to say no when necessary.",
      "Network and build relationships.",
      "Continuously improve your skills.",
      "Ask for feedback regularly.",
      "Maintain work-life balance.",
      "Stay organized and plan ahead."
    ],
    'study': [
      "Create a consistent study schedule.",
      "Break large tasks into smaller ones.",
      "Use active recall for better memory.",
      "Teach what you learn to someone else.",
      "Take regular breaks (Pomodoro technique).",
      "Stay organized with notes and materials.",
      "Get enough sleep before exams.",
      "Practice past papers.",
      "Find a study group or partner.",
      "Don't cram - space out your learning."
    ],
    'relationships': [
      "Communicate openly and honestly.",
      "Listen more than you speak.",
      "Show appreciation regularly.",
      "Respect each other's boundaries.",
      "Spend quality time together.",
      "Learn to forgive and let go.",
      "Support each other's goals.",
      "Be patient and understanding.",
      "Keep the romance alive.",
      "Grow together as individuals."
    ],
    'health': [
      "Drink plenty of water daily.",
      "Get 7-8 hours of sleep each night.",
      "Exercise for at least 30 minutes daily.",
      "Eat more fruits and vegetables.",
      "Practice stress management techniques.",
      "Take regular screen breaks.",
      "Maintain good posture.",
      "Get regular health checkups.",
      "Practice mindfulness or meditation.",
      "Find physical activities you enjoy."
    ],
    'money': [
      "Create and stick to a budget.",
      "Save at least 20% of your income.",
      "Build an emergency fund.",
      "Avoid unnecessary debt.",
      "Invest for the long term.",
      "Track your spending habits.",
      "Live below your means.",
      "Educate yourself about finances.",
      "Set clear financial goals.",
      "Review your finances regularly."
    ],
    'motivation': [
      "Start before you feel ready.",
      "Progress over perfection.",
      "Small steps lead to big changes.",
      "Your only limit is you.",
      "Believe in yourself.",
      "Action breeds confidence.",
      "You're stronger than you think.",
      "Keep going, you're getting there.",
      "Every expert was once a beginner.",
      "Don't wait for motivation, create it."
    ],
    'happiness': [
      "Practice gratitude daily.",
      "Help others without expecting anything.",
      "Spend time in nature.",
      "Cultivate meaningful relationships.",
      "Pursue hobbies you enjoy.",
      "Live in the present moment.",
      "Take care of your physical health.",
      "Set and achieve small goals.",
      "Learn to let go of things you can't control.",
      "Find joy in simple things."
    ]
  };
  
  // Get advice for the topic, or fallback to general
  const topicAdvice = adviceDatabase[topic] || adviceDatabase.general;
  
  // Select random advice
  const selectedAdvice = [];
  const usedIndices = new Set();
  
  for (let i = 0; i < count; i++) {
    // If we've used all available advice, break
    if (usedIndices.size >= topicAdvice.length) {
      break;
    }
    
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * topicAdvice.length);
    } while (usedIndices.has(randomIndex));
    
    usedIndices.add(randomIndex);
    
    selectedAdvice.push({
      id: `${topic}_${randomIndex}`,
      advice: topicAdvice[randomIndex],
      topic: topic,
      type: type
    });
  }
  
  // If we need more advice than available, start reusing
  while (selectedAdvice.length < count) {
    const randomIndex = Math.floor(Math.random() * topicAdvice.length);
    selectedAdvice.push({
      id: `${topic}_${randomIndex}_${selectedAdvice.length}`,
      advice: topicAdvice[randomIndex],
      topic: topic,
      type: type
    });
  }
  
  return selectedAdvice;
}

function formatAdvice(topic, type, adviceList) {
  const topicEmoji = getTopicEmoji(topic);
  const isMultiple = adviceList.length > 1;
  
  let formatted = `${topicEmoji} *${topic.charAt(0).toUpperCase() + topic.slice(1)} Advice*\n\n`;
  
  if (isMultiple) {
    formatted += `📚 *${adviceList.length} Pieces of Advice:*\n\n`;
    
    adviceList.forEach((advice, index) => {
      formatted += `${index + 1}. ${advice.advice}\n\n`;
    });
  } else {
    formatted += `💡 *Advice:* ${adviceList[0].advice}\n\n`;
  }
  
  formatted += `⭐ *Save this advice for later*\n`;
  
  if (!isMultiple) {
    formatted += `📚 *Need more?* Try: !advice topic:${topic} count:5\n`;
  }
  
  formatted += `\n🎯 *Other topics:* work, study, relationships, health, money, motivation, happiness`;
  
  return formatted;
}

function getTopicEmoji(topic) {
  const emojis = {
    'general': '💭',
    'work': '💼',
    'study': '📚',
    'relationships': '❤️',
    'health': '🏥',
    'money': '💰',
    'motivation': '⚡',
    'happiness': '😊',
    'random': '🎲'
  };
  
  return emojis[topic] || '💭';
}

// Advice statistics
const adviceStats = {
  totalGiven: 0,
  byTopic: new Map(),
  popularTopics: new Map()
};

function trackAdviceStats(topic, count) {
  adviceStats.totalGiven += count;
  
  if (!adviceStats.byTopic.has(topic)) {
    adviceStats.byTopic.set(topic, 0);
  }
  adviceStats.byTopic.set(topic, adviceStats.byTopic.get(topic) + count);
  
  // Update popularity
  if (!adviceStats.popularTopics.has(topic)) {
    adviceStats.popularTopics.set(topic, 0);
  }
  adviceStats.popularTopics.set(topic, adviceStats.popularTopics.get(topic) + 1);
}

adviceFunction.getStats = function() {
  const topics = Array.from(adviceStats.byTopic.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  return {
    success: true,
    stats: {
      totalGiven: adviceStats.totalGiven,
      topTopics: topics
    },
    formatted: formatAdviceStats(adviceStats.totalGiven, topics)
  };
};

function formatAdviceStats(totalGiven, topTopics) {
  let formatted = `📊 *Advice Statistics*\n\n`;
  formatted += `💡 *Total Advice Given:* ${totalGiven}\n\n`;
  
  if (topTopics.length > 0) {
    formatted += `🏆 *Most Popular Topics:*\n`;
    
    topTopics.forEach(([topic, count], index) => {
      const medal = index === 0 ? '🥇' :
                    index === 1 ? '🥈' :
                    index === 2 ? '🥉' : '🔸';
      
      formatted += `${medal} ${getTopicEmoji(topic)} ${topic}: ${count} pieces\n`;
    });
  } else {
    formatted += `No advice given yet. Be the first!\n`;
  }
  
  formatted += `\n💭 *Need advice?* Try: !advice topic:<topic> count:<number>`;
  
  return formatted;
}

adviceFunction.topics = function() {
  const topics = [
    { name: 'General', emoji: '💭', description: 'Life advice for everyday situations' },
    { name: 'Work', emoji: '💼', description: 'Career and professional advice' },
    { name: 'Study', emoji: '📚', description: 'Learning and educational advice' },
    { name: 'Relationships', emoji: '❤️', description: 'Friendship, family, and romance advice' },
    { name: 'Health', emoji: '🏥', description: 'Physical and mental health advice' },
    { name: 'Money', emoji: '💰', description: 'Financial and budgeting advice' },
    { name: 'Motivation', emoji: '⚡', description: 'Inspiration and drive advice' },
    { name: 'Happiness', emoji: '😊', description: 'Joy and contentment advice' },
    { name: 'Random', emoji: '🎲', description: 'Random advice from all categories' }
  ];
  
  return {
    success: true,
    topics: topics,
    formatted: formatTopicsList(topics)
  };
};

function formatTopicsList(topics) {
  let formatted = `📁 *Advice Topics*\n\n`;
  
  topics.forEach(topic => {
    formatted += `${topic.emoji} *${topic.name}*\n`;
    formatted += `   ${topic.description}\n\n`;
  });
  
  formatted += `🎮 *Usage:* !advice topic:<name> count:<number>`;
  
  return formatted;
}

// Special: Daily advice
adviceFunction.daily = function(userId) {
  const today = new Date().toDateString();
  const dailyTopics = ['motivation', 'happiness', 'general', 'work'];
  const randomTopic = dailyTopics[Math.floor(Math.random() * dailyTopics.length)];
  
  const advice = getFallbackAdvice(randomTopic, 'short', 1)[0];
  
  return {
    success: true,
    result: {
      daily: true,
      date: today,
      topic: randomTopic,
      advice: advice.advice
    },
    formatted: `📅 *Daily Advice (${today})*\n\nTopic: ${randomTopic}\n\n💡 ${advice.advice}\n\n⭐ Start your day right!`
  };
};

module.exports = adviceFunction;
