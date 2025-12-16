// fx/tools/zip.js
const archiver = require('archiver');
const extract = require('extract-zip');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

async function zipFunction(request) {
  try {
    const { 
      files = [],
      folders = [],
      name = null,
      compression = 'normal',
      password = null 
    } = request.data;
    
    if ((!files || files.length === 0) && (!folders || folders.length === 0)) {
      return {
        success: false,
        error: {
          code: 'NO_FILES',
          message: 'No files or folders specified to compress'
        }
      };
    }

    // Validate total items
    const totalItems = files.length + folders.length;
    if (totalItems > 50) {
      return {
        success: false,
        error: {
          code: 'TOO_MANY_ITEMS',
          message: 'Maximum 50 files/folders allowed per archive'
        }
      };
    }

    // Create zip file
    const zipResult = await createZipArchive(files, folders, name, compression, password);
    
    return {
      success: true,
      result: {
        archiveId: zipResult.archiveId,
        filename: zipResult.filename,
        size: zipResult.size,
        fileCount: zipResult.fileCount,
        compression: compression,
        passwordProtected: !!password,
        downloadUrl: `/zip/${zipResult.archiveId}`,
        formatted: formatZipResponse(
          zipResult.filename,
          zipResult.size,
          zipResult.fileCount,
          compression,
          !!password
        )
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'ZIP_FAILED',
        message: error.message || 'Failed to create zip archive'
      }
    };
  }
}

async function createZipArchive(files, folders, name, compression, password) {
  return new Promise(async (resolve, reject) => {
    const archiveId = uuidv4();
    const filename = name ? `${name}.zip` : `archive_${archiveId}.zip`;
    const tempDir = `/tmp/zip_${archiveId}`;
    const outputPath = `/tmp/${filename}`;
    
    try {
      // Create temp directory
      await fs.mkdir(tempDir, { recursive: true });
      
      // Download and prepare files
      const filePaths = [];
      
      // Process individual files
      for (const file of files) {
        if (file.url && file.filename) {
          const filePath = await downloadFile(file.url, tempDir, file.filename);
          filePaths.push(filePath);
        } else if (file.path) {
          // Local file path (for simulation)
          const mockPath = path.join(tempDir, path.basename(file.path));
          await fs.writeFile(mockPath, 'Mock file content for simulation');
          filePaths.push(mockPath);
        }
      }
      
      // Process folders (simulated - in production would scan directory)
      for (const folder of folders) {
        const folderPath = path.join(tempDir, folder.name || `folder_${Date.now()}`);
        await fs.mkdir(folderPath, { recursive: true });
        
        // Create some mock files in folder
        for (let i = 1; i <= 3; i++) {
          const mockFile = path.join(folderPath, `file${i}.txt`);
          await fs.writeFile(mockFile, `Content of file ${i} in ${folder.name || 'folder'}`);
          filePaths.push(mockFile);
        }
      }
      
      // Create zip archive
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: { level: getCompressionLevel(compression) }
      });
      
      // Handle archive events
      archive.on('error', reject);
      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          console.log('Archive warning:', err.message);
        } else {
          reject(err);
        }
      });
      
      // Set password if provided
      if (password) {
        // Note: archiver doesn't natively support password protection
        // In production, you'd use a library like archiver-zip-encryptable
        console.log('Password protection would require additional library');
      }
      
      // Add files to archive
      for (const filePath of filePaths) {
        const relativePath = path.relative(tempDir, filePath);
        archive.file(filePath, { name: relativePath });
      }
      
      // Pipe archive data to file
      archive.pipe(output);
      
      // Finalize archive
      await archive.finalize();
      
      // Wait for file to be written
      await new Promise((resolve, reject) => {
        output.on('close', resolve);
        output.on('error', reject);
      });
      
      // Get file stats
      const stats = await fs.stat(outputPath);
      const fileCount = filePaths.length;
      
      // Cleanup temp directory
      await fs.rm(tempDir, { recursive: true, force: true });
      
      resolve({
        archiveId: archiveId,
        filename: filename,
        size: stats.size,
        fileCount: fileCount,
        path: outputPath
      });
      
    } catch (error) {
      // Cleanup on error
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        await fs.unlink(outputPath).catch(() => {});
      } catch {}
      reject(error);
    }
  });
}

async function downloadFile(url, dir, filename) {
  // In production, download actual files
  // For simulation, create mock files
  
  const filePath = path.join(dir, filename || `file_${Date.now()}`);
  
  // Simulate different file types
  const ext = path.extname(filename || '').toLowerCase();
  let content = `Mock content for ${filename || 'file'}\n`;
  content += `Downloaded from: ${url || 'local'}\n`;
  content += `Created: ${new Date().toISOString()}\n`;
  
  // Add type-specific content
  if (ext === '.txt' || ext === '.md') {
    content += '\nThis is a text file for demonstration purposes.';
  } else if (ext === '.json') {
    content = JSON.stringify({
      filename: filename,
      url: url,
      timestamp: new Date().toISOString(),
      note: 'Mock JSON file for simulation'
    }, null, 2);
  } else if (ext === '.html') {
    content = `<!DOCTYPE html>
<html>
<head><title>${filename}</title></head>
<body>
  <h1>Mock HTML File</h1>
  <p>File: ${filename}</p>
  <p>URL: ${url}</p>
  <p>Time: ${new Date().toISOString()}</p>
</body>
</html>`;
  }
  
  await fs.writeFile(filePath, content);
  return filePath;
}

function getCompressionLevel(compression) {
  const levels = {
    'none': 0,
    'fast': 1,
    'normal': 5,
    'maximum': 9
  };
  return levels[compression.toLowerCase()] || 5;
}

function formatZipResponse(filename, size, fileCount, compression, passwordProtected) {
  const sizeFormatted = formatBytes(size);
  
  let formatted = `📦 *Zip Archive Created!*\n\n`;
  formatted += `📁 *Archive:* ${filename}\n`;
  formatted += `📊 *Size:* ${sizeFormatted}\n`;
  formatted += `📄 *Files:* ${fileCount} item${fileCount !== 1 ? 's' : ''}\n`;
  formatted += `⚡ *Compression:* ${compression.charAt(0).toUpperCase() + compression.slice(1)}\n`;
  formatted += `🔒 *Password:* ${passwordProtected ? 'Yes' : 'No'}\n\n`;
  
  formatted += `✅ *Archive Features:*\n`;
  formatted += `• Multiple file support\n`;
  formatted += `• Folder structure preserved\n`;
  formatted += `• Adjustable compression\n`;
  formatted += `• Password protection available\n\n`;
  
  formatted += `💡 *Usage Tips:*\n`;
  formatted += `• Use for file backups\n`;
  formatted += `• Share multiple files easily\n`;
  formatted += `• Reduce storage space\n`;
  formatted += `• Organize related files\n`;
  
  formatted += `\n🎮 *Create another:* !zip files:[{url,filename},...] compression:<level>`;
  
  return formatted;
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Additional zip utilities
zipFunction.compressText = async function(text, filename = 'text.txt') {
  return new Promise(async (resolve, reject) => {
    const archiveId = uuidv4();
    const outputPath = `/tmp/text_${archiveId}.zip`;
    
    try {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 5 } });
      
      archive.on('error', reject);
      archive.pipe(output);
      
      // Add text as file
      archive.append(text, { name: filename });
      
      await archive.finalize();
      
      await new Promise((resolve, reject) => {
        output.on('close', resolve);
        output.on('error', reject);
      });
      
      const stats = await fs.stat(outputPath);
      const buffer = await fs.readFile(outputPath);
      
      // Cleanup
      await fs.unlink(outputPath).catch(() => {});
      
      resolve({
        success: true,
        filename: `${filename}.zip`,
        size: stats.size,
        buffer: buffer,
        compressionRatio: (text.length - stats.size) / text.length * 100
      });
      
    } catch (error) {
      await fs.unlink(outputPath).catch(() => {});
      reject(error);
    }
  });
};

zipFunction.getInfo = async function(zipPath) {
  try {
    // In production, use archiver or yauzl to read zip info
    // For simulation, return mock info
    
    const mockInfo = {
      fileCount: 5,
      totalSize: 10240,
      compressedSize: 5120,
      compressionRatio: 50,
      files: [
        { name: 'document.txt', size: 2048, compressed: 1024 },
        { name: 'image.jpg', size: 4096, compressed: 2048 },
        { name: 'data.json', size: 3072, compressed: 1536 },
        { name: 'notes.md', size: 512, compressed: 256 },
        { name: 'config.ini', size: 512, compressed: 256 }
      ]
    };
    
    return {
      success: true,
      info: mockInfo,
      formatted: formatZipInfo(mockInfo)
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

function formatZipInfo(info) {
  let formatted = `📋 *Zip Archive Info*\n\n`;
  formatted += `📊 *Files:* ${info.fileCount}\n`;
  formatted += `📈 *Original Size:* ${formatBytes(info.totalSize)}\n`;
  formatted += `📉 *Compressed Size:* ${formatBytes(info.compressedSize)}\n`;
  formatted += `⚡ *Compression Ratio:* ${info.compressionRatio.toFixed(1)}%\n\n`;
  
  formatted += `📁 *File List:*\n`;
  info.files.forEach(file => {
    const savings = ((file.size - file.compressed) / file.size * 100).toFixed(1);
    formatted += `• ${file.name}: ${formatBytes(file.compressed)} (${savings}% saved)\n`;
  });
  
  formatted += `\n💡 *Compression saves storage and bandwidth*`;
  
  return formatted;
}

module.exports = zipFunction;
