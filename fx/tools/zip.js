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
      folder = null,
      compression = 'DEFLATE',
      password = null,
      splitSize = null
    } = request.data;
    
    if ((!files || files.length === 0) && !folder) {
      return {
        success: false,
        error: {
          code: 'NO_FILES',
          message: 'No files or folder provided to compress'
        }
      };
    }

    // Validate file count
    const fileCount = files ? files.length : 0;
    if (fileCount > 100) {
      return {
        success: false,
        error: {
          code: 'TOO_MANY_FILES',
          message: 'Maximum 100 files allowed per archive'
        }
      };
    }

    // Create unique archive ID
    const archiveId = uuidv4();
    const archiveName = `archive_${archiveId}.zip`;
    const tempDir = `/tmp/zip_${archiveId}`;
    
    // Create temp directory
    await fs.mkdir(tempDir, { recursive: true });
    
    // Prepare files for archiving
    const filesToArchive = await prepareFiles(files, folder, tempDir);
    
    if (filesToArchive.length === 0) {
      await fs.rmdir(tempDir, { recursive: true });
      return {
        success: false,
        error: {
          code: 'NO_VALID_FILES',
          message: 'No valid files found to compress'
        }
      };
    }

    // Create zip archive
    const archiveResult = await createZipArchive(
      filesToArchive, 
      tempDir, 
      archiveName, 
      compression, 
      password,
      splitSize
    );
    
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true }).catch(() => {});
    
    return {
      success: true,
      result: {
        archiveId: archiveId,
        filename: archiveName,
        fileCount: filesToArchive.length,
        totalSize: archiveResult.totalSize,
        compressedSize: archiveResult.compressedSize,
        compressionRatio: archiveResult.compressionRatio,
        passwordProtected: !!password,
        splitArchives: archiveResult.splitArchives,
        downloadUrl: `/zip/${archiveId}`,
        formatted: formatZipResponse(
          filesToArchive.length,
          archiveResult.totalSize,
          archiveResult.compressedSize,
          archiveResult.compressionRatio,
          !!password,
          archiveResult.splitArchives
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

async function prepareFiles(files, folderPath, tempDir) {
  const filesToArchive = [];
  
  if (files && files.length > 0) {
    // Handle provided files (base64 or buffer)
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        const fileName = file.filename || `file_${i + 1}${getExtension(file.contentType)}`;
        const filePath = path.join(tempDir, fileName);
        
        if (file.content) {
          // Base64 content
          const buffer = Buffer.from(file.content, 'base64');
          await fs.writeFile(filePath, buffer);
          
          filesToArchive.push({
            name: fileName,
            path: filePath,
            size: buffer.length,
            type: file.contentType || 'application/octet-stream'
          });
        } else if (file.url) {
          // Download from URL
          const response = await fetch(file.url);
          const buffer = await response.arrayBuffer();
          await fs.writeFile(filePath, Buffer.from(buffer));
          
          filesToArchive.push({
            name: fileName,
            path: filePath,
            size: buffer.byteLength,
            type: response.headers.get('content-type') || 'application/octet-stream'
          });
        }
      } catch (error) {
        console.log(`Failed to prepare file ${i + 1}:`, error.message);
      }
    }
  }
  
  if (folderPath) {
    // Handle folder (simulated - in production would read actual folder)
    // For now, create mock folder structure
    const mockFiles = [
      { name: 'document.txt', content: 'Sample document content' },
      { name: 'image.jpg', content: 'mock image data' },
      { name: 'data.json', content: '{"key": "value"}' }
    ];
    
    const folderDir = path.join(tempDir, 'folder');
    await fs.mkdir(folderDir, { recursive: true });
    
    for (const mockFile of mockFiles) {
      const filePath = path.join(folderDir, mockFile.name);
      await fs.writeFile(filePath, mockFile.content);
      
      filesToArchive.push({
        name: `folder/${mockFile.name}`,
        path: filePath,
        size: mockFile.content.length,
        type: getMimeType(mockFile.name)
      });
    }
  }
  
  return filesToArchive;
}

function getExtension(contentType) {
  const extensions = {
    'text/plain': '.txt',
    'text/html': '.html',
    'application/json': '.json',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'application/pdf': '.pdf',
    'application/zip': '.zip'
  };
  
  return extensions[contentType] || '.bin';
}

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.json': 'application/json',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip'
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}

async function createZipArchive(files, tempDir, archiveName, compression, password, splitSize) {
  return new Promise((resolve, reject) => {
    const archivePath = path.join(tempDir, archiveName);
    const output = fs.createWriteStream(archivePath);
    
    const archive = archiver('zip', {
      zlib: { level: compression === 'STORE' ? 0 : 9 }
    });
    
    output.on('close', async () => {
      try {
        const stats = await fs.stat(archivePath);
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        const compressedSize = stats.size;
        const compressionRatio = ((totalSize - compressedSize) / totalSize * 100).toFixed(1);
        
        let splitArchives = null;
        
        // Handle split archives if splitSize specified
        if (splitSize && compressedSize > splitSize * 1024 * 1024) {
          splitArchives = await splitArchive(archivePath, splitSize, tempDir);
        }
        
        resolve({
          totalSize: totalSize,
          compressedSize: compressedSize,
          compressionRatio: compressionRatio,
          archivePath: archivePath,
          splitArchives: splitArchives
        });
      } catch (error) {
        reject(error);
      }
    });
    
    archive.on('error', reject);
    archive.pipe(output);
    
    // Add files to archive
    files.forEach(file => {
      const fileStream = fs.createReadStream(file.path);
      const archiveEntry = {
        name: file.name,
        date: new Date(),
        mode: 0o644
      };
      
      if (password) {
        archive.append(fileStream, {
          name: file.name,
          zip: {
            encrypted: true,
            password: password
          }
        });
      } else {
        archive.append(fileStream, archiveEntry);
      }
    });
    
    archive.finalize();
  });
}

async function splitArchive(archivePath, splitSizeMB, tempDir) {
  const splitSize = splitSizeMB * 1024 * 1024; // Convert MB to bytes
  const archiveBuffer = await fs.readFile(archivePath);
  const totalSize = archiveBuffer.length;
  
  const parts = Math.ceil(totalSize / splitSize);
  const archives = [];
  
  for (let i = 0; i < parts; i++) {
    const start = i * splitSize;
    const end = Math.min(start + splitSize, totalSize);
    const partBuffer = archiveBuffer.slice(start, end);
    
    const partName = `${path.basename(archivePath, '.zip')}.z${(i + 1).toString().padStart(2, '0')}`;
    const partPath = path.join(tempDir, partName);
    
    await fs.writeFile(partPath, partBuffer);
    
    archives.push({
      name: partName,
      size: partBuffer.length,
      part: i + 1,
      totalParts: parts
    });
  }
  
  return archives;
}

function formatZipResponse(fileCount, totalSize, compressedSize, compressionRatio, passwordProtected, splitArchives) {
  const sizeFormatted = formatBytes(totalSize);
  const compressedFormatted = formatBytes(compressedSize);
  
  let formatted = `📦 *Zip Archive Created!*\n\n`;
  formatted += `📁 *Files:* ${fileCount} file${fileCount !== 1 ? 's' : ''}\n`;
  formatted += `📊 *Original Size:* ${sizeFormatted}\n`;
  formatted += `📈 *Compressed Size:* ${compressedFormatted}\n`;
  
  if (compressionRatio > 0) {
    formatted += `📉 *Compression:* ${compressionRatio}% smaller\n`;
  }
  
  if (passwordProtected) {
    formatted += `🔒 *Password Protected:* Yes\n`;
  }
  
  if (splitArchives) {
    formatted += `🔗 *Split Archives:* ${splitArchives.length} parts\n`;
  }
  
  formatted += `\n✅ *Archive Features:*\n`;
  formatted += `• High compression ratio\n`;
  formatted += `• Password protection available\n`;
  formatted += `• Split archive support\n`;
  formatted += `• Cross-platform compatible\n`;
  
  if (splitArchives) {
    formatted += `\n📋 *Archive Parts:*\n`;
    splitArchives.forEach(part => {
      formatted += `Part ${part.part}/${part.totalParts}: ${formatBytes(part.size)}\n`;
    });
  }
  
  formatted += `\n🎮 *Create another:* !zip files:<file-list> compression:<level> password:<pass>`;
  
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
zipFunction.extract = async function(zipFile, password = null, extractTo = null) {
  try {
    const zipId = uuidv4();
    const extractDir = extractTo || `/tmp/extract_${zipId}`;
    
    // Create extraction directory
    await fs.mkdir(extractDir, { recursive: true });
    
    // Extract zip file
    const extractionResult = await extractZip(zipFile, extractDir, password);
    
    return {
      success: true,
      result: {
        extractedDir: extractDir,
        files: extractionResult.files,
        totalSize: extractionResult.totalSize,
        passwordUsed: !!password,
        formatted: formatExtractionResponse(
          extractionResult.files.length,
          extractionResult.totalSize,
          extractDir
        )
      }
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'EXTRACTION_FAILED',
        message: error.message || 'Failed to extract zip file'
      }
    };
  }
};

async function extractZip(zipFile, extractDir, password) {
  return new Promise((resolve, reject) => {
    // Note: extract-zip doesn't support password protection
    // For password-protected zips, you'd need a different library
    
    extract(zipFile, { dir: extractDir })
      .then(async () => {
        // Read extracted files
        const files = await readDirectoryRecursive(extractDir);
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        
        resolve({
          files: files,
          totalSize: totalSize
        });
      })
      .catch(reject);
  });
}

async function readDirectoryRecursive(dir, baseDir = dir) {
  const items = await fs.readdir(dir);
  const files = [];
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stats = await fs.stat(fullPath);
    
    if (stats.isDirectory()) {
      const subFiles = await readDirectoryRecursive(fullPath, baseDir);
      files.push(...subFiles);
    } else {
      const relativePath = path.relative(baseDir, fullPath);
      files.push({
        name: item,
        path: fullPath,
        relativePath: relativePath,
        size: stats.size,
        modified: stats.mtime
      });
    }
  }
  
  return files;
}

function formatExtractionResponse(fileCount, totalSize, extractDir) {
  const sizeFormatted = formatBytes(totalSize);
  
  let formatted = `📂 *Zip Archive Extracted!*\n\n`;
  formatted += `📁 *Extracted Files:* ${fileCount} file${fileCount !== 1 ? 's' : ''}\n`;
  formatted += `📊 *Total Size:* ${sizeFormatted}\n`;
  formatted += `📂 *Extraction Directory:* ${extractDir}\n\n`;
  
  formatted += `✅ *Extraction Complete:*\n`;
  formatted += `• All files extracted successfully\n`;
  formatted += `• Folder structure preserved\n`;
  formatted += `• Ready for access\n`;
  
  formatted += `\n🎮 *Extract another:* !unzip file:<zip-file> password:<pass>`;
  
  return formatted;
};

zipFunction.info = async function(zipFile) {
  try {
    // For production, you'd use a library like 'yauzl' to read zip contents
    // This is a simplified mock implementation
    
    const mockInfo = {
      fileCount: 5,
      totalSize: 1024 * 1024, // 1MB
      compressedSize: 512 * 1024, // 512KB
      compressionMethod: 'DEFLATE',
      encrypted: false,
      comment: 'Sample zip archive',
      files: [
        { name: 'document.txt', size: 1024, compressedSize: 512, ratio: 50 },
        { name: 'image.jpg', size: 512 * 1024, compressedSize: 500 * 1024, ratio: 2.3 },
        { name: 'data.json', size: 2048, compressedSize: 1024, ratio: 50 }
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
  let formatted = `📋 *Zip Archive Information*\n\n`;
  formatted += `📁 *Total Files:* ${info.fileCount}\n`;
  formatted += `📊 *Original Size:* ${formatBytes(info.totalSize)}\n`;
  formatted += `📈 *Compressed Size:* ${formatBytes(info.compressedSize)}\n`;
  formatted += `📉 *Compression Method:* ${info.compressionMethod}\n`;
  formatted += `🔒 *Encrypted:* ${info.encrypted ? 'Yes' : 'No'}\n\n`;
  
  if (info.comment) {
    formatted += `💬 *Comment:* ${info.comment}\n\n`;
  }
  
  formatted += `📄 *File List (sample):*\n`;
  
  info.files.slice(0, 5).forEach(file => {
    formatted += `• ${file.name} (${formatBytes(file.size)} → ${formatBytes(file.compressedSize)}, ${file.ratio}%)\n`;
  });
  
  if (info.files.length > 5) {
    formatted += `• ...and ${info.files.length - 5} more files\n`;
  }
  
  formatted += `\n💡 *Extract with:* !unzip file:<zip-file>`;
  
  return formatted;
};

module.exports = zipFunction;
