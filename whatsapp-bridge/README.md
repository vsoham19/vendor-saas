# Sanskriti Couture WhatsApp Bridge

A lightweight, self-hosted API bridge to send WhatsApp messages using the `@whiskeysockets/baileys` library. It does not require running a memory-heavy headless Chrome/Puppeteer browser, making it extremely cost-effective and suitable for free container tiers.

## Setup & Deployment Instructions

### 1. One-Click Deployment (Recommended)
You can deploy this service to **Railway** or **Render**'s free/cheap tiers:

* **Railway**:
  1. Create a new service and link this repository or directory.
  2. Add the environment variable:
     - `WHATSAPP_BRIDGE_API_KEY`: A secure random password/key (e.g. `your-auth-token`).
  3. Ensure a persistent disk volume is mounted at `/app/sessions` so that your authenticated session persists across service restarts.

* **Render**:
  1. Create a new **Web Service** on Render and link this repository/directory.
  2. Set the environment variables:
     - `WHATSAPP_BRIDGE_API_KEY`: A secure random password/key.
     - `PORT`: `3001`
  3. *Note*: In Render's free tier, the local disk is wiped on restarts. To persist sessions, consider upgrading to a $5/month instance with a persistent disk volume mounted at `/app/sessions`.

### 2. Linking WhatsApp
Once the server is running (e.g., `https://your-bridge.onrender.com`):
1. Visit `https://your-bridge.onrender.com/qr` in your browser.
2. Open WhatsApp on your phone → **Settings / Menu** → **Linked Devices** → **Link a Device**.
3. Scan the QR code displayed on the page.
4. Once connected, the page status will update to `Connected ✅`.

### 3. API Usage

#### Send Message
- **Method**: `POST`
- **Path**: `/send-message`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <WHATSAPP_BRIDGE_API_KEY>`
- **Payload**:
  ```json
  {
    "phone": "919876543210",
    "message": "Hello Priya Sharma, your bridal Lehenga fitting is scheduled for tomorrow at 2:00 PM!"
  }
  ```
