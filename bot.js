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

// Official Qwen / Alibaba Cloud Model Studio.
// Singapore example:
// https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1
const QWEN_BASE_URL = process.env.QWEN_BASE_URL || "";
const QWEN_API_KEY = process.env.DASHSCOPE_API_KEY || "";
const QWEN_MODEL = process.env.QWEN_MODEL || "qwen3.8-max";

const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT ||
  "Kamu adalah asisten AI WhatsApp yang ramah. Jawab dalam bahasa Indonesia, santai, singkat, dan membantu.";

let sock;
let qrData = null;
let status = "starting";
let lastError = null;
let reconnectTimer = null;

const logger = P({ level: process.env.LOG_LEVEL || "info" });

async function askQwen(userText) {
  if (!QWEN_API_KEY) {
    return "Qwen belum dikonfigurasi. Tambahkan DASHSCOPE_API_KEY di Environment Variables.";
  }

  if (!QWEN_BASE_URL) {
    return "Qwen belum dikonfigurasi. Tambahkan QWEN_BASE_URL dengan endpoint Model Studio kamu.";
  }

  const endpoint = `${QWEN_BASE_URL.replace(/\/+$/, "")}/chat/completions`;

  const r = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${QWEN_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: QWEN_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userText }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });

  const body = await r.text();

  if (!r.ok) {
    throw new Error(`Qwen ${r.status}: ${body.slice(0, 500)}`);
  }

  const data = JSON.parse(body);
  return data?.choices?.[0]?.message?.content?.trim() ||
    "Qwen tidak memberikan jawaban.";
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
  } catch {}

  sock = makeWASocket({
    auth: state,
    version,
    logger,
    printQRInTerminal: false,
    browser: ["WA Qwen Experiment", "Chrome", "1.0.0"],
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

        const autoReply = process.env.AUTO_REPLY === "true";
        const isCommand = text.toLowerCase().startsWith("!qwen ");

        if (!autoReply && !isCommand) continue;

        const prompt = isCommand ? text.slice(6).trim() : text.trim();
        if (!prompt) continue;

        await sock.sendPresenceUpdate("composing", msg.key.remoteJid);

        const answer = await askQwen(prompt);
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
<title>WA Qwen Experiment</title>
<style>
body{font-family:system-ui;margin:0;background:#111;color:#eee}
main{max-width:620px;margin:30px auto;padding:20px}
.card{background:#1d1d1d;border-radius:16px;padding:20px;margin:15px 0}
h1{font-size:25px}.badge{display:inline-block;padding:7px 12px;border-radius:999px;background:#333}
img{max-width:280px;background:#fff;padding:12px;border-radius:12px}
code{background:#292929;padding:3px 6px;border-radius:6px}
small{color:#aaa}
</style>
</head>
<body>
<main>
<h1>🤖 WA Qwen Experiment</h1>
<div class="card">
  <b>WhatsApp:</b> <span id="status" class="badge">loading...</span>
  <p id="error"></p>
</div>
<div class="card">
  <h3>Hubungkan WhatsApp</h3>
  <p>Jika QR muncul: WhatsApp → Perangkat tertaut → Tautkan perangkat.</p>
  <img id="qr" alt="QR WhatsApp" style="display:none">
  <p id="hint"><small>Menunggu QR...</small></p>
</div>
<div class="card">
  <h3>Qwen</h3>
  <p>Model: <code>${QWEN_MODEL}</code></p>
  <p>Mode tes: kirim <code>!qwen halo</code>.</p>
  <small>API key hanya disimpan sebagai Environment Variable di hosting.</small>
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
