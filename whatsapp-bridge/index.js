const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const QRCode = require('qrcode');
const pino = require('pino');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.WHATSAPP_BRIDGE_API_KEY || 'supersecretkey123';

let sock = null;
let qrCodeData = null;
let connectionStatus = 'close';

// Logger setting to reduce console noise
const logger = pino({ level: 'warn' });

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'sessions/whatsapp'));
  
  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: logger,
  });
  
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      QRCode.toDataURL(qr, (err, url) => {
        if (!err) qrCodeData = url;
      });
    }
    
    if (connection === 'close') {
      connectionStatus = 'close';
      qrCodeData = null;
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('WhatsApp connection closed. Reconnecting...', shouldReconnect);
      if (shouldReconnect) {
        setTimeout(connectToWhatsApp, 5000);
      }
    } else if (connection === 'open') {
      connectionStatus = 'open';
      qrCodeData = null;
      console.log('WhatsApp connection opened successfully!');
    } else if (connection === 'connecting') {
      connectionStatus = 'connecting';
    }
  });
  
  sock.ev.on('creds.update', saveCreds);
}

// Start connection on server boot
connectToWhatsApp();

// API Key Authentication middleware
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const apiKey = authHeader ? authHeader.replace('Bearer ', '') : null;
  
  if (apiKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing API key.' });
  }
  next();
}

// GET /status - Check connection status
app.get('/status', (req, res) => {
  res.json({ status: connectionStatus });
});

// GET /qr - Render QR code page
app.get('/qr', (req, res) => {
  if (connectionStatus === 'open') {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WhatsApp Connected</title>
        <style>
          body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background-color: #f7f9fa; margin: 0; }
          .card { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); text-align: center; border-top: 5px solid #012425; }
          h2 { color: #012425; margin-top: 0; }
          .status { font-weight: bold; color: #2D6A4F; background: #E8F5E9; padding: 5px 12px; border-radius: 12px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Sanskriti Couture WhatsApp Bridge</h2>
          <p>Status: <span class="status">Connected ✅</span></p>
          <p>Your phone is linked. The system is ready to send reminders.</p>
        </div>
      </body>
      </html>
    `);
  }
  
  if (!qrCodeData) {
    return res.send('<h1>QR Code is generating or loading. Please refresh in 3 seconds...</h1>');
  }
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Scan WhatsApp QR Code</title>
      <style>
        body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background-color: #f7f9fa; margin: 0; }
        .card { background: white; padding: 35px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); text-align: center; border-top: 5px solid #80543c; max-width: 400px; }
        h2 { color: #012425; margin-top: 0; }
        img { width: 250px; height: 250px; border: 1px solid #ddd; margin: 20px 0; padding: 10px; background: white; }
        .status { font-weight: bold; color: #80543c; }
        p { color: #4a5568; line-height: 1.5; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>Link Central WhatsApp</h2>
        <p>Scan this QR code using WhatsApp on your phone (Linked Devices → Link a Device) to authorize the reminders channel.</p>
        <img src="${qrCodeData}" alt="WhatsApp QR Code" />
        <p>Current Status: <span class="status">${connectionStatus}</span></p>
        <p style="font-size: 11px; color: #a0aec0;">Refresh this page if the QR code expires or fails to load.</p>
      </div>
    </body>
    </html>
  `);
});

// POST /send-message - API endpoint to dispatch text messages
app.post('/send-message', authenticate, async (req, res) => {
  try {
    const { phone, message } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({ error: 'Bad Request', message: 'Phone number and message body details are required.' });
    }
    
    if (connectionStatus !== 'open') {
      return res.status(503).json({ error: 'Service Unavailable', message: 'WhatsApp connection is offline. Please scan the QR code first.' });
    }
    
    // Clean and validate number format
    let cleanedPhone = phone.replace(/[^0-9]/g, '');
    if (cleanedPhone.length === 10) {
      cleanedPhone = '91' + cleanedPhone; // Default to India prefix
    }
    
    const jid = `${cleanedPhone}@s.whatsapp.net`;
    
    const response = await sock.sendMessage(jid, { text: message });
    res.status(200).json({ success: true, messageId: response?.key?.id, jid });
  } catch (err) {
    console.error('Error sending WhatsApp message:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`WhatsApp Bridge Server running on port ${PORT}`);
});
