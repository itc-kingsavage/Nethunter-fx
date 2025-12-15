// fx/fun/chifumi.js
// Rock-Paper-Scissors variant (also known as Pierre-Feuille-Ciseaux in French)

async function chifumiFunction(request) {
  try {
    const { playerChoice, userId, bet = 0 } = request.data;
    
    if (!playerChoice) {
      return {
        success: false,
        error: {
          code: 'MISSING_CHOICE',
          message: 'Please provide your choice: rock, paper, or scissors'
        }
      };
    }

    // Validate player choice
    const validChoices = ['rock', 'paper', 'scissors', 'pierre', 'feuille', 'ciseaux'];
    const normalizedChoice = normalizeChoice(playerChoice);
    
    if (!validChoices.includes(normalizedChoice)) {
      return {
        success: false,
        error: {
          code: 'INVALID_CHOICE',
          message: 'Valid choices are: rock, paper, scissors (or pierre, feuille, ciseaux in French)'
        }
      };
    }

    // Generate bot choice
    const botChoice = generateBotChoice();
    
    // Determine winner
    const result = determineWinner(normalizedChoice, botChoice);
    
    // Calculate if bet was won
    let betResult = null;
    if (bet > 0) {
      betResult = calculateBetResult(result, bet);
    }

    // Update user stats if userId provided
    if (userId) {
      updateUserStats(userId, result);
    }

    return {
      success: true,
      result: {
        playerChoice: normalizedChoice,
        botChoice: botChoice,
        result: result.outcome,
        playerScore: result.playerScore,
        botScore: result.botScore,
        betResult: betResult,
        formatted: formatChifumiResult(normalizedChoice, botChoice, result, betResult)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'CHIFUMI_FAILED',
        message: error.message || 'Failed to play Chifumi'
      }
    };
  }
}

function normalizeChoice(choice) {
  const choiceMap = {
    'rock': 'rock',
    'r': 'rock',
    'pierre': 'rock',
    'stone': 'rock',
    
    'paper': 'paper',
    'p': 'paper',
    'feuille': 'paper',
    'sheet': 'paper',
    
    'scissors': 'scissors',
    's': 'scissors',
    'ciseaux': 'scissors',
    'scissor': 'scissors'
  };
  
  const normalized = choiceMap[choice.toLowerCase()];
  return normalized || choice.toLowerCase();
}

function generateBotChoice() {
  const choices = ['rock', 'paper', 'scissors'];
  const randomIndex = Math.floor(Math.random() * choices.length);
  return choices[randomIndex];
}

function determineWinner(player, bot) {
  // Game rules
  const rules = {
    'rock': { beats: 'scissors', losesTo: 'paper' },
    'paper': { beats: 'rock', losesTo: 'scissors' },
    'scissors': { beats: 'paper', losesTo: 'rock' }
  };
  
  if (player === bot) {
    return {
      outcome: 'draw',
      playerScore: 0.5,
      botScore: 0.5,
      message: 'It\'s a draw!'
    };
  }
  
  if (rules[player].beats === bot) {
    return {
      outcome: 'win',
      playerScore: 1,
      botScore: 0,
      message: 'You win!'
    };
  }
  
  return {
    outcome: 'lose',
    playerScore: 0,
    botScore: 1,
    message: 'You lose!'
  };
}

function calculateBetResult(gameResult, betAmount) {
  if (gameResult.outcome === 'win') {
    return {
      won: true,
      amount: betAmount * 2,
      profit: betAmount
    };
  } else if (gameResult.outcome === 'draw') {
    return {
      won: null,
      amount: betAmount,
      profit: 0
    };
  } else {
    return {
      won: false,
      amount: 0,
      profit: -betAmount
    };
  }
}

// User statistics storage
const userStats = new Map();

function updateUserStats(userId, result) {
  if (!userStats.has(userId)) {
    userStats.set(userId, {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winStreak: 0,
      maxWinStreak: 0,
      totalScore: 0
    });
  }
  
  const stats = userStats.get(userId);
  stats.gamesPlayed += 1;
  
  switch (result.outcome) {
    case 'win':
      stats.wins += 1;
      stats.winStreak += 1;
      if (stats.winStreak > stats.maxWinStreak) {
        stats.maxWinStreak = stats.winStreak;
      }
      break;
    case 'lose':
      stats.losses += 1;
      stats.winStreak = 0;
      break;
    case 'draw':
      stats.draws += 1;
      stats.winStreak = 0;
      break;
  }
  
  stats.totalScore += result.playerScore;
}

function formatChifumiResult(playerChoice, botChoice, result, betResult) {
  const playerEmoji = getChoiceEmoji(playerChoice);
  const botEmoji = getChoiceEmoji(botChoice);
  const resultEmoji = getResultEmoji(result.outcome);
  
  let formatted = `🪨📄✂️ *Chifumi (Rock-Paper-Scissors)*\n\n`;
  formatted += `${playerEmoji} *You chose:* ${playerChoice}\n`;
  formatted += `${botEmoji} *Bot chose:* ${botChoice}\n`;
  formatted += `${resultEmoji} *Result:* ${result.message}\n\n`;
  
  // Add bet result if applicable
  if (betResult) {
    formatted += `💰 *Bet Results:*\n`;
    if (betResult.won === true) {
      formatted += `🎉 You won ${betResult.profit} points!\n`;
      formatted += `💵 Total: ${betResult.amount} points\n`;
    } else if (betResult.won === false) {
      formatted += `😞 You lost ${Math.abs(betResult.profit)} points\n`;
    } else {
      formatted += `🤝 Bet returned (draw)\n`;
    }
    formatted += `\n`;
  }
  
  formatted += `📊 *Game Rules:*\n`;
  formatted += `• Rock beats Scissors\n`;
  formatted += `• Paper beats Rock\n`;
  formatted += `• Scissors beats Paper\n\n`;
  
  formatted += `🎮 *Play again with:* !chifumi <rock/paper/scissors>`;
  
  return formatted;
}

function getChoiceEmoji(choice) {
  const emojis = {
    'rock': '🪨',
    'paper': '📄',
    'scissors': '✂️'
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
chifumiFunction.getStats = function(userId) {
  const stats = userStats.get(userId);
  if (!stats) {
    return {
      success: false,
      error: 'No games played yet'
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
    formatted: formatStats(stats, userId, winRate, avgScore)
  };
};

function formatStats(stats, userId, winRate, avgScore) {
  let formatted = `📊 *Chifumi Statistics*\n\n`;
  formatted += `👤 *Player:* ${userId.substring(0, 12)}...\n\n`;
  
  formatted += `🎮 *Games Played:* ${stats.gamesPlayed}\n`;
  formatted += `✅ *Wins:* ${stats.wins}\n`;
  formatted += `❌ *Losses:* ${stats.losses}\n`;
  formatted += `🤝 *Draws:* ${stats.draws}\n`;
  formatted += `📈 *Win Rate:* ${winRate}%\n`;
  formatted += `⭐ *Average Score:* ${avgScore}\n`;
  formatted += `🔥 *Current Win Streak:* ${stats.winStreak}\n`;
  formatted += `🏆 *Max Win Streak:* ${stats.maxWinStreak}\n\n`;
  
  formatted += `💡 *Tips:*\n`;
  formatted += `• Humans tend to throw rock first\n`;
  formatted += `• Paper is statistically least thrown\n`;
  formatted += `• After a loss, players often switch\n`;
  
  return formatted;
}

chifumiFunction.leaderboard = function(limit = 10) {
  const players = Array.from(userStats.entries())
    .map(([userId, stats]) => ({
      userId,
      ...stats,
      winRate: stats.gamesPlayed > 0 ? (stats.wins / stats.gamesPlayed) : 0
    }))
    .sort((a, b) => {
      // Sort by win rate, then by total wins, then by games played
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.gamesPlayed - a.gamesPlayed;
    })
    .slice(0, limit);
  
  return {
    success: true,
    leaderboard: players,
    formatted: formatLeaderboard(players)
  };
};

function formatLeaderboard(players) {
  let formatted = `🏆 *Chifumi Leaderboard*\n\n`;
  
  if (players.length === 0) {
    formatted += `No games played yet. Be the first!\n`;
    return formatted;
  }
  
  players.forEach((player, index) => {
    const medal = index === 0 ? '🥇' :
                  index === 1 ? '🥈' :
                  index === 2 ? '🥉' : `${index + 1}.`;
    
    const winRate = (player.winRate * 100).toFixed(1);
    
    formatted += `${medge} *${player.userId.substring(0, 8)}...*\n`;
    formatted += `   📊 ${player.gamesPlayed} games | ✅ ${player.wins} wins\n`;
    formatted += `   📈 ${winRate}% win rate | 🔥 ${player.winStreak} streak\n\n`;
  });
  
  formatted += `🎮 *Play to climb the ranks!*`;
  
  return formatted;
}

module.exports = chifumiFunction;
