// fx/download/mp3.js
const axios = require('axios');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

// Configure ffmpeg paths
if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

async function mp3Function(request) {
  try {
    const { url, bitrate = '192k', start = null, duration = null, metadata = {} } = request.data;
    
    if (!url) {
      return {
        success: false,
        error: {
          code: 'MISSING_URL',
          message: 'Audio URL is required'
        }
      };
    }

    // Download audio/video
    const mediaData = await downloadMedia(url);
    
    // Convert to MP3
    const mp3Data = await convertToMp3(mediaData.buffer, {
      bitrate,
      start,
      duration,
      metadata
    });
    
    // Generate download info
    const audioId = uuidv4();
    const filename = `audio_${audioId}.mp3`;
    
    return {
      success: true,
      result: {
        audioId: audioId,
        filename: filename,
        originalFormat: mediaData.format,
        mp3Size: mp3Data.buffer.length,
        bitrate: bitrate,
        duration: mp3Data.duration,
        sampleRate: mp3Data.sampleRate,
        channels: mp3Data.channels,
        downloadUrl: `/audio/${audioId}`,
        formatted: formatMp3Response(
          mp3Data.duration,
          mp3Data.buffer.length,
          bitrate,
          mp3Data.sampleRate,
          mp3Data.channels
        )
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'MP3_CONVERSION_FAILED',
        message: error.message || 'Failed to convert to MP3'
      }
    };
  }
}

async function downloadMedia(url) {
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'arraybuffer',
    timeout: 60000, // 1 minute for audio/video
    maxContentLength: 100 * 1024 * 1024, // 100MB limit
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'audio/*,video/*'
    }
  });
  
  const buffer = Buffer.from(response.data);
  
  // Detect format using ffprobe
  const format = await detectAudioFormat(buffer);
  
  return {
    buffer: buffer,
    size: buffer.length,
    format: format
  };
}

async function detectAudioFormat(buffer) {
  return new Promise((resolve, reject) => {
    // Write buffer to temp file for ffprobe
    const tempFile = `/tmp/audio_${Date.now()}.tmp`;
    
    fs.writeFile(tempFile, buffer)
      .then(() => {
        ffmpeg.ffprobe(tempFile, (err, metadata) => {
          fs.unlink(tempFile).catch(() => {}); // Clean up
          
          if (err) {
            // Fallback detection
            const hex = buffer.toString('hex', 0, 4);
            if (hex.startsWith('494433')) return resolve('mp3');
            if (hex.startsWith('fffb') || hex.startsWith('fff3')) return resolve('mp3');
            if (hex.startsWith('4f676753')) return resolve('ogg');
            if (hex.startsWith('52494646')) return resolve('wav');
            return resolve('unknown');
          }
          
          resolve(metadata.format.format_name || 'unknown');
        });
      })
      .catch(reject);
  });
}

async function convertToMp3(buffer, options) {
  return new Promise((resolve, reject) => {
    const inputFile = `/tmp/input_${Date.now()}.tmp`;
    const outputFile = `/tmp/output_${Date.now()}.mp3`;
    
    // Write input buffer to temp file
    fs.writeFile(inputFile, buffer)
      .then(() => {
        const command = ffmpeg(inputFile)
          .audioCodec('libmp3lame')
          .audioBitrate(options.bitrate)
          .audioChannels(2) // Stereo
          .audioFrequency(44100) // 44.1kHz
          .format('mp3');
        
        // Apply trim if specified
        if (options.start) {
          command.seekInput(options.start);
        }
        if (options.duration) {
          command.duration(options.duration);
        }
        
        // Add metadata if provided
        if (options.metadata.title) {
          command.outputOptions('-metadata', `title=${options.metadata.title}`);
        }
        if (options.metadata.artist) {
          command.outputOptions('-metadata', `artist=${options.metadata.artist}`);
        }
        if (options.metadata.album) {
          command.outputOptions('-metadata', `album=${options.metadata.album}`);
        }
        
        command
          .on('end', async () => {
            try {
              // Read output file
              const outputBuffer = await fs.readFile(outputFile);
              
              // Get audio info
              const audioInfo = await getAudioInfo(outputFile);
              
              // Cleanup temp files
              await Promise.all([
                fs.unlink(inputFile).catch(() => {}),
                fs.unlink(outputFile).catch(() => {})
              ]);
              
              resolve({
                buffer: outputBuffer,
                duration: audioInfo.duration,
                sampleRate: audioInfo.sampleRate,
                channels: audioInfo.channels,
                bitrate: audioInfo.bitrate
              });
            } catch (error) {
              reject(error);
            }
          })
          .on('error', (err) => {
            // Cleanup on error
            Promise.all([
              fs.unlink(inputFile).catch(() => {}),
              fs.unlink(outputFile).catch(() => {})
            ]).finally(() => reject(err));
          })
          .save(outputFile);
      })
      .catch(reject);
  });
}

async function getAudioInfo(filepath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filepath, (err, metadata) => {
      if (err) return reject(err);
      
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
      if (!audioStream) return reject(new Error('No audio stream found'));
      
      resolve({
        duration: parseFloat(metadata.format.duration) || 0,
        sampleRate: audioStream.sample_rate || 44100,
        channels: audioStream.channels || 2,
        bitrate: parseInt(metadata.format.bit_rate) / 1000 || 192 // kbps
      });
    });
  });
}

function formatMp3Response(duration, size, bitrate, sampleRate, channels) {
  const durationFormatted = formatDuration(duration);
  const sizeFormatted = formatBytes(size);
  
  let formatted = `🎵 *MP3 Conversion Complete!*\n\n`;
  formatted += `⏱️ *Duration:* ${durationFormatted}\n`;
  formatted += `📊 *Size:* ${sizeFormatted}\n`;
  formatted += `⚡ *Bitrate:* ${bitrate}\n`;
  formatted += `🎚️ *Sample Rate:* ${sampleRate} Hz\n`;
  formatted += `🔊 *Channels:* ${channels} (${channels === 2 ? 'Stereo' : 'Mono'})\n\n`;
  
  formatted += `✅ *Features:*\n`;
  formatted += `• High quality MP3 encoding\n`;
  formatted += `• Bitrate optimization\n`;
  formatted += `• Stereo sound\n`;
  formatted += `• ID3 tag support\n`;
  
  if (duration > 300) { // > 5 minutes
    formatted += `\n⚠️ *Long audio file*\n`;
    formatted += `Consider splitting for easier sharing\n`;
  }
  
  formatted += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  formatted += `⚡ Ready for download`;
  
  return formatted;
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Additional audio utilities
mp3Function.extractAudio = async function(buffer, start, duration) {
  return new Promise((resolve, reject) => {
    const inputFile = `/tmp/extract_input_${Date.now()}.tmp`;
    const outputFile = `/tmp/extract_output_${Date.now()}.mp3`;
    
    fs.writeFile(inputFile, buffer)
      .then(() => {
        ffmpeg(inputFile)
          .setStartTime(start)
          .setDuration(duration)
          .audioCodec('libmp3lame')
          .audioBitrate('192k')
          .format('mp3')
          .on('end', async () => {
            try {
              const outputBuffer = await fs.readFile(outputFile);
              await Promise.all([
                fs.unlink(inputFile).catch(() => {}),
                fs.unlink(outputFile).catch(() => {})
              ]);
              resolve(outputBuffer);
            } catch (error) {
              reject(error);
            }
          })
          .on('error', (err) => {
            Promise.all([
              fs.unlink(inputFile).catch(() => {}),
              fs.unlink(outputFile).catch(() => {})
            ]).finally(() => reject(err));
          })
          .save(outputFile);
      })
      .catch(reject);
  });
};

module.exports = mp3Function;
