import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let client = null;
let qrCodeData = null; // Stores the latest base64 QR code image
let clientStatus = 'disconnected'; // 'disconnected' | 'qr' | 'connecting' | 'ready' | 'auth_failure'

export function getWhatsAppClientState() {
  return { status: clientStatus, qrCode: qrCodeData };
}

export async function disconnectWhatsAppClient() {
  if (client) {
    try {
      await client.destroy();
      client = null;
      clientStatus = 'disconnected';
      qrCodeData = null;
      console.log('[WhatsAppClient] Client destroyed successfully.');
      
      // Give it a brief moment to ensure processes are fully terminated
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Delete authentication session folder
      const dataPath = process.env.USER_DATA_PATH || path.join(__dirname, '..');
      const authPath = path.join(dataPath, '.wwebjs_auth');
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
        console.log('[WhatsAppClient] Deleted session folder.');
      }
      return true;
    } catch (err) {
      console.error('[WhatsAppClient] Error during disconnect:', err.message);
      // Even on error, force status reset
      client = null;
      clientStatus = 'disconnected';
      return false;
    }
  }
  return false;
}

export function initializeWhatsAppClient() {
  // If already connecting or ready, do not duplicate
  if (clientStatus === 'connecting' || clientStatus === 'ready' || clientStatus === 'qr') {
    console.log(`[WhatsAppClient] Client already in status: ${clientStatus}. Skipping initialization.`);
    return;
  }

  console.log('[WhatsAppClient] Starting WhatsApp Web client...');
  clientStatus = 'connecting';
  qrCodeData = null;

  try {
    const dataPath = process.env.USER_DATA_PATH || path.join(__dirname, '..');
    
    client = new Client({
      authStrategy: new LocalAuth({
        dataPath: path.join(dataPath, '.wwebjs_auth')
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      }
    });

    client.on('qr', async (qr) => {
      console.log('[WhatsAppClient] QR Code received. Scan it to authenticate.');
      clientStatus = 'qr';
      try {
        // Generate base64 Data URL for the QR code image
        qrCodeData = await qrcode.toDataURL(qr);
      } catch (err) {
        console.error('[WhatsAppClient] Failed to generate QR code image:', err.message);
        qrCodeData = qr; // fallback to raw string
      }
    });

    client.on('ready', () => {
      console.log('[WhatsAppClient] WhatsApp Client is READY and authenticated!');
      clientStatus = 'ready';
      qrCodeData = null;
    });

    client.on('authenticated', () => {
      console.log('[WhatsAppClient] WhatsApp Client authenticated.');
    });

    client.on('auth_failure', (msg) => {
      console.error('[WhatsAppClient] WhatsApp Authentication failure:', msg);
      clientStatus = 'auth_failure';
      qrCodeData = null;
    });

    client.on('disconnected', (reason) => {
      console.log('[WhatsAppClient] WhatsApp Client disconnected. Reason:', reason);
      clientStatus = 'disconnected';
      qrCodeData = null;
      client = null;
    });

    client.initialize().catch(err => {
      console.error('[WhatsAppClient] Initialization call failed:', err.message);
      clientStatus = 'disconnected';
      client = null;
    });

  } catch (err) {
    console.error('[WhatsAppClient] Failed to create client instance:', err.message);
    clientStatus = 'disconnected';
    client = null;
  }
}

export async function sendWhatsAppMessageWeb(to, message) {
  if (!client || clientStatus !== 'ready') {
    throw new Error(`WhatsApp client is not ready (Status: ${clientStatus})`);
  }

  // Format phone number: remove non-digits
  let cleanNumber = to.replace(/\D/g, '');
  
  // Ensure it has country code (default to 91 if it's 10 digits)
  if (cleanNumber.length === 10) {
    cleanNumber = '91' + cleanNumber;
  }
  
  // Format for whatsapp-web.js: <phone>@c.us
  if (!cleanNumber.endsWith('@c.us')) {
    cleanNumber = `${cleanNumber}@c.us`;
  }

  console.log(`[WhatsAppClient] Sending message to ${cleanNumber}: "${message.slice(0, 40)}..."`);
  const response = await client.sendMessage(cleanNumber, message);
  return response;
}
