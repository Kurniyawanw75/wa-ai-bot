# 🤖 WA Qwen Bot

Bot WhatsApp AI menggunakan **Qwen resmi melalui Alibaba Cloud Model Studio**, bukan OpenRouter.

## Arsitektur

WhatsApp → Baileys → Bot Node.js → Qwen Model Studio → jawaban WhatsApp

## Environment Variables

### DASHSCOPE_API_KEY

API key dari Alibaba Cloud Model Studio.

### QWEN_BASE_URL

Gunakan endpoint OpenAI-compatible sesuai region/workspace.

Contoh Singapore:

```text
https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1
```

Ganti `{WorkspaceId}` dengan Workspace ID milikmu.

### QWEN_MODEL

Default:

```text
qwen3.8-max
```

Model yang tersedia dapat berbeda menurut region/account. Gunakan model yang tersedia di Model Studio kamu.

### AUTO_REPLY

Pertama gunakan:

```text
false
```

Tes dengan:

```text
!qwen halo
```

Setelah berhasil, ubah menjadi:

```text
true
```

agar bot menjawab semua pesan teks masuk.

## Deploy

Build:

```text
npm install
```

Start:

```text
npm start
```

Port menggunakan `PORT` dari hosting.

## Cara mendapatkan API key

Alibaba Cloud Model Studio → aktifkan Model Studio → API Key → Create API key.

Jangan pernah memasukkan API key ke GitHub/source code.

## Catatan

Model Studio menyediakan API Qwen resmi dan OpenAI-compatible API. Endpoint dan API key bersifat regional. Singapore, misalnya, menggunakan domain workspace-specific.

Free hosting tidak menjamin uptime 24/7. Filesystem lokal juga dapat hilang saat instance/redeploy tertentu, sehingga versi produksi sebaiknya menggunakan persistence/database untuk auth session WhatsApp.

Gunakan nomor WhatsApp yang kamu miliki dan pahami bahwa koneksi WhatsApp melalui library non-resmi seperti Baileys dapat memiliki risiko pembatasan akun.
