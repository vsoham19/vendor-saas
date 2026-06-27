/**
 * Sanskriti Couture WhatsApp Bridge API
 * 
 * Standalone Node.js Express server acting as a WhatsApp API wrapper.
 * Mimics WhatsApp Web client using @whiskeysockets/baileys.
 */

// =========================================================================
// 1. MODULE IMPORTS & INITIALIZATION
// =========================================================================

const { 
  default: makeWASocket, 
  useMultiFileAuthState, 
  DisconnectReason, 
  fetchLatestBaileysVersion, 
  Browsers 
} = require('@whiskeysockets/baileys');
const express = require('express');
const QRCode = require('qrcode');
const pino = require('pino');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
app.use(express.json());

// Load configurations
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.WHATSAPP_BRIDGE_API_KEY;

if (!API_KEY) {
  console.warn('WARNING: WHATSAPP_BRIDGE_API_KEY environment variable is not defined. Defaulting to fallback credentials.');
}

const SESSION_DIR = path.join(__dirname, 'sessions/whatsapp');

// =========================================================================
// 2. STATE MANAGEMENT & DIAGNOSTIC LOGGING
// =========================================================================

let sock = null;
let qrCodeData = null;
let connectionStatus = 'close';
let reconnectTimeout = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// In-memory array to store recent connection lifecycle logs for GET /debug
const connectionLogs = [];

/**
 * Pushes a structured diagnostic event into the in-memory logger log array.
 * @param {string} event - Name of the event.
 * @param {any} details - Meta details of the event.
 */
function addDiagnosticLog(event, details) {
  connectionLogs.push({
    timestamp: new Date().toISOString(),
    event,
    details: typeof details === 'object' ? JSON.stringify(details) : String(details)
  });
  // Cap logs at 100 entries to prevent memory leak
  if (connectionLogs.length > 100) {
    connectionLogs.shift();
  }
}

// Suppress verbose Baileys info/trace logs in console to keep clean logs
const logger = pino({ level: 'warn' });

// =========================================================================
// 3. CORE UTILITY FUNCTIONS
// =========================================================================

/**
 * Safely removes the saved session directory to force a clean re-authentication.
 */
function cleanupAuthSession() {
  try {
    if (fs.existsSync(SESSION_DIR)) {
      console.log(`[Auth] Cleaning up auth session files at: ${SESSION_DIR}`);
      addDiagnosticLog('auth_cleanup_start', { path: SESSION_DIR });
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
      addDiagnosticLog('auth_cleanup_success', { path: SESSION_DIR });
    } else {
      addDiagnosticLog('auth_cleanup_skipped', 'Session directory does not exist.');
    }
  } catch (err) {
    console.error('[Auth] Error executing auth session directory cleanup:', err);
    addDiagnosticLog('auth_cleanup_error', err.message);
  }
}

// =========================================================================
// 4. CONNECTION AND EVENT LIFECYCLE
// =========================================================================

/**
 * Establishes connection to WhatsApp Web servers.
 * Resolves 405 Method Not Allowed error by specifying latest version parameters
 * and mimicking standard desktop browser user agent arrays.
 */
async function initializeWhatsAppConnection() {
  // Clear any existing reconnect timers to prevent concurrent schedules
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  console.log('[System] Initializing WhatsApp connection handshake...');
  addDiagnosticLog('connection_init', { attempt: reconnectAttempts });
  connectionStatus = 'connecting';

  try {
    // 1. Fetch latest WhatsApp Web version to bypass 405 Method Not Allowed checks
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`[Version] Using WhatsApp Web version: ${version.join('.')}, isLatest: ${isLatest}`);
    addDiagnosticLog('version_fetch_success', { version: version.join('.'), isLatest });

    // 2. Load auth credentials
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

    // 3. Spawn socket client
    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
      logger,
      // Emulate desktop browser to bypass cloud IP registration restrictions
      browser: Browsers.macOS('Desktop'),
      // Add keep-alive options to prevent silent drops on cloud hosts
      keepAliveIntervalMs: 30000,
    });

    // 4. Handle events
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      addDiagnosticLog('connection_update_event', {
        connection,
        hasQr: !!qr,
        statusCode: lastDisconnect?.error?.output?.statusCode,
        error: lastDisconnect?.error?.message || lastDisconnect?.error || null
      });

      // Handle QR code generation
      if (qr) {
        console.log('[Connection] New pairing QR code generated.');
        try {
          qrCodeData = await QRCode.toDataURL(qr);
          addDiagnosticLog('qr_code_rendered', 'QR base64 generated successfully.');
        } catch (qrErr) {
          console.error('[QR] Error generating QR code DataURL:', qrErr);
          qrCodeData = null;
          addDiagnosticLog('qr_code_render_error', qrErr.message);
        }
      }

      // Handle connection closing/disconnections
      if (connection === 'close') {
        connectionStatus = 'close';
        qrCodeData = null;
        
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const errorReason = lastDisconnect?.error?.message || lastDisconnect?.error || 'Unknown';
        console.log(`[Connection] Connection closed. StatusCode: ${statusCode}, Reason: ${errorReason}`);

        // Reconnect logic
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401;

        if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
          console.log('[Auth] Session has been logged out or credentials invalidated. Cleaning up auth files...');
          cleanupAuthSession();
          reconnectAttempts = 0;
        }

        if (shouldReconnect) {
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delay = Math.min(5000 * Math.pow(2, reconnectAttempts - 1), 60000);
            console.log(`[Connection] Scheduling reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay / 1000}s...`);
            addDiagnosticLog('reconnect_scheduled', { attempt: reconnectAttempts, delayMs: delay });
            
            reconnectTimeout = setTimeout(() => {
              initializeWhatsAppConnection();
            }, delay);
          } else {
            console.error('[Connection] Max reconnection attempts reached. Please check connection status or restart the service.');
            addDiagnosticLog('max_reconnect_reached', 'Max attempts exceeded.');
          }
        }
      } else if (connection === 'open') {
        connectionStatus = 'open';
        qrCodeData = null;
        reconnectAttempts = 0;
        console.log('[Connection] WhatsApp connection successfully established and open.');
        addDiagnosticLog('connection_established', 'Socket is open and active.');
      } else if (connection === 'connecting') {
        connectionStatus = 'connecting';
      }
    });

    sock.ev.on('creds.update', saveCreds);

  } catch (err) {
    console.error('[System] Failed to initialize Baileys client:', err);
    addDiagnosticLog('client_init_error', err.message);
    connectionStatus = 'close';
    
    // Backoff reconnect on initialization failure
    reconnectAttempts++;
    const delay = Math.min(5000 * Math.pow(2, reconnectAttempts - 1), 60000);
    console.log(`[Connection] Scheduling initialization retry in ${delay / 1000}s...`);
    reconnectTimeout = setTimeout(() => {
      initializeWhatsAppConnection();
    }, delay);
  }
}

// Start connection on boot
initializeWhatsAppConnection();

// =========================================================================
// 5. EXPRESS ROUTING & ENDPOINTS
// =========================================================================

/**
 * Express Middleware verifying request authorization token.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const apiKey = authHeader ? authHeader.replace('Bearer ', '') : null;
  
  const expectedApiKey = API_KEY || 'supersecretkey123';
  if (apiKey !== expectedApiKey) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing API key.' });
  }
  next();
}

// GET /status - Check connection status
app.get('/status', (req, res) => {
  res.json({ status: connectionStatus });
});

// GET /debug - Diagnostic endpoint returning internal states and connection logs
app.get('/debug', (req, res) => {
  res.json({
    status: connectionStatus,
    qrCodeAvailable: !!qrCodeData,
    reconnectAttempts,
    sessionDirExists: fs.existsSync(SESSION_DIR),
    sessionFiles: fs.existsSync(SESSION_DIR) ? fs.readdirSync(SESSION_DIR) : [],
    logs: connectionLogs
  });
});

// POST /clear-session - Reset authentication state and reinitialize socket
app.post('/clear-session', authenticate, (req, res) => {
  try {
    cleanupAuthSession();
    reconnectAttempts = 0;
    initializeWhatsAppConnection();
    res.json({ success: true, message: 'Session cleared and WhatsApp connection reinitialized.' });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
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
  
  if (connectionStatus === 'connecting') {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Connecting...</title>
        <meta http-equiv="refresh" content="5">
        <style>
          body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background-color: #f7f9fa; margin: 0; }
          .card { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); text-align: center; border-top: 5px solid #80543c; }
          h2 { color: #012425; margin-top: 0; }
          .status { font-weight: bold; color: #80543c; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Sanskriti Couture WhatsApp Bridge</h2>
          <p>Status: <span class="status">Connecting... 🔄</span></p>
          <p>Establishing secure handshake. Page will auto-refresh in 5 seconds.</p>
        </div>
      </body>
      </html>
    `);
  }
  
  if (!qrCodeData) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Loading...</title>
        <meta http-equiv="refresh" content="3">
        <style>
          body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background-color: #f7f9fa; margin: 0; }
          .card { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); text-align: center; border-top: 5px solid #80543c; }
          h2 { color: #012425; margin-top: 0; }
          .status { font-weight: bold; color: #80543c; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Sanskriti Couture WhatsApp Bridge</h2>
          <p>Status: <span class="status">Initializing... 🔄</span></p>
          <p>Generating new pairing credentials. Page will auto-refresh in 3 seconds.</p>
        </div>
      </body>
      </html>
    `);
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
    
    if (connectionStatus !== 'open' || !sock) {
      return res.status(503).json({ error: 'Service Unavailable', message: 'WhatsApp connection is offline. Please scan the QR code first.' });
    }
    
    // Clean and validate number format
    let cleanedPhone = phone.replace(/[^0-9]/g, '');
    if (cleanedPhone.length === 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'Phone number must contain digits.' });
    }
    
    if (cleanedPhone.length === 10) {
      cleanedPhone = '91' + cleanedPhone; // Default to India prefix
    }
    
    const jid = `${cleanedPhone}@s.whatsapp.net`;
    
    const response = await sock.sendMessage(jid, { text: message });
    res.status(200).json({ success: true, messageId: response?.key?.id, jid });
  } catch (err) {
    console.error('[API] Error sending WhatsApp message:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[System] WhatsApp Bridge Server running on port ${PORT}`);
});
