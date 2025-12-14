// fx/general/say.js
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

async function sayFunction(request) {
  try {
    const { text, voice = 'Adam', stability = 0.75, similarity_boost = 0.75, speed = 1.0 } = request.data;
    
    if (!text || text.trim().length === 0) {
      return {
        success: false,
        error: {
          code: 'MISSING_TEXT',
          message: 'Text is required for speech generation'
        }
      };
    }

    // Validate text length
    const cleanText = text.trim();
    if (cleanText.length > 5000) {
      return {
        success: false,
        error: {
          code: 'TEXT_TOO_LONG',
          message: 'Text must be less than 5000 characters'
        }
      };
    }

    // Generate speech using ElevenLabs API
    const audioData = await generateSpeech(cleanText, voice, {
      stability,
      similarity_boost,
      speed
    });

    // Generate unique ID for the audio
    const audioId = uuidv4();
    const filename = `speech_${audioId}.mp3`;
    
    // In production, you might want to save to disk or cloud storage
    // For now, we'll return the buffer directly for small files
    
    if (audioData.buffer.length > 10 * 1024 * 1024) { // 10MB limit
      return {
        success: false,
        error: {
          code: 'AUDIO_TOO_LARGE',
          message: 'Generated audio is too large'
        }
      };
    }

    // Create temporary access token
    const accessToken = uuidv4();
    const tempStorage = {
      buffer: audioData.buffer,
      contentType: 'audio/mpeg',
      text: cleanText,
      voice: voice,
      generatedAt: new Date().toISOString(),
      expiresAt: Date.now() + 3600000 // 1 hour
    };

    // Store in temporary storage (in production, use Redis or similar)
    sayFunction.tempStorage = sayFunction.tempStorage || new Map();
    sayFunction.tempStorage.set(accessToken, tempStorage);

    return {
      success: true,
      result: {
        audioId: audioId,
        accessToken: accessToken,
        downloadUrl: `/audio/${accessToken}`,
        filename: filename,
        text: cleanText,
        voice: voice,
        duration: audioData.duration || 'unknown',
        size: audioData.buffer.length,
        formatted: formatSuccessMessage(cleanText, voice, audioData.duration)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'SPEECH_GENERATION_FAILED',
        message: error.message || 'Failed to generate speech'
      }
    };
  }
}

async function generateSpeech(text, voice, settings) {
  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not configured');
  }

  // Get voice ID for the selected voice
  const voiceId = await getVoiceId(voice);
  
  // Generate speech
  const response = await axios({
    method: 'POST',
    url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg'
    },
    data: {
      text: text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: settings.stability,
        similarity_boost: settings.similarity_boost
      }
    },
    responseType: 'arraybuffer',
    timeout: 60000 // 1 minute timeout
  });

  // Estimate duration (rough estimate: 150 words per minute)
  const wordCount = text.split(/\s+/).length;
  const duration = Math.ceil((wordCount / 150) * 60); // in seconds

  return {
    buffer: Buffer.from(response.data),
    duration: duration,
    voice: voice
  };
}

async function getVoiceId(voiceName) {
  // Map voice names to ElevenLabs voice IDs
  const voiceMap = {
    'Adam': 'pNInz6obpgDQGcFmaJgB', // Adam voice ID
    'Bella': 'EXAVITQu4vr4xnSDxMaL',
    'Antoni': 'ErXwobaYiN019PkySvjV',
    'Arnold': 'VR6AewLTigWG4xSOukaG',
    'Domi': 'AZnzlk1XvdvUeBnXmlld',
    'Elli': 'MF3mGyEYCl7XYWbV9V6O',
    'Josh': 'TxGEqnHWrfWFTfGW9XjX',
    'Rachel': '21m00Tcm4TlvDq8ikWAM',
    'Sam': 'yoZ06aMxZJJ28mfd3POQ'
  };

  const voiceId = voiceMap[voiceName] || voiceMap.Adam;
  
  // Verify the voice exists
  try {
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    await axios.get(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      headers: { 'xi-api-key': ELEVENLABS_API_KEY }
    });
    return voiceId;
  } catch (error) {
    console.log(`Voice ${voiceName} not found, using Adam`);
    return voiceMap.Adam;
  }
}

function formatSuccessMessage(text, voice, duration) {
  const preview = text.length > 100 ? text.substring(0, 100) + '...' : text;
  
  return `🎤 *Speech Generated Successfully!*\n\n` +
         `📝 *Text:* ${preview}\n` +
         `🗣️ *Voice:* ${voice}\n` +
         `⏱️ *Duration:* ${duration || 'unknown'} seconds\n\n` +
         `_Use the download URL to get the audio file_`;
}

// For serving audio files
sayFunction.getAudio = function(token) {
  if (!sayFunction.tempStorage) return null;
  const audio = sayFunction.tempStorage.get(token);
  
  if (!audio || audio.expiresAt < Date.now()) {
    sayFunction.tempStorage.delete(token);
    return null;
  }
  
  return audio;
};

// Cleanup expired audio files every hour
setInterval(() => {
  if (sayFunction.tempStorage) {
    const now = Date.now();
    for (const [token, audio] of sayFunction.tempStorage.entries()) {
      if (audio.expiresAt < now) {
        sayFunction.tempStorage.delete(token);
      }
    }
  }
}, 3600000);

module.exports = sayFunction;
