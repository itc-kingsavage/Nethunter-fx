// fx/fun/rps.js
// Rock Paper Scissors game with extended options

async function rpsFunction(request) {
  try {
    const { playerChoice, mode = 'classic', userId } = request.data;
    
    if (!playerChoice) {
      return {
        success: false,
        error: {
          code: 'MISSING_CHOICE',
          message: 'Please provide your choice'
        }
      };
    }

    // Validate mode
    const validModes = ['classic', 'extended', 'ultimate'];
    if (!validModes.includes(mode)) {
      return {
        success: false,
        error: {
          code: 'INVALID_MODE',
          message: 'Valid modes are: classic, extended, ultimate'
        }
      };
    }

    // Get available choices for mode
    const choices = getChoicesForMode(mode);
    
    // Validate player choice
    const normalizedChoice = normalizeRPSChoice(playerChoice, choices);
    
    if (!normalizedChoice) {
      return {
        success: false,
        error: {
          code: 'INVALID_CHOICE',
          message: `For ${mode} mode, valid choices are: ${choices.join(', ')}`
        }
      };
    }

    // Generate bot choice
    const botChoice = generateRPSBotChoice(choices, mode);
    
    // Determine winner
    const result = determineRPSWinner(normalizedChoice, botChoice, mode);
    
    // Update user stats if userId provided
    if (userId) {
      updateRPSStats(userId, mode, result);
    }

    return {
      success: true,
      result: {
        mode: mode,
        playerChoice: normalizedChoice,
        botChoice: botChoice,
        result: result.outcome,
        playerScore: result.playerScore,
        botScore: result.botScore,
        explanation: result.explanation,
        formatted: formatRPSResult(mode, normalizedChoice, botChoice, result)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'RPS_FAILED',
        message: error.message || 'Failed to play Rock Paper Scissors'
      }
    };
  }
}

function getChoicesForMode(mode) {
  const choices = {
    'classic': ['rock', 'paper', 'scissors'],
    'extended': ['rock', 'paper', 'scissors', 'lizard', 'spock'],
    'ultimate': ['rock', 'paper', 'scissors', 'lizard', 'spock', 'gun', 'lightning', 'devil', 'dragon', 'water', 'air', 'sponge', 'wolf', 'tree', 'human', 'snake', 'fire']
  };
  
  return choices[mode] || choices.classic;
}

function normalizeRPSChoice(choice, availableChoices) {
  const choiceMap = {
    // Classic
    'r': 'rock',
    'p': 'paper',
    's': 'scissors',
    
    // Extended (Rock Paper Scissors Lizard Spock)
    'l': 'lizard',
    'sp': 'spock',
    'spock': 'spock',
    
    // Ultimate additions
    'g': 'gun',
    'light': 'lightning',
    'dev': 'devil',
    'drag': 'dragon',
    'w': 'water',
    'a': 'air',
    'sponge': 'sponge',
    'wolf': 'wolf',
    't': 'tree',
    'h': 'human',
    'sn': 'snake',
    'f': 'fire'
  };
  
  const normalized = choiceMap[choice.toLowerCase()] || choice.toLowerCase();
  
  // Check if choice is valid for current mode
  if (availableChoices.includes(normalized)) {
    return normalized;
  }
  
  return null;
}

function generateRPSBotChoice(choices, mode) {
  // Simple random choice for now
  // Could add AI patterns based on mode
  const randomIndex = Math.floor(Math.random() * choices.length);
  return choices[randomIndex];
}

function determineRPSWinner(player, bot, mode) {
  // Define winning rules for each mode
  const rules = getRulesForMode(mode);
  
  if (player === bot) {
    return {
      outcome: 'draw',
      playerScore: 0.5,
      botScore: 0.5,
      explanation: 'Both chose the same!',
      message: 'It\'s a draw!'
    };
  }
  
  if (rules[player] && rules[player].beats.includes(bot)) {
    return {
      outcome: 'win',
      playerScore: 1,
      botScore: 0,
      explanation: rules[player].explanations[bot] || `${player} beats ${bot}`,
      message: 'You win!'
    };
  }
  
  // If player didn't win, bot must win
  const botExplanation = rules[bot] && rules[bot].explanations[player] 
    ? rules[bot].explanations[player] 
    : `${bot} beats ${player}`;
    
  return {
    outcome: 'lose',
    playerScore: 0,
    botScore: 1,
    explanation: botExplanation,
    message: 'You lose!'
  };
}

function getRulesForMode(mode) {
  const classicRules = {
    'rock': {
      beats: ['scissors'],
      explanations: {
        'scissors': 'Rock crushes Scissors'
      }
    },
    'paper': {
      beats: ['rock'],
      explanations: {
        'rock': 'Paper covers Rock'
      }
    },
    'scissors': {
      beats: ['paper'],
      explanations: {
        'paper': 'Scissors cut Paper'
      }
    }
  };
  
  const extendedRules = {
    ...classicRules,
    'lizard': {
      beats: ['paper', 'spock'],
      explanations: {
        'paper': 'Lizard eats Paper',
        'spock': 'Lizard poisons Spock'
      }
    },
    'spock': {
      beats: ['scissors', 'rock'],
      explanations: {
        'scissors': 'Spock smashes Scissors',
        'rock': 'Spock vaporizes Rock'
      }
    },
    // Add additional rules for extended mode
    'rock': {
      ...classicRules.rock,
      beats: [...classicRules.rock.beats, 'lizard'],
      explanations: {
        ...classicRules.rock.explanations,
        'lizard': 'Rock crushes Lizard'
      }
    },
    'paper': {
      ...classicRules.paper,
      beats: [...classicRules.paper.beats, 'spock'],
      explanations: {
        ...classicRules.paper.explanations,
        'spock': 'Paper disproves Spock'
      }
    },
    'scissors': {
      ...classicRules.scissors,
      beats: [...classicRules.scissors.beats, 'lizard'],
      explanations: {
        ...classicRules.scissors.explanations,
        'lizard': 'Scissors decapitate Lizard'
      }
    }
  };
  
  // Simplified ultimate rules (15 elements)
  const ultimateRules = {
    'rock': { beats: ['scissors', 'lizard', 'fire', 'snake', 'human', 'tree', 'wolf', 'sponge'], explanations: {} },
    'paper': { beats: ['rock', 'spock', 'air', 'water', 'dragon', 'devil', 'lightning', 'gun'], explanations: {} },
    'scissors': { beats: ['paper', 'lizard', 'air', 'water', 'sponge', 'tree', 'human', 'snake'], explanations: {} },
    'lizard': { beats: ['paper', 'spock', 'air', 'water', 'sponge', 'tree', 'human', 'snake'], explanations: {} },
    'spock': { beats: ['scissors', 'rock', 'fire', 'snake', 'human', 'tree', 'wolf', 'sponge'], explanations: {} },
    'gun': { beats: ['rock', 'fire', 'scissors', 'snake', 'human', 'tree', 'wolf'], explanations: {} },
    'lightning': { beats: ['gun', 'rock', 'fire', 'scissors', 'snake', 'human', 'tree'], explanations: {} },
    'devil': { beats: ['lightning', 'gun', 'rock', 'fire', 'scissors', 'snake', 'human'], explanations: {} },
    'dragon': { beats: ['devil', 'lightning', 'gun', 'rock', 'fire', 'scissors', 'snake'], explanations: {} },
    'water': { beats: ['dragon', 'devil', 'lightning', 'gun', 'rock', 'fire', 'scissors'], explanations: {} },
    'air': { beats: ['water', 'dragon', 'devil', 'lightning', 'gun', 'rock', 'fire'], explanations: {} },
    'sponge': { beats: ['air', 'water', 'dragon', 'devil', 'lightning', 'gun', 'rock'], explanations: {} },
    'wolf': { beats: ['sponge', 'air', 'water', 'dragon', 'devil', 'lightning', 'gun'], explanations: {} },
    'tree': { beats: ['wolf', 'sponge', 'air', 'water', 'dragon', 'devil', 'lightning'], explanations: {} },
    'human': { beats: ['tree', 'wolf', 'sponge', 'air', 'water', 'dragon', 'devil'], explanations: {} },
    'snake': { beats: ['human', 'tree', 'wolf', 'sponge', 'air', 'water', 'dragon'], explanations: {} },
    'fire': { beats: ['snake', 'human', 'tree', 'wolf', 'sponge', 'air', 'water'], explanations: {} }
  };
  
  switch (mode) {
    case 'classic': return classicRules;
    case 'extended': return extendedRules;
    case 'ultimate': return ultimateRules;
    default: return classicRules;
  }
}

// User statistics storage
const rpsStats = new Map();

function updateRPSStats(userId, mode, result) {
  const statKey = `${userId}_${mode}`;
  
  if (!rpsStats.has(statKey)) {
    rpsStats.set(statKey, {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      totalScore: 0
    });
  }
  
  const stats = rpsStats.get(statKey);
  stats.gamesPlayed += 1;
  
  switch (result.outcome) {
    case 'win':
      stats.wins += 1;
      break;
    case 'lose':
      stats.losses += 1;
      break;
    case 'draw':
      stats.draws += 1;
      break;
  }
  
  stats.totalScore += result.playerScore;
}

function formatRPSResult(mode, playerChoice, botChoice, result) {
  const playerEmoji = getRPSChoiceEmoji(playerChoice);
  const botEmoji = getRPSChoiceEmoji(botChoice);
  const resultEmoji = getResultEmoji(result.outcome);
  const modeName = mode.charAt(0).toUpperCase() + mode.slice(1);
  
  let formatted = `🪨📄✂️ *${modeName} RPS*\n\n`;
  formatted += `${playerEmoji} *You chose:* ${playerChoice}\n`;
  formatted += `${botEmoji} *Bot chose:* ${botChoice}\n`;
  formatted += `${resultEmoji} *Result:* ${result.message}\n`;
  
  if (result.explanation) {
    formatted += `📚 *Why:* ${result.explanation}\n`;
  }
  
  formatted += `\n📊 *Score:* You ${result.playerScore} - ${result.botScore} Bot\n`;
  
  // Mode-specific info
  if (mode === 'extended') {
    formatted += `\n🎯 *Extended Mode Rules:*\n`;
    formatted += `• Scissors cuts Paper\n`;
    formatted += `• Paper covers Rock\n`;
    formatted += `• Rock crushes Lizard\n`;
    formatted += `• Lizard poisons Spock\n`;
    formatted += `• Spock smashes Scissors\n`;
    formatted += `• Scissors decapitates Lizard\n`;
    formatted += `• Lizard eats Paper\n`;
    formatted += `• Paper disproves Spock\n`;
    formatted += `• Spock vaporizes Rock\n`;
    formatted += `• Rock crushes Scissors\n`;
  } else if (mode === 'ultimate') {
    formatted += `\n⚡ *Ultimate Mode:*\n`;
    formatted += `15 elements, each beats 7 others\n`;
    formatted += `Complex rock-paper-scissors!\n`;
  }
  
  formatted += `\n🎮 *Play again:* !rps <choice> mode:${mode}`;
  
  return formatted;
}

function getRPSChoiceEmoji(choice) {
  const emojis = {
    'rock': '🪨',
    'paper': '📄',
    'scissors': '✂️',
    'lizard': '🦎',
    'spock': '🖖',
    'gun': '🔫',
    'lightning': '⚡',
    'devil': '😈',
    'dragon': '🐉',
    'water': '💧',
    'air': '💨',
    'sponge': '🧽',
    'wolf': '🐺',
    'tree': '🌳',
    'human': '👤',
    'snake': '🐍',
    'fire': '🔥'
  };
  
  return emojis[choice] || '❓';
}

function getResultEmoji(outcome) {
  const emojis = {
    'win': '🎉',
    'lose': '😞',
    'draw': '🤝'
  };
  return emojis[outcome] || '⚡';
}

// Statistics functions
rpsFunction.getStats = function(userId, mode = 'all') {
  let stats;
  
  if (mode === 'all') {
    // Combine stats from all modes
    const allStats = {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      totalScore: 0,
      modes: {}
    };
    
    for (const [statKey, statData] of rpsStats.entries()) {
      if (statKey.startsWith(`${userId}_`)) {
        const statMode = statKey.split('_')[1];
        allStats.modes[statMode] = statData;
        
        allStats.gamesPlayed += statData.gamesPlayed;
        allStats.wins += statData.wins;
        allStats.losses += statData.losses;
        allStats.draws += statData.draws;
        allStats.totalScore += statData.totalScore;
      }
    }
    
    stats = allStats;
  } else {
    const statKey = `${userId}_${mode}`;
    stats = rpsStats.get(statKey);
  }
  
  if (!stats || stats.gamesPlayed === 0) {
    return {
      success: false,
      error: `No ${mode} games played yet`
    };
  }
  
  const winRate = (stats.wins / stats.gamesPlayed * 100).toFixed(1);
  const avgScore = (stats.totalScore / stats.gamesPlayed).toFixed(2);
  
  return {
    success: true,
    stats: {
      ...stats,
      winRate: winRate + '%',
      averageScore: avgScore
    },
    formatted: formatRPSStats(stats, userId, mode, winRate, avgScore)
  };
};

function formatRPSStats(stats, userId, mode, winRate, avgScore) {
  const modeDisplay = mode === 'all' ? 'All Modes' : mode.charAt(0).toUpperCase() + mode.slice(1);
  
  let formatted = `📊 *RPS Statistics (${modeDisplay})*\n\n`;
  formatted += `👤 *Player:* ${userId.substring(0, 12)}...\n\n`;
  
  formatted += `🎮 *Games Played:* ${stats.gamesPlayed}\n`;
  formatted += `✅ *Wins:* ${stats.wins}\n`;
  formatted += `❌ *Losses:* ${stats.losses}\n`;
  formatted += `🤝 *Draws:* ${stats.draws}\n`;
  formatted += `📈 *Win Rate:* ${winRate}%\n`;
  formatted += `⭐ *Average Score:* ${avgScore}\n`;
  
  if (stats.modes) {
    formatted += `\n📁 *By Mode:*\n`;
    for (const [modeName, modeStats] of Object.entries(stats.modes)) {
      const modeWinRate = modeStats.gamesPlayed > 0 ? 
        (modeStats.wins / modeStats.gamesPlayed * 100).toFixed(1) : '0.0';
      formatted += `• ${modeName}: ${modeStats.gamesPlayed} games, ${modeWinRate}% win rate\n`;
    }
  }
  
  formatted += `\n💡 *Try different modes:*\n`;
  formatted += `• !rps rock (classic)\n`;
  formatted += `• !rps spock mode:extended\n`;
  formatted += `• !rps dragon mode:ultimate`;
  
  return formatted;
}

module.exports = rpsFunction;
