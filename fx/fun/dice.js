// fx/fun/dice.js
// Dice rolling with various options

async function diceFunction(request) {
  try {
    const { 
      dice = '1d6', 
      modifier = 0, 
      rolls = 1,
      userId,
      bet = 0,
      target = null 
    } = request.data;
    
    // Parse dice notation (e.g., "2d20+5", "d6", "3d10-2")
    const diceNotation = parseDiceNotation(dice, modifier);
    
    if (!diceNotation) {
      return {
        success: false,
        error: {
          code: 'INVALID_DICE_NOTATION',
          message: 'Invalid dice notation. Use format like: 2d20+5, d6, 3d10-2'
        }
      };
    }

    // Validate number of rolls
    const totalRolls = Math.min(Math.max(parseInt(rolls) || 1, 1), 100);
    
    // Roll the dice
    const rollResults = [];
    let totalSum = 0;
    let naturalCriticals = 0;
    let naturalFumbles = 0;
    
    for (let i = 0; i < totalRolls; i++) {
      const roll = rollDiceSet(diceNotation);
      rollResults.push(roll);
      totalSum += roll.total;
      
      // Check for natural extremes (1 or max on a die)
      if (roll.individualResults.some(r => r.result === 1)) {
        naturalFumbles++;
      }
      if (roll.individualResults.some(r => r.result === r.sides)) {
        naturalCriticals++;
      }
    }
    
    // Calculate average
    const average = totalSum / totalRolls;
    
    // Check if bet target was met
    let betResult = null;
    if (bet > 0 && target !== null) {
      betResult = evaluateBet(totalSum, target, bet, totalRolls);
    }
    
    // Update user stats if userId provided
    if (userId) {
      updateDiceStats(userId, diceNotation, rollResults, totalSum);
    }

    return {
      success: true,
      result: {
        diceNotation: diceNotation.notation,
        rolls: totalRolls,
        results: rollResults,
        total: totalSum,
        average: average,
        naturalCriticals: naturalCriticals,
        naturalFumbles: naturalFumbles,
        betResult: betResult,
        formatted: formatDiceResult(
          diceNotation.notation,
          totalRolls,
          rollResults,
          totalSum,
          average,
          naturalCriticals,
          naturalFumbles,
          betResult
        )
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'DICE_FAILED',
        message: error.message || 'Failed to roll dice'
      }
    };
  }
}

function parseDiceNotation(notation, modifier) {
  // Parse dice notation: XdY+Z or XdY-Z
  const regex = /^(\d+)?d(\d+)([+-]\d+)?$/i;
  const match = notation.toLowerCase().match(regex);
  
  if (!match) {
    // Try simple dY format
    const simpleMatch = notation.toLowerCase().match(/^d(\d+)$/);
    if (simpleMatch) {
      return {
        count: 1,
        sides: parseInt(simpleMatch[1]),
        modifier: parseInt(modifier) || 0,
        notation: `1d${simpleMatch[1]}${modifier >= 0 ? '+' + modifier : modifier}`
      };
    }
    return null;
  }
  
  const count = match[1] ? parseInt(match[1]) : 1;
  const sides = parseInt(match[2]);
  const explicitModifier = match[3] ? parseInt(match[3]) : 0;
  const totalModifier = explicitModifier + (parseInt(modifier) || 0);
  
  // Validate
  if (count < 1 || count > 100) return null;
  if (sides < 2 || sides > 1000) return null;
  
  return {
    count: count,
    sides: sides,
    modifier: totalModifier,
    notation: `${count}d${sides}${totalModifier >= 0 ? '+' + totalModifier : totalModifier}`
  };
}

function rollDiceSet(diceNotation) {
  const individualResults = [];
  let diceTotal = 0;
  
  // Roll each die
  for (let i = 0; i < diceNotation.count; i++) {
    const roll = Math.floor(Math.random() * diceNotation.sides) + 1;
    individualResults.push({
      die: `${i + 1}d${diceNotation.sides}`,
      result: roll,
      sides: diceNotation.sides,
      isCrit: roll === diceNotation.sides,
      isFumble: roll === 1
    });
    diceTotal += roll;
  }
  
  // Add modifier
  const total = diceTotal + diceNotation.modifier;
  
  return {
    individualResults: individualResults,
    diceTotal: diceTotal,
    modifier: diceNotation.modifier,
    total: total,
    hasCrit: individualResults.some(r => r.isCrit),
    hasFumble: individualResults.some(r => r.isFumble)
  };
}

function evaluateBet(total, target, betAmount, rolls) {
  if (rolls > 1) {
    // For multiple rolls, average must meet target
    const average = total / rolls;
    if (average >= target) {
      return {
        won: true,
        amount: betAmount * 2,
        profit: betAmount,
        average: average,
        target: target
      };
    } else {
      return {
        won: false,
        amount: 0,
        profit: -betAmount,
        average: average,
        target: target
      };
    }
  } else {
    // Single roll
    if (total >= target) {
      return {
        won: true,
        amount: betAmount * 2,
        profit: betAmount,
        total: total,
        target: target
      };
    } else {
      return {
        won: false,
        amount: 0,
        profit: -betAmount,
        total: total,
        target: target
      };
    }
  }
}

// User statistics storage
const diceStats = new Map();

function updateDiceStats(userId, diceNotation, rollResults, totalSum) {
  if (!diceStats.has(userId)) {
    diceStats.set(userId, {
      totalRolls: 0,
      totalDiceRolled: 0,
      totalSum: 0,
      highestRoll: -Infinity,
      lowestRoll: Infinity,
      naturalCriticals: 0,
      naturalFumbles: 0,
      diceTypes: new Map()
    });
  }
  
  const stats = diceStats.get(userId);
  const rollsCount = rollResults.length;
  
  stats.totalRolls += rollsCount;
  stats.totalDiceRolled += diceNotation.count * rollsCount;
  stats.totalSum += totalSum;
  
  // Update highest/lowest
  const thisRollTotal = totalSum / rollsCount; // average for multiple rolls
  if (thisRollTotal > stats.highestRoll) {
    stats.highestRoll = thisRollTotal;
  }
  if (thisRollTotal < stats.lowestRoll) {
    stats.lowestRoll = thisRollTotal;
  }
  
  // Count criticals and fumbles
  rollResults.forEach(roll => {
    if (roll.hasCrit) stats.naturalCriticals++;
    if (roll.hasFumble) stats.naturalFumbles++;
  });
  
  // Track dice types
  const diceType = `${diceNotation.count}d${diceNotation.sides}`;
  if (!stats.diceTypes.has(diceType)) {
    stats.diceTypes.set(diceType, {
      rolls: 0,
      total: 0,
      average: 0
    });
  }
  
  const typeStats = stats.diceTypes.get(diceType);
  typeStats.rolls += rollsCount;
  typeStats.total += totalSum;
  typeStats.average = typeStats.total / typeStats.rolls;
}

function formatDiceResult(notation, rolls, results, total, average, criticals, fumbles, betResult) {
  const isSingleRoll = rolls === 1;
  const rollResult = isSingleRoll ? results[0] : null;
  
  let formatted = `🎲 *Dice Roll Results*\n\n`;
  formatted += `📝 *Notation:* ${notation}\n`;
  formatted += `🔄 *Rolls:* ${rolls} time${rolls !== 1 ? 's' : ''}\n\n`;
  
  if (isSingleRoll && rollResult) {
    // Show individual dice for single roll
    formatted += `🎯 *Individual Dice:*\n`;
    rollResult.individualResults.forEach((die, index) => {
      const critEmoji = die.isCrit ? '✨' : die.isFumble ? '💀' : '';
      formatted += `   ${die.die}: ${die.result} ${critEmoji}\n`;
    });
    
    if (rollResult.modifier !== 0) {
      formatted += `   Modifier: ${rollResult.modifier >= 0 ? '+' : ''}${rollResult.modifier}\n`;
    }
    
    formatted += `\n🎯 *Total:* ${rollResult.total}\n`;
  } else {
    // Summary for multiple rolls
    formatted += `📊 *Roll Summary:*\n`;
    formatted += `   Sum of all rolls: ${total}\n`;
    formatted += `   Average per roll: ${average.toFixed(2)}\n`;
    
    // Show first few individual totals
    const showCount = Math.min(results.length, 5);
    formatted += `\n🎯 *Individual Totals (first ${showCount}):*\n`;
    for (let i = 0; i < showCount; i++) {
      formatted += `   Roll ${i + 1}: ${results[i].total}\n`;
    }
    
    if (results.length > showCount) {
      formatted += `   ...and ${results.length - showCount} more\n`;
    }
  }
  
  // Critical and fumble stats
  if (criticals > 0 || fumbles > 0) {
    formatted += `\n⚡ *Special Results:*\n`;
    if (criticals > 0) formatted += `   ✨ Natural Crits: ${criticals}\n`;
    if (fumbles > 0) formatted += `   💀 Natural Fumbles: ${fumbles}\n`;
  }
  
  // Bet results
  if (betResult) {
    formatted += `\n💰 *Bet Results:*\n`;
    if (betResult.won) {
      formatted += `   🎉 You won ${betResult.profit} points!\n`;
      formatted += `   💵 Total: ${betResult.amount} points\n`;
    } else {
      formatted += `   😞 You lost ${Math.abs(betResult.profit)} points\n`;
    }
    
    if (betResult.average !== undefined) {
      formatted += `   📊 Average: ${betResult.average.toFixed(2)} vs Target: ${betResult.target}\n`;
    } else {
      formatted += `   🎯 Roll: ${betResult.total} vs Target: ${betResult.target}\n`;
    }
  }
  
  formatted += `\n🎮 *Roll again:* !dice <notation> rolls:<number>`;
  
  return formatted;
}

// Statistics functions
diceFunction.getStats = function(userId) {
  const stats = diceStats.get(userId);
  
  if (!stats || stats.totalRolls === 0) {
    return {
      success: false,
      error: 'No dice rolled yet'
    };
  }
  
  const averageRoll = stats.totalSum / stats.totalRolls;
  const critRate = (stats.naturalCriticals / stats.totalDiceRolled * 100).toFixed(2);
  const fumbleRate = (stats.naturalFumbles / stats.totalDiceRolled * 100).toFixed(2);
  
  return {
    success: true,
    stats: {
      ...stats,
      averageRoll: averageRoll.toFixed(2),
      critRate: critRate + '%',
      fumbleRate: fumbleRate + '%',
      diceTypes: Array.from(stats.diceTypes.entries())
    },
    formatted: formatDiceStats(stats, userId, averageRoll, critRate, fumbleRate)
  };
};

function formatDiceStats(stats, userId, averageRoll, critRate, fumbleRate) {
  let formatted = `📊 *Dice Rolling Statistics*\n\n`;
  formatted += `👤 *Player:* ${userId.substring(0, 12)}...\n\n`;
  
  formatted += `🎲 *Total Rolls:* ${stats.totalRolls}\n`;
  formatted += `🎯 *Total Dice Rolled:* ${stats.totalDiceRolled}\n`;
  formatted += `📈 *Total Sum:* ${stats.totalSum}\n`;
  formatted += `⭐ *Average Roll:* ${averageRoll.toFixed(2)}\n`;
  formatted += `🏆 *Highest Roll:* ${stats.highestRoll.toFixed(2)}\n`;
  formatted += `📉 *Lowest Roll:* ${stats.lowestRoll.toFixed(2)}\n\n`;
  
  formatted += `✨ *Natural Criticals:* ${stats.naturalCriticals} (${critRate}%)\n`;
  formatted += `💀 *Natural Fumbles:* ${stats.naturalFumbles} (${fumbleRate}%)\n\n`;
  
  if (stats.diceTypes.size > 0) {
    formatted += `🎯 *Dice Type Favorites:*\n`;
    
    // Sort by number of rolls
    const sortedTypes = Array.from(stats.diceTypes.entries())
      .sort((a, b) => b[1].rolls - a[1].rolls)
      .slice(0, 5);
    
    sortedTypes.forEach(([diceType, typeStats]) => {
      formatted += `   ${diceType}: ${typeStats.rolls} rolls, avg: ${typeStats.average.toFixed(2)}\n`;
    });
  }
  
  formatted += `\n🎮 *Common dice notations:*\n`;
  formatted += `• !dice d20 (standard D&D)\n`;
  formatted += `• !dice 2d6+3 (with modifier)\n`;
  formatted += `• !dice 4d10 rolls:5 (multiple rolls)\n`;
  formatted += `• !dice d100 bet:100 target:50 (with bet)`;
  
  return formatted;
}

diceFunction.rollTable = function(tableName) {
  const tables = {
    'loot': [
      { range: '1-10', result: 'Common item' },
      { range: '11-15', result: 'Uncommon item' },
      { range: '16-18', result: 'Rare item' },
      { range: '19-19', result: 'Very rare item' },
      { range: '20-20', result: 'Legendary item' }
    ],
    'encounter': [
      { range: '1-5', result: 'Easy encounter' },
      { range: '6-15', result: 'Medium encounter' },
      { range: '16-19', result: 'Hard encounter' },
      { range: '20-20', result: 'Deadly encounter' }
    ],
    'weather': [
      { range: '1-5', result: 'Clear skies' },
      { range: '6-10', result: 'Partly cloudy' },
      { range: '11-15', result: 'Cloudy' },
      { range: '16-18', result: 'Rain' },
      { range: '19-19', result: 'Storm' },
      { range: '20-20', result: 'Extreme weather' }
    ],
    'mood': [
      { range: '1-4', result: 'Very sad' },
      { range: '5-8', result: 'Sad' },
      { range: '9-12', result: 'Neutral' },
      { range: '13-16', result: 'Happy' },
      { range: '17-20', result: 'Very happy' }
    ]
  };
  
  const table = tables[tableName.toLowerCase()];
  
  if (!table) {
    return {
      success: false,
      error: `Table "${tableName}" not found. Available: ${Object.keys(tables).join(', ')}`
    };
  }
  
  const roll = Math.floor(Math.random() * 20) + 1;
  let result = '';
  
  for (const entry of table) {
    const [min, max] = entry.range.split('-').map(Number);
    if (roll >= min && roll <= max) {
      result = entry.result;
      break;
    }
  }
  
  return {
    success: true,
    result: {
      table: tableName,
      roll: roll,
      result: result
    },
    formatted: `🎲 *Table Roll: ${tableName.toUpperCase()}*\n\nRoll: ${roll}\nResult: ${result}\n\nUse: !dice table:<name>`
  };
};

module.exports = diceFunction;
