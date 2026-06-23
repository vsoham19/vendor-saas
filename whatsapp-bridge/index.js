const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const express = require("express");
const QRCode = require("qrcode");
const pino = require("pino");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.WHATSAPP_BRIDGE_API_KEY;

if (!API_KEY) {
  console.error(
    "❌ WHATSAPP_BRIDGE_API_KEY environment variable is missing"
  );
  process.exit(1);
}

let sock = null;
let qrCodeData = null;
let connectionStatus = "close";

const logger = pino({
  level: "warn"
});

async function connectToWhatsApp() {
  try {
    const sessionPath = path.join(
      __dirname,
      "sessions",
      "whatsapp"
    );

    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, {
        recursive: true
      });
    }

    const { state, saveCreds } =
      await useMultiFileAuthState(sessionPath);

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      logger
    });

    sock.ev.on("connection.update", (update) => {
      const {
        connection,
        lastDisconnect,
        qr
      } = update;

      if (qr) {
        QRCode.toDataURL(qr)
          .then((url) => {
            qrCodeData = url;
          })
          .catch(console.error);
      }

      if (connection === "connecting") {
        connectionStatus = "connecting";
        console.log("⏳ Connecting to WhatsApp...");
      }

      if (connection === "open") {
        connectionStatus = "open";
        qrCodeData = null;
        console.log("✅ WhatsApp connected");
      }

      if (connection === "close") {
        connectionStatus = "close";

        const shouldReconnect =
          lastDisconnect?.error?.output?.statusCode !==
          DisconnectReason.loggedOut;

        console.log(
          "❌ WhatsApp disconnected. Reconnect:",
          shouldReconnect
        );

        if (shouldReconnect) {
          setTimeout(connectToWhatsApp, 5000);
        }
      }
    });

    sock.ev.on("creds.update", saveCreds);

  } catch (err) {
    console.error(
      "Failed to initialize WhatsApp:",
      err
    );

    setTimeout(connectToWhatsApp, 10000);
  }
}

connectToWhatsApp();

/* ===========================
   AUTH MIDDLEWARE
=========================== */

function authenticate(req, res, next) {
  const authHeader =
    req.headers.authorization || "";

  const token = authHeader.replace(
    "Bearer ",
    ""
  );

  if (token !== API_KEY) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  next();
}

/* ===========================
   HEALTH CHECK
=========================== */

app.get("/", (req, res) => {
  res.json({
    service: "whatsapp-bridge",
    status: connectionStatus
  });
});

/* ===========================
   STATUS
=========================== */

app.get("/status", (req, res) => {
  res.json({
    status: connectionStatus
  });
});

/* ===========================
   QR PAGE
=========================== */

app.get("/qr", (req, res) => {
  if (connectionStatus === "open") {
    return res.send(`
      <h1>✅ WhatsApp Connected</h1>
      <p>Bridge is ready.</p>
    `);
  }

  if (!qrCodeData) {
    return res.send(`
      <h1>Generating QR...</h1>
      <p>Refresh in a few seconds.</p>
    `);
  }

  res.send(`
    <html>
      <body style="font-family:sans-serif;text-align:center;padding-top:40px">
        <h2>Scan WhatsApp QR</h2>
        <img src="${qrCodeData}" width="300"/>
        <p>Status: ${connectionStatus}</p>
      </body>
    </html>
  `);
});

/* ===========================
   SEND MESSAGE
=========================== */

app.post(
  "/send-message",
  authenticate,
  async (req, res) => {
    try {
      const { phone, message } =
        req.body;

      if (!phone || !message) {
        return res.status(400).json({
          error:
            "phone and message are required"
        });
      }

      if (
        !sock ||
        connectionStatus !== "open"
      ) {
        return res.status(503).json({
          error:
            "WhatsApp is not connected"
        });
      }

      let cleanedPhone = phone.replace(
        /\D/g,
        ""
      );

      if (cleanedPhone.length === 10) {
        cleanedPhone =
          "91" + cleanedPhone;
      }

      const jid =
        `${cleanedPhone}@s.whatsapp.net`;

      const response =
        await sock.sendMessage(jid, {
          text: message
        });

      return res.json({
        success: true,
        messageId:
          response?.key?.id || null,
        jid
      });

    } catch (err) {
      console.error(
        "Send message error:",
        err
      );

      return res.status(500).json({
        error: err.message
      });
    }
  }
);

/* ===========================
   START SERVER
=========================== */

app.listen(PORT, () => {
  console.log(
    `🚀 WhatsApp Bridge running on port ${PORT}`
  );
});