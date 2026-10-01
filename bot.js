import express from "express";
import QRCode from "qrcode";
import P from "pino";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const AI_URL = process.env.AI_URL || "https://openrouter.ai/api/v1/chat/completions";
const AI_KEY = process.env.OPENROUTER_API_KEY || "";
const AI_MODEL = process.env.AI_MODEL || "qwen/qwen3.8-27b:free";
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT ||
  "Kamu adalah asisten AI WhatsApp yang ramah. Jawab dalam bahasa Indonesia, santai, singkat, dan membantu.";

let sock;
let qrData = null;
let status = "starting";
let lastError = null;
let reconnectTimer = null;

const logger = P({ level: process.env.LOG_LEVEL || "info" });

async function askAI(userText) {
  if (!AI_KEY) {
    return "AI belum dikonfigurasi. Tambahkan OPENROUTER_API_KEY di Environment Variables.";
  }

  const r = await fetch(AI_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${AI_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || "https://example.com",
      "X-Title": "WA AI Experiment"
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userText }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });

  if (!r.ok) {
    const body = await r.text();
    throw new Error(`AI ${r.status}: ${body.slice(0, 300)}`);
  }

  const data = await r.json();
  return data?.choices?.[0]?.message?.content?.trim() || "AI tidak memberikan jawaban.";
}

async function startBot() {
  clearTimeout(reconnectTimer);
  status = "connecting";
  lastError = null;

  const { state, saveCreds } = await useMultiFileAuthState("./auth_info");

  let version;
  try {
    const latest = await fetchLatestBaileysVersion();
    version = latest.version;
  } catch {
    version = undefined;
  }

  sock = makeWASocket({
    auth: state,
    version,
    logger,
    printQRInTerminal: false,
    browser: ["WA AI Experiment", "Chrome", "1.0.0"],
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      qrData = await QRCode.toDataURL(qr);
      status = "scan_qr";
    }

    if (connection === "open") {
      qrData = null;
      status = "connected";
      lastError = null;
      logger.info("WhatsApp connected");
    }

    if (connection === "close") {
      status = "disconnected";
      const code = lastDisconnect?.error?.output?.statusCode;
      lastError = String(code || "connection closed");

      if (code !== DisconnectReason.loggedOut) {
        reconnectTimer = setTimeout(startBot, 5000);
      } else {
        status = "logged_out";
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        if (!msg.message || msg.key.fromMe) continue;
        if (msg.key.remoteJid === "status@broadcast") continue;

        const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          "";

        if (!text.trim()) continue;

        // Prefix command: !ai pesan
        // Set AUTO_REPLY=true if you want every incoming text answered.
        const autoReply = process.env.AUTO_REPLY === "true";
        const isCommand = text.toLowerCase().startsWith("!ai ");

        if (!autoReply && !isCommand) continue;

        const prompt = isCommand ? text.slice(4).trim() : text.trim();
        if (!prompt) continue;

        await sock.sendPresenceUpdate("composing", msg.key.remoteJid);

        const answer = await askAI(prompt);
        await sock.sendMessage(msg.key.remoteJid, { text: answer });

        await sock.sendPresenceUpdate("paused", msg.key.remoteJid);
      } catch (err) {
        logger.error(err);
      }
    }
  });
}

app.get("/", (_req, res) => {
  res.send(`<!doctype html>
<html lang="id">
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WA AI Experiment</title>
<style>
body{font-family:system-ui;margin:0;background:#111;color:#eee}
main{max-width:620px;margin:30px auto;padding:20px}
.card{background:#1d1d1d;border-radius:16px;padding:20px;margin:15px 0}
h1{font-size:25px}
.badge{display:inline-block;padding:7px 12px;border-radius:999px;background:#333}
img{max-width:280px;background:#fff;padding:12px;border-radius:12px}
code{background:#292929;padding:3px 6px;border-radius:6px}
small{color:#aaa}
button{padding:10px 14px;border:0;border-radius:10px;cursor:pointer}
</style>
</head>
<body>
<main>
<h1>🤖 WA AI Experiment</h1>
<div class="card">
  <b>Status:</b> <span id="status" class="badge">loading...</span>
  <p id="error"></p>
</div>
<div class="card" id="qrbox">
  <h3>Hubungkan WhatsApp</h3>
  <p>Jika QR muncul, buka WhatsApp → Perangkat tertaut → Tautkan perangkat.</p>
  <img id="qr" alt="QR WhatsApp" style="display:none">
  <p id="hint"><small>Menunggu QR...</small></p>
</div>
<div class="card">
  <h3>Mode bot</h3>
  <p>Perintah default: <code>!ai halo</code></p>
  <p>Untuk membalas semua pesan, set Environment Variable <code>AUTO_REPLY=true</code>.</p>
</div>
<div class="card">
  <h3>AI</h3>
  <p>Model: <code>${AI_MODEL}</code></p>
  <small>Jangan masukkan API key di source code. Simpan sebagai Environment Variable di hosting.</small>
</div>
<script>
async function update(){
  try{
    const r=await fetch('/api/status'); const d=await r.json();
    document.querySelector('#status').textContent=d.status;
    document.querySelector('#error').textContent=d.error||'';
    const img=document.querySelector('#qr'), hint=document.querySelector('#hint');
    if(d.qr){img.src=d.qr;img.style.display='block';hint.innerHTML='<small>Scan QR ini dengan WhatsApp.</small>'}
    else{img.style.display='none';hint.innerHTML='<small>QR tidak tersedia saat ini.</small>'}
  }catch(e){}
}
setInterval(update,3000); update();
</script>
</main>
</body>
</html>`);
});

app.get("/api/status", (_req, res) => {
  res.json({ status, qr: qrData, error: lastError });
});

app.listen(PORT, async () => {
  logger.info(`Dashboard running on port ${PORT}`);
  await startBot();
});
