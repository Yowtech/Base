import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { installAlyaCompatibility, findFirstAlyaLink, parseCallLogRecord } from '../lib/Socket/alya-compat.js'

function createFakeSocket() {
    const ev = new EventEmitter()
    const sent = []
    const sock = {
        ev,
        sent,
        sendMessage: async (...args) => { sent.push(args); return { key: { id: 'sent' } } },
        groupMetadata: async () => ({
            owner: 'admin@s.whatsapp.net',
            participants: [
                { id: 'admin@s.whatsapp.net', admin: 'superadmin' },
                { id: 'member@s.whatsapp.net' }
            ]
        }),
        fetchBlocklist: async () => ['blocked@s.whatsapp.net']
    }
    return sock
}

test('link matcher recognizes Alya-supported link families', () => {
    assert.equal(findFirstAlyaLink('https://instagram.com/example')?.kind, 'instagram')
    assert.equal(findFirstAlyaLink('https://chat.whatsapp.com/AbCd')?.kind, 'whatsapp_group_invite')
    assert.equal(findFirstAlyaLink('no link here'), null)
})

test('call-log parser normalizes protobuf enums and long values', () => {
    const call = parseCallLogRecord({
        callId: 'c-1', callResult: 4, callType: 0,
        startTime: { toNumber: () => 1234 }, duration: 9, isIncoming: true,
        participants: [{ userJid: 'a@s.whatsapp.net', callResult: 0 }]
    })
    assert.equal(call.result, 'MISSED')
    assert.equal(call.startTime, 1234)
    assert.deepEqual(call.participants[0], { jid: 'a@s.whatsapp.net', callResult: 'CONNECTED' })
    assert.equal(parseCallLogRecord({}), null)
})

test('status cache, list, reaction, and apply use socket events and sendMessage', async () => {
    const sock = createFakeSocket()
    installAlyaCompatibility(sock)
    sock.ev.emit('messages.upsert', {
        messages: [{
            key: { remoteJid: 'status@broadcast', participant: 'author@s.whatsapp.net', id: 's-1' },
            messageTimestamp: Math.floor(Date.now() / 1000),
            message: { imageMessage: { mimetype: 'image/jpeg', caption: 'hello' } }
        }]
    })
    const [entry] = sock.alya.status.list({ owner: 'author@s.whatsapp.net' })
    assert.equal(entry.id, 's-1')
    assert.equal(entry.mediaKind, 'image')
    await sock.alya.status.like({ statusId: 's-1', owner: 'author@s.whatsapp.net' })
    assert.equal(sock.sent[0][0], 'status@broadcast')
    assert.equal(sock.sent[0][1].react.text, '❤️')
    assert.deepEqual(sock.sent[0][2].statusJidList, ['author@s.whatsapp.net'])
    const summary = await sock.alya.status.apply({ targets: ['author@s.whatsapp.net'], action: 'react', emoji: '🔥' })
    assert.deepEqual(summary, { attempted: 1, reacted: 1, failed: [] })
})

test('group-link helper deletes non-admin and preserves admin messages', async () => {
    const sock = createFakeSocket()
    installAlyaCompatibility(sock)
    const message = {
        key: { remoteJid: 'g@g.us', participant: 'member@s.whatsapp.net', id: 'm-1' },
        message: { conversation: 'join https://t.me/example' }
    }
    const result = await sock.alya.links.evaluateGroupLink(message)
    assert.equal(result.action, 'deleted')
    assert.equal(sock.sent[0][1].delete.participant, 'member@s.whatsapp.net')
    const adminMessage = { ...message, key: { ...message.key, participant: 'admin@s.whatsapp.net' } }
    assert.equal((await sock.alya.links.evaluateGroupLink(adminMessage)).action, 'allowed')
})

test('privacy blocklist helper reads native blocklist API then sends a report', async () => {
    const sock = createFakeSocket()
    installAlyaCompatibility(sock)
    await sock.alya.privacy.sendBlockList({ to: 'owner@s.whatsapp.net' })
    assert.equal(sock.sent[0][0], 'owner@s.whatsapp.net')
    assert.match(sock.sent[0][1].text, /blocked@s.whatsapp.net/)
})
