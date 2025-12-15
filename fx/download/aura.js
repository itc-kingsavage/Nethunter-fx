// fx/download/aura.js
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

async function auraFunction(request) {
  try {
    const { song, auraType = 'ambient', duration = '30s', intensity = 'medium' } = request.data;
    
    if (!song) {
      return {
        success: false,
        error: {
          code: 'MISSING_SONG',
          message: 'Song name or URL is required'
        }
      };
    }

    // Check if input is a URL
    let auraData;
    if (isUrl(song)) {
      auraData = await createAuraFromUrl(song, auraType, duration, intensity);
    } else {
      auraData = await createAuraFromSong(song, auraType, duration, intensity);
    }
    
    return {
      success: true,
      result: {
        auraId: auraData.auraId,
        song: song,
        auraType: auraType,
        duration: auraData.duration,
        intensity: intensity,
        downloadUrl: auraData.downloadUrl,
        previewUrl: auraData.previewUrl,
        formatted: formatAuraResponse(song, auraType, auraData.duration, intensity)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'AURA_FAILED',
        message: error.message || 'Failed to create aura'
      }
    };
  }
}

function isUrl(string) {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

async function createAuraFromUrl(url, auraType, duration, intensity) {
  // Download audio from URL
  const audioData = await downloadAudio(url);
  
  // Apply aura effects
  const auraBuffer = await applyAuraEffects(audioData.buffer, auraType, duration, intensity);
  
  const auraId = uuidv4();
  
  return {
    auraId: auraId,
    duration: parseDuration(duration),
    downloadUrl: `/aura/${auraId}.mp3`,
    previewUrl: `/aura/preview/${auraId}.mp3`,
    size: auraBuffer.length
  };
}

async function createAuraFromSong(songName, auraType, duration, intensity) {
  // Search for song
  const songInfo = await searchSong(songName);
  
  if (!songInfo) {
    throw new Error(`Song "${songName}" not found`);
  }
  
  // Download song
  const audioData = await downloadAudio(songInfo.url);
  
  // Apply aura effects
  const auraBuffer = await applyAuraEffects(audioData.buffer, auraType, duration, intensity);
  
  const auraId = uuidv4();
  
  return {
    auraId: auraId,
    duration: parseDuration(duration),
    downloadUrl: `/aura/${auraId}.mp3`,
    previewUrl: `/aura/preview/${auraId}.mp3`,
    size: auraBuffer.length,
    songInfo: songInfo
  };
}

async function downloadAudio(url) {
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'arraybuffer',
    timeout: 30000,
    maxContentLength: 50 * 1024 * 1024, // 50MB
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'audio/*'
    }
  });
  
  return {
    buffer: Buffer.from(response.data),
    mimeType: response.headers['content-type'],
    size: response.data.length
  };
}

async function applyAuraEffects(audioBuffer, auraType, duration, intensity) {
  // This is a simulation of audio processing
  // In production, you would use audio processing libraries like:
  // - tone.js
  // - wavesurfer.js
  // - Web Audio API
  
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // For now, return the original buffer (simulated)
  // In real implementation, apply effects like:
  // - Reverb
  // - Echo
  // - Pitch shifting
  // - Ambient sounds
  // - Looping
  
  return audioBuffer;
}

async function searchSong(songName) {
  // Mock song search
  // In production, use Spotify API, YouTube API, etc.
  
  return {
    title: songName,
    artist: 'Various Artists',
    url: `https://example.com/audio/${encodeURIComponent(songName)}.mp3`,
    duration: 180, // 3 minutes
    thumbnail: 'https://example.com/thumbnail.jpg'
  };
}

function parseDuration(durationStr) {
  const match = durationStr.match(/(\d+)(s|m|h)/);
  if (!match) return 30; // Default 30 seconds
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    default: return 30;
  }
}

function formatAuraResponse(song, auraType, duration, intensity) {
  const durationFormatted = formatDuration(duration);
  const auraEmoji = getAuraEmoji(auraType);
  
  let formatted = `${auraEmoji} *Aura Created!*\n\n`;
  formatted += `🎵 *Song:* ${song}\n`;
  formatted += `🌀 *Aura Type:* ${auraType.charAt(0).toUpperCase() + auraType.slice(1)}\n`;
  formatted += `⏱️ *Duration:* ${durationFormatted}\n`;
  formatted += `⚡ *Intensity:* ${intensity.charAt(0).toUpperCase() + intensity.slice(1)}\n\n`;
  
  formatted += `✨ *Aura Effects Applied:*\n`;
  
  switch (auraType) {
    case 'ambient':
      formatted += `• Soothing ambient sounds\n`;
      formatted += `• Soft reverb and echo\n`;
      formatted += `• Calming frequency adjustments\n`;
      break;
    case 'energetic':
      formatted += `• Upbeat tempo enhancement\n`;
      formatted += `• Dynamic bass boost\n`;
      formatted += `• Energy amplification\n`;
      break;
    case 'meditative':
      formatted += `• Binaural beats overlay\n`;
      formatted += `• Meditation frequencies\n`;
      formatted += `• Peaceful atmosphere\n`;
      break;
    case 'focus':
      formatted += `• Concentration enhancement\n`;
      formatted += `• Background noise reduction\n`;
      formatted += `• Focus frequency tuning\n`;
      break;
    default:
      formatted += `• Custom audio processing\n`;
      formatted += `• Enhanced listening experience\n`;
      formatted += `• Mood adaptation\n`;
  }
  
  formatted += `\n✅ *Ready for download*\n`;
  formatted += `🎧 Perfect for relaxation\n`;
  formatted += `🧘 Great for meditation\n`;
  formatted += `💻 Ideal for focus work\n`;
  
  formatted += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  formatted += `⚡ Immerse yourself in the aura!`;
  
  return formatted;
}

function getAuraEmoji(auraType) {
  switch (auraType) {
    case 'ambient': return '🌀';
    case 'energetic': return '⚡';
    case 'meditative': return '🧘';
    case 'focus': return '🎯';
    default: return '✨';
  }
}

function formatDuration(seconds) {
  if (seconds < 60) {
    return `${seconds} seconds`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

// Additional aura types
auraFunction.getAuraTypes = function() {
  const auraTypes = [
    {
      id: 'ambient',
      name: 'Ambient',
      description: 'Soothing, atmospheric sounds for relaxation',
      emoji: '🌀',
      recommendedFor: ['Relaxation', 'Sleep', 'Background']
    },
    {
      id: 'energetic',
      name: 'Energetic',
      description: 'Upbeat, energizing effects for workouts',
      emoji: '⚡',
      recommendedFor: ['Workouts', 'Dancing', 'Parties']
    },
    {
      id: 'meditative',
      name: 'Meditative',
      description: 'Calming, binaural beats for meditation',
      emoji: '🧘',
      recommendedFor: ['Meditation', 'Yoga', 'Mindfulness']
    },
    {
      id: 'focus',
      name: 'Focus',
      description: 'Concentration-enhancing frequencies',
      emoji: '🎯',
      recommendedFor: ['Studying', 'Working', 'Reading']
    },
    {
      id: 'lofi',
      name: 'Lo-Fi',
      description: 'Chill, lo-fi hip hop beats',
      emoji: '🎧',
      recommendedFor: ['Studying', 'Chilling', 'Creative work']
    }
  ];
  
  return {
    success: true,
    auraTypes: auraTypes,
    formatted: formatAuraTypesList(auraTypes)
  };
};

function formatAuraTypesList(auraTypes) {
  let formatted = `🎵 *Available Aura Types*\n\n`;
  
  auraTypes.forEach(aura => {
    formatted += `${aura.emoji} *${aura.name}*\n`;
    formatted += `   ${aura.description}\n`;
    formatted += `   👉 Best for: ${aura.recommendedFor.join(', ')}\n\n`;
  });
  
  formatted += `💡 *Usage:* !aura <song> type:<auraType> duration:<time> intensity:<level>`;
  
  return formatted;
}

module.exports = auraFunction;
