# Changelog

Perubahan penting untuk paket `yowtech` dicatat di sini.

## 1.0.5-rv — kandidat fitur tambahan

- Menambahkan `sock.sendImagePoll(jid, { name, options: [{ name, image }], selectableCount? })`; helper mengunggah gambar per opsi, mengirim poll image V3, dan mengaitkan setiap media dengan parent poll. Poll teks lama tidak diubah.
- Menambahkan `sock.sendInlineWebUI(...)` dan utility `buildWebuiMessage`/`sendInlineWebUI`. Payload Rich WebUI dibatasi 64 KiB HTML dan diserialisasi sebagai protobuf bytes/enum Yowtech.
- Menambahkan `sock.richMenu(...)` dengan builder `buildRichMenuMessage`/`sendRichMenu` untuk CTA, carousel/row, gambar, disclaimer, dan footer URL.
- Menambahkan `A2UI` builder deklaratif serta `sock.sendA2UI(...)`/`sendA2UIWidget(...)`; menyelaraskan `BloksWidget.fallback = 4` pada source schema dengan generated runtime yang sudah mendukung field tersebut.
- Adaptasi fitur dilakukan dengan izin pengguna dari [RennZSync/baileys](https://github.com/RennZSync/baileys), lalu disusun ulang agar sesuai dengan WAProto dan send pipeline Yowtech.
- Seluruh API baru bersifat opt-in; tidak mengganti `sendMessage`, noSelfSync, newsletter, atau adapter auth yang ada. Tidak ada dependency baru atau penggantian WAProto generated files.
- Tes unit/protobuf/relay lokal lulus 57/57 dengan mock upload/relay. Rendering, penerimaan server, dan perilaku lintas versi klien WhatsApp belum diverifikasi pada akun live.

## 1.0.4-rv — kandidat PR; belum dipublish

- Menambahkan `makeCacheManagerAuthState(cache, sessionKey)` dan `useMongoAuthState(collection, sessionKey)` sebagai adapter auth state opsional. Keduanya memakai BufferJSON, pemulihan protobuf AppState, isolasi sesi, dan `clearState`; tidak menambah dependency backend.
- Menambahkan `resolveJid` dan `resolveJids` untuk target/mention/pesan kutipan/sender, dengan pemetaan LID native dan fallback metadata grup. Hasil yang tak dapat dipastikan adalah `null`, bukan nomor tebakan.
- Menambahkan `makeNewsletterUtils(sock)` untuk convenience send/edit/delete/reaction newsletter, serta `sock.newsletterFetchUpdates(jid, count, after, since)` yang mengembalikan views dan reaksi tanpa mengunduh isi pesan.
- Menambahkan `sock.ws.restart()` dengan timeout penutupan terbatas, perlindungan restart bersamaan, dan penyaringan event dari koneksi lama.
- Menambahkan `autoGroupEphemeral: true` sebagai opsi opt-in. Durasi ephemeral grup diwarisi hanya ketika pemanggil tidak memberi `ephemeralExpiration`; metadata dicache singkat dan kegagalan lookup tidak menghalangi pengiriman normal.
- Menambahkan event `limit-sharing.update` dan `community-owner.update` dari payload MEX yang valid; parser mengabaikan payload malformed.
- Analytics newsletter dan event MEX bergantung pada stanza/payload server yang tidak terdokumentasi dan belum diuji pada akun/channel live. Validasi pada staging sebelum produksi.
- Mempertahankan API lama secara additive. Tidak menggabungkan seluruh fork sumber, tidak menambah dependency baru, dan tidak mengubah fingerprint atau protokol transport.

## 1.0.3-rv — persiapan rilis

- Menambahkan `store.contacts.getAll(limit?)` pada in-memory store. API ini mengembalikan snapshot array kontak; `limit` harus bilangan bulat positif yang aman. Nilai invalid ditolak dengan error `invalid query limit`.
- Menjaga kompatibilitas lama: kontak tetap dapat diakses melalui `store.contacts[jid]`; metode `getAll` non-enumerable sehingga tidak masuk ke `Object.keys()` atau serialisasi store.
- Menyegarkan dokumentasi paket dan API kompatibilitas Alya-js, termasuk batasan yang belum diuji pada akun WhatsApp langsung.
- Membersihkan placeholder satu huruf dan arsip ZIP lama yang tidak digunakan dari repo/paket.
- Pembaruan `getAll` merupakan adaptasi kecil, target-native, yang terinspirasi dari API store ZapO-js. Kode ZapO, transport, protokol, dan paket-paketnya tidak digabungkan atau dijadikan dependency.
- Tidak mengubah protokol, identitas client jaringan, autentikasi, atau fingerprint koneksi.

## 1.0.2-rv

- Menambahkan permukaan kompatibilitas Alya-js yang bersifat additive melalui `sock.alya`.
- Mendukung opsi `noSelfSync` untuk pengiriman pesan, termasuk jalur album/retry.
- Menambahkan helper status, penghapusan status grup, pengiriman blocklist, evaluasi tautan grup secara eksplisit, helper status newsletter, dan normalisasi event call-log.
- Memperkeras pemeriksaan rilis npm manual.

Lihat [README.md](README.md) untuk panduan penggunaan dan [ALYA_PORT.md](ALYA_PORT.md) untuk catatan kompatibilitas yang lebih rinci.
