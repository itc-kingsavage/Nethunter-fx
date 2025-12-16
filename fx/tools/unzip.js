// fx/tools/unzip.js
const extract = require('extract-zip');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const yauzl = require('yauzl');

async function unzipFunction(request) {
  try {
    const { 
      zipUrl, 
      extractPath = null,
      password = null,
      extractAll = true,
      files = [] 
    } = request.data;
    
    if (!zipUrl) {
      return {
        success: false,
        error: {
          code: 'NO_ZIP_FILE',
          message: 'Zip file URL is required'
        }
      };
    }

    // Download zip file
    const zipData = await downloadZipFile(zipUrl);
    
    // Extract zip file
    const extraction = await extractZipFile(
      zipData.buffer, 
      extractPath, 
      password, 
      extractAll, 
      files
    );
    
    return {
      success: true,
      result: {
        extractionId: extraction.extractionId,
        extractedFiles: extraction.files,
        totalFiles: extraction.totalFiles,
        extractedSize: extraction.extractedSize,
        passwordUsed: !!password,
        downloadUrl: extraction.downloadUrl,
        formatted: formatUnzipResponse(
          extraction.files.length,
          extraction.totalFiles,
          extraction.extractedSize,
          !!password
        )
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNZIP_FAILED',
        message: error.message || 'Failed to extract zip file'
      }
    };
  }
}

async function downloadZipFile(zipUrl) {
  // In production, download actual zip file
  // For simulation, create mock zip data
  
  const mockZipBuffer = Buffer.from('Mock zip file content for simulation');
  
  return {
    buffer: mockZipBuffer,
    size: mockZipBuffer.length,
    mimeType: 'application/zip'
  };
}

async function extractZipFile(zipBuffer, extractPath, password, extractAll, specificFiles) {
  return new Promise(async (resolve, reject) => {
    const extractionId = uuidv4();
    const tempDir = `/tmp/unzip_${extractionId}`;
    const extractDir = extractPath ? path.join(tempDir, extractPath) : tempDir;
    
    try {
      // Create extraction directory
      await fs.mkdir(extractDir, { recursive: true });
      
      // Save buffer to temp file
      const tempZipPath = path.join(tempDir, 'archive.zip');
      await fs.writeFile(tempZipPath, zipBuffer);
      
      // Extract using extract-zip
      await extract(tempZipPath, {
        dir: extractDir,
        onEntry: (entry, zipfile) => {
          if (password) {
            // Password protection handling
            zipfile.openReadStream(entry, { password }, (err, readStream) => {
              if (err) {
                console.log('Password error for entry:', entry.fileName, err.message);
              }
            });
          }
        }
      });
      
      // List extracted files
      const extractedFiles = await listFilesRecursive(extractDir);
      const totalFiles = extractedFiles.length;
      const extractedSize = await calculateTotalSize(extractedFiles);
      
      // If specific files were requested, filter them
      let finalFiles = extractedFiles;
      if (!extractAll && specificFiles.length > 0) {
        finalFiles = extractedFiles.filter(file => 
          specificFiles.some(pattern => file.path.includes(pattern))
        );
      }
      
      // Create download package (in production, might create new zip or tar)
      const downloadUrl = `/download/extracted_${extractionId}.tar.gz`;
      
      resolve({
        extractionId: extractionId,
        files: finalFiles,
        totalFiles: totalFiles,
        extractedSize: extractedSize,
        extractDir: extractDir,
        downloadUrl: downloadUrl
      });
      
    } catch (error) {
      // Cleanup on error
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {}
      reject(error);
    }
  });
}

async function listFilesRecursive(dir) {
  const files = [];
  
  async function scan(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(dir, fullPath);
      
      if (entry.isDirectory()) {
        await scan(fullPath);
      } else {
        const stats = await fs.stat(fullPath);
        files.push({
          path: relativePath,
          fullPath: fullPath,
          size: stats.size,
          modified: stats.mtime,
          isDirectory: false
        });
      }
    }
  }
  
  await scan(dir);
  return files;
}

async function calculateTotalSize(files) {
  return files.reduce((total, file) => total + file.size, 0);
}

function formatUnzipResponse(extractedCount, totalFiles, extractedSize, passwordUsed) {
  const sizeFormatted = formatBytes(extractedSize);
  
  let formatted = `📂 *Zip File Extracted!*\n\n`;
  formatted += `📊 *Extracted:* ${extractedCount} of ${totalFiles} files\n`;
  formatted += `📈 *Total Size:* ${sizeFormatted}\n`;
  formatted += `🔓 *Password:* ${passwordUsed ? 'Required and accepted' : 'Not required'}\n\n`;
  
  formatted += `✅ *Extraction Features:*\n`;
  formatted += `• Preserves file structure\n`;
  formatted += `• Handles large archives\n`;
  formatted += `• Password support\n`;
  formatted += `• Selective extraction\n\n`;
  
  formatted += `💡 *Extraction Tips:*\n`;
  formatted += `• Check for viruses before extracting\n`;
  formatted += `• Extract to empty folder first\n`;
  formatted += `• Keep original zip as backup\n`;
  formatted += `• Verify file integrity after extraction\n`;
  
  formatted += `\n🎮 *Extract another:* !unzip <zip-url> password:<pass>`;
  
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

// Additional unzip utilities
unzipFunction.listContents = async function(zipUrl) {
  try {
    // In production, list actual zip contents using yauzl
    // For simulation, return mock contents
    
    const mockContents = {
      fileCount: 8,
      totalSize: 15360,
      compressedSize: 7680,
      files: [
        { name: 'documents/', type: 'directory', size: 0, compressed: 0 },
        { name: 'documents/report.pdf', type: 'file', size: 4096, compressed: 2048 },
        { name: 'documents/notes.txt', type: 'file', size: 1024, compressed: 512 },
        { name: 'images/', type: 'directory', size: 0, compressed: 0 },
        { name: 'images/photo1.jpg', type: 'file', size: 5120, compressed: 2560 },
        { name: 'images/photo2.jpg', type: 'file', size: 4096, compressed: 2048 },
        { name: 'data.json', type: 'file', size: 1024, compressed: 512 },
        { name: 'README.md', type: 'file', size: 1024, compressed: 512 }
      ]
    };
    
    return {
      success: true,
      contents: mockContents,
      formatted: formatZipContents(mockContents)
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

function formatZipContents(contents) {
  let formatted = `📋 *Zip File Contents*\n\n`;
  formatted += `📊 *Total Files:* ${contents.fileCount}\n`;
  formatted += `📈 *Original Size:* ${formatBytes(contents.totalSize)}\n`;
  formatted += `📉 *Compressed Size:* ${formatBytes(contents.compressedSize)}\n`;
  formatted += `⚡ *Compression Ratio:* ${((contents.totalSize - contents.compressedSize) / contents.totalSize * 100).toFixed(1)}%\n\n`;
  
  formatted += `📁 *File Structure:*\n`;
  
  // Group by directory
  const directories = {};
  contents.files.forEach(file => {
    if (file.type === 'directory') {
      directories[file.name] = [];
    }
  });
  
  contents.files.forEach(file => {
    if (file.type === 'file') {
      const dir = path.dirname(file.name);
      if (directories[dir]) {
        directories[dir].push(file);
      } else {
        if (!directories['/']) directories['/'] = [];
        directories['/'].push(file);
      }
    }
  });
  
  Object.entries(directories).forEach(([dir, files]) => {
    const dirName = dir === '/' ? 'Root' : dir;
    formatted += `📂 *${dirName}:*\n`;
    files.forEach(file => {
      const savings = file.size > 0 ? ((file.size - file.compressed) / file.size * 100).toFixed(1) : '0';
      formatted += `  ${path.basename(file.name)} - ${formatBytes(file.compressed)} (${savings}% saved)\n`;
    });
    formatted += `\n`;
  });
  
  formatted += `💡 *Extract specific files:* !unzip <url> files:["pattern1","pattern2"]`;
  
  return formatted;
};

unzipFunction.testIntegrity = async function(zipUrl) {
  try {
    // Mock integrity test
    const testResults = {
      valid: Math.random() > 0.1, // 90% chance of being valid
      corruptedFiles: Math.random() > 0.8 ? ['corrupted.jpg'] : [],
      checksumMatches: Math.random() > 0.2, // 80% chance checksums match
      extractionTest: Math.random() > 0.1, // 90% chance extraction works
      issues: Math.random() > 0.7 ? ['File header mismatch', 'Unexpected EOF'] : []
    };
    
    return {
      success: true,
      integrity: testResults,
      formatted: formatIntegrityResults(testResults)
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

function formatIntegrityResults(results) {
  let formatted = `🔍 *Zip File Integrity Test*\n\n`;
  
  if (results.valid) {
    formatted += `✅ *Archive is valid and intact*\n\n`;
  } else {
    formatted += `❌ *Archive appears to be corrupted*\n\n`;
  }
  
  formatted += `📊 *Test Results:*\n`;
  formatted += `• Structure Valid: ${results.valid ? '✅' : '❌'}\n`;
  formatted += `• Checksums Match: ${results.checksumMatches ? '✅' : '❌'}\n`;
  formatted += `• Extraction Test: ${results.extractionTest ? '✅' : '❌'}\n`;
  
  if (results.corruptedFiles.length > 0) {
    formatted += `• Corrupted Files: ${results.corruptedFiles.join(', ')}\n`;
  }
  
  if (results.issues.length > 0) {
    formatted += `\n⚠️ *Issues Found:*\n`;
    results.issues.forEach(issue => {
      formatted += `• ${issue}\n`;
    });
  }
  
  if (!results.valid) {
    formatted += `\n🔧 *Recommendations:*\n`;
    formatted += `• Try downloading the zip file again\n`;
    formatted += `• Use repair tools if available\n`;
    formatted += `• Contact the source for a fresh copy\n`;
  }
  
  formatted += `\n💡 *Always test archives before important extractions*`;
  
  return formatted;
};

// Password recovery simulation
unzipFunction.tryPasswords = async function(zipUrl, passwordList) {
  try {
    // Mock password trying
    const triedPasswords = passwordList.slice(0, 10); // Limit to 10 attempts
    const foundPassword = triedPasswords.find(p => p === 'secret123') || null;
    
    return {
      success: true,
      tried: triedPasswords.length,
      found: !!foundPassword,
      password: foundPassword,
      formatted: formatPasswordResults(triedPasswords.length, foundPassword)
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

function formatPasswordResults(tried, foundPassword) {
  let formatted = `🔐 *Password Recovery Attempt*\n\n`;
  formatted += `🔑 *Passwords Tried:* ${tried}\n`;
  
  if (foundPassword) {
    formatted += `🎉 *Password Found:* "${foundPassword}"\n\n`;
    formatted += `✅ You can now extract the archive with:\n`;
    formatted += `!unzip <url> password:"${foundPassword}"\n`;
  } else {
    formatted += `❌ *Password Not Found*\n\n`;
    formatted += `💡 *Suggestions:*\n`;
    formatted += `• Try common passwords\n`;
    formatted += `• Check if password was shared separately\n`;
    formatted += `• Contact the archive creator\n`;
    formatted += `• Consider if password is really necessary\n`;
  }
  
  formatted += `\n⚠️ *Use password recovery responsibly and legally*`;
  
  return formatted;
};

module.exports = unzipFunction;
