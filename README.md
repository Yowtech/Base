# Yowtech Baileys

Fork komunitas berbasis Baileys untuk WhatsApp Web, dengan API tambahan kompatibilitas Alya-js dan perbaikan store kontak. Ini bukan SDK resmi WhatsApp/Meta dan tidak berafiliasi dengan WhatsApp atau Meta.

[![npm version](https://img.shields.io/npm/v/yowtech)](https://www.npmjs.com/package/yowtech)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520-339933)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Rilis terbaru: `1.0.3-rv`

Perubahan terbaru:

- In-memory store menyediakan `await store.contacts.getAll(limit?)` untuk mengambil kontak yang tersimpan sebagai array.
- Dokumentasi API dan batasan penggunaan diperbarui.
- Tidak ada penggabungan seluruh ZapO-js: ZapO adalah implementasi WhatsApp Web mandiri dengan arsitektur berbeda. Perubahan `getAll` di sini ditulis untuk store Baileys/Yowtech dan tidak mengimpor kode atau dependency ZapO.
- Tidak ada perubahan fingerprint, transport, atau protokol jaringan.

Rincian perubahan tersedia di [CHANGELOG.md](CHANGELOG.md).

## Persyaratan

- Node.js **20 atau lebih baru**.
- Akun WhatsApp yang dapat dipasangkan ke WhatsApp Web.
- Penggunaan mengikuti ketentuan WhatsApp dan hukum setempat. Hindari pengiriman massal yang tidak diminta; pembatasan akun tetap ditentukan oleh WhatsApp.

## Instalasi

```bash
npm install yowtech
```

## Mulai cepat

Simpan kredensial hanya pada penyimpanan lokal yang aman. Jangan commit folder `auth_info` ke Git.

```js
import makeWASocket, { useMultiFileAuthState } from 'yowtech'

const { state, saveCreds } = await useMultiFileAuthState('./auth_info')
const sock = makeWASocket({ auth: state })

sock.ev.on('creds.update', saveCreds)
sock.ev.on('connection.update', ({ connection, qr }) => {
  if (qr) console.log('Pindai QR dengan WhatsApp:', qr)
  if (connection) console.log('Status koneksi:', connection)
})

sock.ev.on('messages.upsert', async ({ messages, type }) => {
  if (type !== 'notify') return
  const message = messages[0]
  if (message?.message?.conversation === 'ping') {
    await sock.sendMessage(message.key.remoteJid, { text: 'pong' })
  }
})
```

API utama mengikuti pola `makeWASocket` Baileys dan mencakup socket/event emitter, pesan, grup/komunitas, media, newsletter, store, WABinary, dan WAProto yang diekspor paket. Lihat deklarasi pada `lib/` dan `WAProto/` untuk tanda tangan lengkap setiap API.

## In-memory store dan `contacts.getAll`

`makeInMemoryStore()` mengumpulkan chat, kontak, pesan, metadata grup, presence, label, dan asosiasi label dari event socket.

```js
import makeWASocket, { makeInMemoryStore, useMultiFileAuthState } from 'yowtech'

const store = makeInMemoryStore()
const { state, saveCreds } = await useMultiFileAuthState('./auth_info')
const sock = makeWASocket({ auth: state })
store.bind(sock.ev)
sock.ev.on('creds.update', saveCreds)

// Kontak tetap dapat diakses dengan pola yang sudah ada:
const contact = store.contacts['123456789@s.whatsapp.net']

// API baru, async dan mengembalikan array snapshot:
const allContacts = await store.contacts.getAll()
const firstHundred = await store.contacts.getAll(100)
```

`limit` boleh tidak diberikan. Jika diberikan, nilainya harus bilangan bulat positif yang aman (`Number.isSafeInteger`). Nilai `0`, negatif, desimal, `NaN`, dan tak hingga akan ditolak. Fungsi ini hanya mengembalikan kontak yang saat itu ada di in-memory store; ia tidak meminta daftar kontak baru dari server. Seperti store Baileys in-memory lainnya, data di dalamnya tidak persisten kecuali aplikasi menyimpan dan memulihkannya sendiri.

## API tambahan kompatibilitas Alya-js

Setiap socket hasil `makeWASocket()` memperoleh namespace additive `sock.alya`. Perubahan ini tidak menghapus API Baileys yang sudah ada.

### `noSelfSync`

Opsional untuk mencegah salinan sinkronisasi ke perangkat tertaut pada pengiriman tertentu:

```js
await sock.sendMessage(jid, { text: 'Pesan tanpa salinan ke perangkat tertaut' }, {
  noSelfSync: true
})
```

Tanpa opsi ini perilaku sebelumnya dipertahankan. Opsi diteruskan melalui jalur album media dan retry terkait. Chat ke akun sendiri tetap diperlakukan sebagai self-chat.

### Status

```js
const entries = sock.alya.status.list({
  owner: ownerJid,
  kinds: ['image', 'video'],
  limit: 20
})

await sock.alya.status.like({ statusId, owner: ownerJid })
await sock.alya.status.react({ statusId, owner: ownerJid, emoji: '🔥' })

const result = await sock.alya.status.apply({
  targets: [ownerJid],
  action: 'react',
  emoji: '💜',
  intervalMs: 500
})

const downloaded = await sock.alya.status.download({
  chatJid: 'status@broadcast',
  kinds: ['image'],
  limit: 10
})
```

Cache status media bersifat in-memory, default maksimum 1.000 entri selama 24 jam, dan hanya melihat pesan yang diterima ketika socket berjalan. Hasil unduhan berbentuk `{ entry, bytes }[]`. `maxBytes` diperiksa setelah setiap file selesai diunduh, bukan sebagai batas memori sebelum download.

### Status grup dan blocklist

```js
await sock.alya.group.deleteStatus({
  groupJid,
  messageId,
  participant: authorJid,
  options: { noSelfSync: true }
})

await sock.alya.privacy.sendBlockList({
  to: destinationJid,
  title: 'Blocked contacts'
})
```

WhatsApp tetap menerapkan izin admin grup saat status grup dihapus.

### Evaluasi tautan grup

Helper ini **tidak** memasang moderasi otomatis. Panggil secara eksplisit dari handler aplikasi jika memang dikehendaki:

```js
const result = await sock.alya.links.evaluateGroupLink(message, {
  kinds: [
    'tiktok', 'instagram', 'facebook', 'whatsapp_channel',
    'whatsapp_group_invite', 'telegram', 'generic'
  ]
})

if (result.action === 'deleted') console.log('Tautan dihapus:', result.url)
```

Admin/pemilik grup diizinkan secara default. Perilaku dapat disesuaikan lewat `isAllowedSender` atau `deleteMessage: false`. Jangan memasang handler duplikat jika aplikasi sudah memiliki aturan tautan sendiri.

### Newsletter status dan call-log

Socket menyediakan metode newsletter native seperti `newsletterSendStatus`, `newsletterReactStatus`, `newsletterRevokeStatus`, dan `newsletterFetchStatuses`; `sock.alya.newsletter` menambahkan helper untuk unggah media dan pola akses yang konsisten.

```js
sock.ev.on('alya.call-log', record => {
  console.log(record.callId, record.result, record.duration)
})
```

Pemanggilan `sendStatus({ resolveServerId: true })` menunggu ID server hingga 8 detik secara default; WhatsApp mungkin tidak mengirim ID dalam jangka tersebut.

Lihat [ALYA_PORT.md](ALYA_PORT.md) untuk rincian opsi, contoh tambahan, dan batas validasi.

## Pengujian

```bash
npm install
npm test
```

Tes lokal memverifikasi helper store dan kompatibilitas. Tes tersebut tidak menggantikan validasi dengan akun staging. Uji newsletter, retry, penghapusan status grup, dan penerimaan call-log pada akun staging sebelum dipakai di produksi. Jangan gunakan kredensial WhatsApp pribadi sebagai data tes yang dibagikan.

## Provenance dan lisensi

Paket ini adalah fork komunitas dari `PROTECTION-JAVA/Protection`, yang merupakan turunan ekosistem Baileys. Perubahan fork Yowtech bersifat additive; lihat riwayat Git untuk asal tiap perubahan. MIT notices yang ada di [LICENSE](LICENSE) wajib tetap disertakan. Mengganti badge atau teks branding proyek tidak menghapus hak cipta maupun kewajiban atribusi upstream.

ZapO-js (`rexxzyid/zapo`) adalah proyek terpisah dengan implementasi, transport, dan model store yang berbeda. Versi ini hanya mengadaptasi kebutuhan kecil `contacts.getAll` ke store Baileys secara lokal; tidak menggunakan source tree ZapO atau dependency-nya. Jangan menganggap paket ini memiliki API atau fitur ZapO yang belum didokumentasikan di sini.

## Kontribusi dan pelaporan masalah

Laporkan masalah melalui [Issues](https://github.com/Yowtech/Base/issues) dengan versi Node.js, versi paket, log yang sudah disensor, dan langkah reproduksi minimal. Jangan unggah QR, session credentials, nomor telepon, token, atau isi pesan pribadi.
