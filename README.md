# 🤖 WA AI Experiment

Bot WhatsApp AI sederhana yang bisa dideploy dari GitHub ke hosting Node.js.

## Fitur

- Baileys WhatsApp multi-device
- Login WhatsApp lewat QR
- Dashboard web
- Auto reconnect
- `!ai pertanyaan`
- Mode auto-reply
- OpenRouter / model Qwen gratis
- Bisa dijalankan tanpa PC setelah deploy

## 1. Buat API key

Gunakan OpenRouter dan buat API key.

Model default:
`qwen/qwen3.8-27b:free`

Model free bisa berubah/terbatas, jadi jangan anggap kuotanya tidak terbatas.

## 2. Environment Variables

Tambahkan di hosting:

```text
OPENROUTER_API_KEY=isi_api_key_kamu
AI_MODEL=qwen/qwen3.8-27b:free
AUTO_REPLY=false
SYSTEM_PROMPT=Kamu adalah asisten AI WhatsApp yang ramah. Jawab dalam bahasa Indonesia dan jangan terlalu panjang.
```

Jangan pernah menaruh API key langsung di `bot.js`.

## 3. Deploy

Build command:

```text
npm install
```

Start command:

```text
npm start
```

Port menggunakan `PORT` dari hosting.

## 4. Hubungkan WhatsApp

Buka URL website bot setelah deploy.

Saat QR muncul:

WhatsApp → Setelan → Perangkat tertaut → Tautkan perangkat → scan QR.

Setelah tersambung, status dashboard menjadi `connected`.

## 5. Tes

Dengan `AUTO_REPLY=false`, kirim:

```text
!ai halo, kamu siapa?
```

Dengan `AUTO_REPLY=true`, bot akan menjawab pesan teks masuk secara otomatis.

## Catatan penting

Free hosting tidak menjamin uptime 24/7. Pada Render Free, service dapat sleep setelah 15 menit tanpa traffic inbound dan filesystem lokal bersifat ephemeral. Karena itu `auth_info` pada contoh ini belum cocok untuk persistence jangka panjang di free hosting.

Untuk eksperimen, ini cukup sebagai versi pertama. Versi berikutnya bisa memakai database untuk menyimpan session WhatsApp agar lebih tahan restart/redeploy.

Gunakan akun/nomor WhatsApp yang memang kamu miliki dan pahami bahwa automasi WhatsApp non-resmi dapat berisiko terkena pembatasan akun.
