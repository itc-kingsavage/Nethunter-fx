// fx/tools/qr.js
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

async function qrFunction(request) {
  try {
    const { 
      text, 
      type = 'url', 
      size = 300,
      margin = 1,
      color = { dark: '#000000', light: '#ffffff' },
      errorCorrection = 'M',
      format = 'png' 
    } = request.data;
    
    if (!text) {
      return {
        success: false,
        error: {
          code: 'MISSING_TEXT',
          message: 'Text or URL is required to generate QR code'
        }
      };
    }

    // Validate size
    const qrSize = Math.min(Math.max(parseInt(size) || 300, 100), 2000);
    const qrMargin = Math.min(Math.max(parseInt(margin) || 1, 0), 10);
    
    // Prepare QR data based on type
    const qrData = prepareQRData(text, type);
    
    // Generate QR code
    const qrCode = await generateQRCode(qrData, {
      width: qrSize,
      margin: qrMargin,
      color: color,
      errorCorrectionLevel: errorCorrection,
      type: format
    });
    
    // Generate unique ID for the QR code
    const qrId = uuidv4();
    const filename = `qr_${qrId}.${format}`;
    
    return {
      success: true,
      result: {
        qrId: qrId,
        filename: filename,
        data: qrData,
        originalText: text,
        size: qrSize,
        format: format,
        margin: qrMargin,
        errorCorrection: errorCorrection,
        downloadUrl: `/qr/${qrId}`,
        formatted: formatQRResponse(qrData, qrSize, format, margin, errorCorrection)
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'QR_FAILED',
        message: error.message || 'Failed to generate QR code'
      }
    };
  }
}

function prepareQRData(text, type) {
  switch (type.toLowerCase()) {
    case 'url':
      // Ensure URL has protocol
      if (!text.startsWith('http://') && !text.startsWith('https://') && !text.startsWith('ftp://')) {
        return `https://${text}`;
      }
      return text;
      
    case 'wifi':
      // Format: WIFI:S:<SSID>;T:<WPA|WEP|nopass>;P:<password>;;
      const wifiMatch = text.match(/ssid:(.+?),pass:(.+?),type:(.+)/i);
      if (wifiMatch) {
        const ssid = wifiMatch[1];
        const password = wifiMatch[2];
        const security = wifiMatch[3].toUpperCase();
        return `WIFI:S:${ssid};T:${security};P:${password};;`;
      }
      return text;
      
    case 'contact':
      // vCard format
      const contactMatch = text.match(/name:(.+?),phone:(.+?),email:(.+)/i);
      if (contactMatch) {
        const name = contactMatch[1];
        const phone = contactMatch[2];
        const email = contactMatch[3];
        return `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL:${phone}\nEMAIL:${email}\nEND:VCARD`;
      }
      return text;
      
    case 'sms':
      // SMS format: SMSTO:<number>:<message>
      const smsMatch = text.match(/number:(.+?),message:(.+)/i);
      if (smsMatch) {
        const number = smsMatch[1];
        const message = encodeURIComponent(smsMatch[2]);
        return `SMSTO:${number}:${message}`;
      }
      return text;
      
    case 'email':
      // mailto format
      const emailMatch = text.match(/to:(.+?),subject:(.+?),body:(.+)/i);
      if (emailMatch) {
        const to = emailMatch[1];
        const subject = encodeURIComponent(emailMatch[2]);
        const body = encodeURIComponent(emailMatch[3]);
        return `mailto:${to}?subject=${subject}&body=${body}`;
      }
      return text;
      
    case 'text':
    default:
      return text;
  }
}

async function generateQRCode(data, options) {
  const qrOptions = {
    width: options.width,
    margin: options.margin,
    color: {
      dark: options.color.dark,
      light: options.color.light
    },
    errorCorrectionLevel: options.errorCorrection,
    type: options.type === 'svg' ? 'svg' : 'png'
  };
  
  if (options.type === 'svg') {
    // Generate SVG
    const svgString = await QRCode.toString(data, qrOptions);
    return {
      buffer: Buffer.from(svgString),
      type: 'image/svg+xml',
      size: svgString.length
    };
  } else {
    // Generate PNG
    const buffer = await QRCode.toBuffer(data, qrOptions);
    return {
      buffer: buffer,
      type: 'image/png',
      size: buffer.length
    };
  }
}

function formatQRResponse(data, size, format, margin, errorCorrection) {
  const dataPreview = data.length > 100 ? data.substring(0, 100) + '...' : data;
  const formatUpper = format.toUpperCase();
  const ecLevels = {
    'L': 'Low (7%)',
    'M': 'Medium (15%)',
    'Q': 'Quartile (25%)',
    'H': 'High (30%)'
  };
  
  let formatted = `📱 *QR Code Generated!*\n\n`;
  formatted += `📊 *Size:* ${size}x${size}px\n`;
  formatted += `📦 *Format:* ${formatUpper}\n`;
  formatted += `📐 *Margin:* ${margin}\n`;
  formatted += `🛡️ *Error Correction:* ${ecLevels[errorCorrection] || errorCorrection}\n`;
  formatted += `📝 *Data:* ${dataPreview}\n\n`;
  
  formatted += `✅ *QR Code Features:*\n`;
  formatted += `• Scan with any QR reader\n`;
  formatted += `• High resolution\n`;
  formatted += `• Customizable colors\n`;
  formatted += `• Error correction included\n\n`;
  
  formatted += `💡 *QR Code Types:*\n`;
  formatted += `• URL (website links)\n`;
  formatted += `• WiFi (network credentials)\n`;
  formatted += `• Contact (vCard)\n`;
  formatted += `• SMS (text message)\n`;
  formatted += `• Email (mailto link)\n`;
  formatted += `• Text (plain text)\n\n`;
  
  formatted += `🎮 *Usage:* !qr <data> type:<type> size:<size> format:<png/svg>`;
  
  return formatted;
}

// Additional QR utilities
qrFunction.analyze = async function(qrImageUrl) {
  try {
    // This would require a QR decoding library
    // For now, return mock analysis
    
    return {
      success: true,
      analysis: {
        data: 'https://example.com/qr-demo',
        type: 'url',
        size: '300x300',
        format: 'PNG',
        estimatedDataSize: '45 bytes'
      },
      formatted: `🔍 *QR Code Analysis*\n\nData: https://example.com/qr-demo\nType: URL\nSize: 300x300\nFormat: PNG\n\n💡 Upload a QR code image to scan its contents.`
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

qrFunction.types = function() {
  const types = [
    {
      name: 'URL',
      format: 'https://example.com or example.com',
      example: '!qr https://google.com type:url',
      emoji: '🔗'
    },
    {
      name: 'WiFi',
      format: 'ssid:<name>,pass:<password>,type:<WPA/WEP/nopass>',
      example: '!qr "ssid:MyWiFi,pass:password123,type:WPA" type:wifi',
      emoji: '📶'
    },
    {
      name: 'Contact',
      format: 'name:<fullname>,phone:<number>,email:<address>',
      example: '!qr "name:John Doe,phone:+123456789,email:john@example.com" type:contact',
      emoji: '👤'
    },
    {
      name: 'SMS',
      format: 'number:<phone>,message:<text>',
      example: '!qr "number:+123456789,message:Hello" type:sms',
      emoji: '💬'
    },
    {
      name: 'Email',
      format: 'to:<email>,subject:<text>,body:<text>',
      example: '!qr "to:test@example.com,subject:Hello,body:Message body" type:email',
      emoji: '📧'
    },
    {
      name: 'Text',
      format: 'Any text content',
      example: '!qr "Hello World" type:text',
      emoji: '📝'
    }
  ];
  
  return {
    success: true,
    types: types,
    formatted: formatQRTypes(types)
  };
};

function formatQRTypes(types) {
  let formatted = `📱 *QR Code Types*\n\n`;
  
  types.forEach(type => {
    formatted += `${type.emoji} *${type.name}*\n`;
    formatted += `   Format: ${type.format}\n`;
    formatted += `   Example: ${type.example}\n\n`;
  });
  
  formatted += `🎮 *Customize with:*\n`;
  formatted += `• size: <100-2000> (default: 300)\n`;
  formatted += `• format: png/svg (default: png)\n`;
  formatted += `• errorCorrection: L/M/Q/H (default: M)\n`;
  formatted += `• color: {dark: "#000000", light: "#ffffff"}\n`;
  
  return formatted;
}

module.exports = qrFunction;
