# Yowtech Baileys — Alya-js compatibility port

This is a **Baileys/Yowtech package update**, not a WhatsApp bot/SC project. The compatibility methods are installed by Yowtech's public `makeWASocket()` factory and are available on the returned socket as `sock.alya`.

Package version: `1.0.2-rv`. Node.js 20 or newer is required.

## Install or test the fork package

From the consumer project, install the packaged fork tarball:

```bash
npm install ./yowtech-1.0.2-rv.tgz
```

To run the fork's local tests from this source tree:

```bash
npm install
npm test
```

## Manual npm publish

The repository workflow publishes only `yowtech@1.0.2-rv`, and only when manually run from `main` with the exact confirmation string. Before running it:

1. In the npm account that owns `yowtech`, create a granular/automation token with publish access to that package.
2. In GitHub, open **Settings → Secrets and variables → Actions → New repository secret**. Set the name to `NPM_TOKEN` and paste the token as its value. Never commit the token or send it in chat.
3. Open **Actions → Publish Yowtech → Run workflow**, select `main`, and enter exactly `yowtech@1.0.2-rv` in `confirm_publish`.

The workflow checks the package name/version, installs dependencies, runs tests, checks the package contents, refuses to publish if that version already exists, then publishes publicly with provenance. Do not run it until `NPM_TOKEN` is configured for an npm account with publish rights.

## Added public APIs

| Feature | Public socket API |
|---|---|
| Suppress sync to the sender's paired devices | `sock.sendMessage(jid, content, { noSelfSync: true })` |
| List/download/react/like/apply to observed media statuses | `sock.alya.status.*` |
| Revoke a group status | `sock.alya.group.deleteStatus(...)` |
| Send the current blocklist to a chat | `sock.alya.privacy.sendBlockList(...)` |
| Moderate group links when explicitly called | `sock.alya.links.evaluateGroupLink(...)` |
| Publish/react/revoke/fetch newsletter statuses | `sock.alya.newsletter.*` (backed by native Yowtech newsletter methods) |
| Parse call-log records | `sock.alya.parseCallLogRecord(record)` and `sock.ev` event `alya.call-log` |

### `noSelfSync`

```js
await sock.sendMessage(jid, { text: 'No paired-device copy' }, { noSelfSync: true })
```

This is opt-in; without the option Yowtech's previous behavior is retained. The option is propagated to album media and the retry suppression path. A message addressed to the same account is still treated as a self-chat.

### Status

```js
const entries = sock.alya.status.list({
  chats: ['status@broadcast'],
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
const files = await sock.alya.status.download({
  chatJid: 'status@broadcast',
  kinds: ['image'],
  limit: 10
})
```

The in-memory status cache contains at most 1,000 media statuses for 24 hours by default; it only sees messages delivered while the socket is running. Downloads return `{ entry, bytes }[]`. `maxBytes` is checked after downloading each file, so it is not a pre-download memory cap.

### Group status and blocklist

```js
await sock.alya.group.deleteStatus({
  groupJid,
  messageId,
  participant: authorJid,
  options: { noSelfSync: true }
})

await sock.alya.privacy.sendBlockList({ to: destinationJid, title: 'Blocked contacts' })
```

WhatsApp's current group-admin permissions still apply to status revocation.

### Link moderation

The helper does not install an automatic moderation policy. Call it from the consumer's message handler when desired:

```js
const result = await sock.alya.links.evaluateGroupLink(message, {
  kinds: ['tiktok', 'instagram', 'facebook', 'whatsapp_channel', 'whatsapp_group_invite', 'telegram', 'generic']
})
if (result.action === 'deleted') console.log(result.url)
```

Group admins/owners are allowed by default. Supply `isAllowedSender` or `deleteMessage: false` to customize the decision behavior. Do not register duplicate handlers if the consuming application already has its own link policy.

### Newsletter status and call log

The native socket methods include `newsletterSendStatus`, `newsletterReactStatus`, `newsletterRevokeStatus`, and `newsletterFetchStatuses`. The `sock.alya.newsletter` convenience namespace adds media upload and consistent access to those methods. `sendStatus({ resolveServerId: true })` polls the channel for up to 8 seconds by default; WhatsApp may not return the server ID within that period.

```js
sock.ev.on('alya.call-log', record => {
  console.log(record.callId, record.result, record.duration)
})
```

## Validation boundary

The package tests cover the local status/link/blocklist/call-log helpers, and static checks plus protobuf round-trip checks cover the vendor changes. No live WhatsApp account was connected; test newsletter stanzas, retries, group-status revocation, and real call-log delivery on a staging account before production use.
