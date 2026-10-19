# Yowtech Baileys

Fork komunitas berbasis Baileys untuk WhatsApp Web, dengan adapter auth state opsional, helper newsletter/JID, API kompatibilitas Alya-js, dan perbaikan store kontak. Ini bukan SDK resmi WhatsApp/Meta dan tidak berafiliasi dengan WhatsApp atau Meta.

[![npm version](https://img.shields.io/npm/v/yowtech)](https://www.npmjs.com/package/yowtech)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520-339933)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Rilis berikutnya: `1.0.4-rv` (kandidat PR; belum dipublish)

Perubahan terbaru:

- Menambahkan adapter auth state opsional untuk cache-manager dan MongoDB, dengan namespace sesi serta serialisasi buffer/protobuf.
- Menambahkan `resolveJid`/`resolveJids`, facade pengiriman pesan newsletter, dan polling analytics newsletter.
- Menambahkan `sock.ws.restart()` yang bounded/concurrency-safe, serta pewarisan timer ephemeral grup yang opt-in (`autoGroupEphemeral: true`).
- Menambahkan event MEX `limit-sharing.update` dan `community-owner.update` dengan parser defensif.
- Kandidat analytics dan event MEX belum diuji pada channel/akun WhatsApp live; uji di lingkungan staging sebelum produksi.
- Backport ditulis untuk arsitektur Yowtech; tidak mengimpor seluruh fork pembanding, dependency baru, atau mengubah fingerprint/protokol transport.

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

## Backport sistem dan helper tambahan

### Adapter auth state cache-manager dan MongoDB

Kedua adapter menerima objek backend yang sudah dibuat oleh aplikasi; paket `yowtech` tidak menambahkan dependency cache-manager atau MongoDB. Auth state berisi kredensial sensitif—amankan backend, batasi akses, dan jangan menulis nilainya ke log.

```js
import { makeCacheManagerAuthState } from 'yowtech'

const { state, saveCreds, clearState } = await makeCacheManagerAuthState(cache, 'bot-production')
const sock = makeWASocket({ auth: state })
sock.ev.on('creds.update', saveCreds)
```

Cache harus menyediakan `get`, `set`, dan `del`. `clearState()` juga memerlukan `cache.keys()` atau `cache.store.keys()` agar hanya key dengan prefix sesi tersebut yang dihapus. Adapter tidak menetapkan TTL sendiri; kebijakan expiry mengikuti backend cache. Untuk MongoDB gunakan collection driver resmi dan session key yang unik per bot; indeks unik `{ sessionId: 1, key: 1 }` disarankan. `clearState()` Mongo menghapus hanya dokumen dengan `sessionId` tersebut.

```js
import { useMongoAuthState } from 'yowtech'

const { state, saveCreds, clearState } = await useMongoAuthState(collection, 'bot-production')
const sock = makeWASocket({ auth: state })
sock.ev.on('creds.update', saveCreds)
```

Adapter ini menyediakan persistence, bukan distributed lock. Jangan menjalankan dua proses aktif yang menulis sesi WhatsApp yang sama tanpa koordinasi/lock pada aplikasi.

### Resolver JID dari konteks pesan

```js
import { resolveJid, resolveJids } from 'yowtech'

const recipient = await resolveJid(sock, message, explicitTarget)
if (recipient) await sock.sendMessage(recipient, { text: 'Halo' })

const recipients = await resolveJids(sock, message, [targetA, targetB])
```

Urutan kandidat adalah target eksplisit, mention, pengirim pesan kutipan, lalu sender/participant/JID pesan. Helper menormalisasi PN, mencoba pemetaan LID native dan metadata grup, serta mengembalikan `null` jika nomor tidak bisa dipastikan; ia tidak menebak nomor.

### Restart WebSocket dan timer ephemeral grup

```js
await sock.ws.restart()

const ephemeralSock = makeWASocket({ auth: state, autoGroupEphemeral: true })
```

`restart()` mengganti transport WebSocket yang dimiliki socket dan menunggu penutupan dengan timeout terbatas. Gunakan saat ada kebutuhan pemulihan eksplisit dan tetap pantau `connection.update`. `autoGroupEphemeral` default-nya mati agar perilaku lama tetap sama; bila aktif, pengiriman grup tanpa `options.ephemeralExpiration` akan mencoba mewarisi `ephemeralDuration` metadata grup. Metadata dicache singkat, nilai caller selalu menang, dan kegagalan lookup kembali ke pengiriman normal.

### Newsletter/channel messages dan analytics

```js
import { makeNewsletterUtils } from 'yowtech'

const newsletter = makeNewsletterUtils(sock)
await newsletter.sendNewsletterText(channelJid, 'Pembaruan hari ini')
await newsletter.sendNewsletterImage(channelJid, { url: 'https://example.com/poster.jpg' }, 'Poster')
await newsletter.sendNewsletterReact(channelJid, serverMessageId, '👍')

const updates = await sock.newsletterFetchUpdates(channelJid, 20, 0, 0)
// [{ serverId, views, reactions: [{ code, count }] }]
```

Facade juga menyediakan helper video/PTV, audio, dokumen, stiker, buttons, list, CTA URL, edit, dan delete. `newsletterFetchUpdates` hanya mengembalikan analytics; ia tidak mendekripsi atau mengunduh isi pesan. Bentuk stanza/response analytics dapat berubah di server WhatsApp—validasi pada channel staging sebelum diandalkan.

### Event MEX grup

```js
sock.ev.on('limit-sharing.update', update => console.log(update))
sock.ev.on('community-owner.update', update => console.log(update))
```

Event ini hanya diterbitkan bila payload MEX memenuhi struktur minimum; payload yang hilang atau malformed diabaikan dengan warning. Format MEX tidak terdokumentasi dan dapat berubah, jadi jangan menjadikannya satu-satunya sumber data otorisasi atau audit.

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
