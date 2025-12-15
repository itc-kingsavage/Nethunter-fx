// fx/download/mp4.js
const axios = require('axios');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

// Configure ffmpeg paths
if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

async function mp4Function(request) {
  try {
    const { 
      url, 
      quality = 'medium', 
      resolution = null, 
      fps = 30,
      start = null,
      duration = null,
      compress = true 
    } = request.data;
    
    if (!url) {
      return {
        success: false,
        error: {
          code: 'MISSING_URL',
          message: 'Video URL is required'
        }
      };
    }

    // Download video
    const videoData = await downloadVideo(url);
    
    // Convert/compress to MP4
    const mp4Data = await convertToMp4(videoData.buffer, {
      quality,
      resolution,
      fps,
      start,
      duration,
      compress
    });
    
    // Generate download info
    const videoId = uuidv4();
    const filename = `video_${videoId}.mp4`;
    
    return {
      success: true,
      result: {
        videoId: videoId,
        filename: filename,
        originalFormat: videoData.format,
        originalSize: videoData.size,
        mp4Size: mp4Data.buffer.length,
        resolution: mp4Data.resolution,
        duration: mp4Data.duration,
        fps: mp4Data.fps,
        bitrate: mp4Data.bitrate,
        downloadUrl: `/video/${videoId}`,
        formatted: formatMp4Response(
          mp4Data.duration,
          videoData.size,
          mp4Data.buffer.length,
          mp4Data.resolution,
          mp4Data.fps,
          mp4Data.bitrate
        )
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'MP4_CONVERSION_FAILED',
        message: error.message || 'Failed to convert to MP4'
      }
    };
  }
}

async function downloadVideo(url) {
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'arraybuffer',
    timeout: 120000, // 2 minutes for videos
    maxContentLength: 500 * 1024 * 1024, // 500MB limit
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'video/*'
    },
    onDownloadProgress: (progressEvent) => {
      const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || progressEvent.loaded));
      if (percent % 20 === 0) {
        console.log(`Video download: ${percent}%`);
      }
    }
  });
  
  const buffer = Buffer.from(response.data);
  const contentType = response.headers['content-type'] || 'video/mp4';
  
  return {
    buffer: buffer,
    size: buffer.length,
    format: contentType.split('/')[1] || 'mp4'
  };
}

async function convertToMp4(buffer, options) {
  return new Promise((resolve, reject) => {
    const inputFile = `/tmp/video_input_${Date.now()}.tmp`;
    const outputFile = `/tmp/video_output_${Date.now()}.mp4`;
    
    // Quality presets
    const qualityPresets = {
      'low': { crf: 28, audioBitrate: '64k' },
      'medium': { crf: 23, audioBitrate: '128k' },
      'high': { crf: 18, audioBitrate: '192k' },
      'veryhigh': { crf: 15, audioBitrate: '256k' }
    };
    
    const preset = qualityPresets[options.quality] || qualityPresets.medium;
    
    fs.writeFile(inputFile, buffer)
      .then(() => {
        const command = ffmpeg(inputFile)
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions([
            '-preset fast',
            `-crf ${preset.crf}`,
            '-movflags +faststart',
            '-pix_fmt yuv420p'
          ])
          .audioBitrate(preset.audioBitrate)
          .fps(options.fps)
          .format('mp4');
        
        // Apply resolution if specified
        if (options.resolution) {
          const [width, height] = options.resolution.split('x').map(Number);
          command.size(`${width}x${height}`);
        }
        
        // Apply trim if specified
        if (options.start) {
          command.seekInput(options.start);
        }
        if (options.duration) {
          command.duration(options.duration);
        }
        
        // Compression options
        if (options.compress) {
          command.outputOptions([
            '-tune fastdecode',
            '-tune zerolatency',
            '-profile:v baseline',
            '-level 3.0'
          ]);
        }
        
        command
          .on('end', async () => {
            try {
              // Read output file
              const outputBuffer = await fs.readFile(outputFile);
              
              // Get video info
              const videoInfo = await getVideoInfo(outputFile);
              
              // Cleanup temp files
              await Promise.all([
                fs.unlink(inputFile).catch(() => {}),
                fs.unlink(outputFile).catch(() => {})
              ]);
              
              resolve({
                buffer: outputBuffer,
                resolution: videoInfo.resolution,
                duration: videoInfo.duration,
                fps: videoInfo.fps,
                bitrate: videoInfo.bitrate
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
          .on('progress', (progress) => {
            if (progress.percent) {
              console.log(`Processing: ${Math.round(progress.percent)}%`);
            }
          })
          .save(outputFile);
      })
      .catch(reject);
  });
}

async function getVideoInfo(filepath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filepath, (err, metadata) => {
      if (err) return reject(err);
      
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
      
      if (!videoStream) return reject(new Error('No video stream found'));
      
      resolve({
        resolution: `${videoStream.width}x${videoStream.height}`,
        duration: parseFloat(metadata.format.duration) || 0,
        fps: eval(videoStream.r_frame_rate) || 30,
        bitrate: parseInt(metadata.format.bit_rate) / 1000 || 2000, // kbps
        codec: videoStream.codec_name,
        audioCodec: audioStream?.codec_name || 'none'
      });
    });
  });
}

function formatMp4Response(duration, originalSize, mp4Size, resolution, fps, bitrate) {
  const durationFormatted = formatDuration(duration);
  const originalSizeFormatted = formatBytes(originalSize);
  const mp4SizeFormatted = formatBytes(mp4Size);
  const compressionRatio = ((originalSize - mp4Size) / originalSize * 100).toFixed(1);
  
  let formatted = `🎬 *MP4 Video Processing Complete!*\n\n`;
  formatted += `⏱️ *Duration:* ${durationFormatted}\n`;
  formatted += `📐 *Resolution:* ${resolution}\n`;
  formatted += `🎞️ *FPS:* ${fps}\n`;
  formatted += `⚡ *Bitrate:* ${bitrate} kbps\n`;
  formatted += `📊 *Original:* ${originalSizeFormatted}\n`;
  formatted += `📈 *Processed:* ${mp4SizeFormatted}\n`;
  
  if (mp4Size < originalSize) {
    formatted += `📉 *Compressed by:* ${compressionRatio}%\n`;
  }
  
  formatted += `\n✅ *Optimizations applied:*\n`;
  formatted += `• H.264 video encoding\n`;
  formatted += `• AAC audio encoding\n`;
  formatted += `• Fast streaming enabled\n`;
  formatted += `• Mobile compatible\n`;
  
  if (duration > 60) { // > 1 minute
    formatted += `\n⚠️ *Long video*\n`;
    formatted += `Consider trimming for faster sharing\n`;
  }
  
  if (bitrate > 5000) { // > 5 Mbps
    formatted += `\n⚠️ *High bitrate*\n`;
    formatted += `May buffer on slow connections\n`;
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

// Additional video utilities
mp4Function.extractThumbnail = async function(buffer, timestamp = '00:00:01') {
  return new Promise((resolve, reject) => {
    const inputFile = `/tmp/thumbnail_input_${Date.now()}.tmp`;
    const outputFile = `/tmp/thumbnail_${Date.now()}.jpg`;
    
    fs.writeFile(inputFile, buffer)
      .then(() => {
        ffmpeg(inputFile)
          .screenshots({
            timestamps: [timestamp],
            filename: 'thumbnail.jpg',
            folder: '/tmp',
            size: '320x240'
          })
          .on('end', async () => {
            try {
              const thumbnailBuffer = await fs.readFile(outputFile);
              await Promise.all([
                fs.unlink(inputFile).catch(() => {}),
                fs.unlink(outputFile).catch(() => {})
              ]);
              resolve(thumbnailBuffer);
            } catch (error) {
              reject(error);
            }
          })
          .on('error', reject);
      })
      .catch(reject);
  });
};

module.exports = mp4Function;
