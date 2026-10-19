# Changelog

Perubahan penting untuk paket `yowtech` dicatat di sini.

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
