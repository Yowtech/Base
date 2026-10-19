import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveJid, resolveJids } from '../lib/Utils/resolve-jid.js'

const fakeSocket = ({ native, metadata, metadataError = false } = {}) => {
    const calls = []
    const conn = {
        signalRepository: {
            lidMapping: {
                async getPNForLID(lid) {
                    calls.push(['native', lid])
                    return typeof native === 'function' ? native(lid) : native ?? null
                }
            }
        },
        async groupMetadata(chat) {
            calls.push(['metadata', chat])
            if (metadataError) {
                throw new Error('metadata unavailable')
            }
            return typeof metadata === 'function' ? metadata(chat) : metadata ?? { participants: [] }
        }
    }
    return { conn, calls }
}

test('resolveJid follows explicit target, mention, quoted sender/participant, sender, then jid priority', async () => {
    const message = {
        mentionedJid: ['222@s.whatsapp.net'],
        quoted: { sender: '333@s.whatsapp.net', participant: '444@s.whatsapp.net' },
        sender: '555@s.whatsapp.net',
        jid: '666@s.whatsapp.net'
    }

    assert.equal(await resolveJid({}, message, '111@s.whatsapp.net'), '111@s.whatsapp.net')
    assert.equal(await resolveJid({}, message), '222@s.whatsapp.net')
    assert.equal(await resolveJid({}, { ...message, mentionedJid: [] }), '333@s.whatsapp.net')
    assert.equal(await resolveJid({}, { ...message, mentionedJid: [], quoted: { participant: '444@s.whatsapp.net' } }), '444@s.whatsapp.net')
    assert.equal(await resolveJid({}, { sender: '555@s.whatsapp.net', jid: '666@s.whatsapp.net' }), '555@s.whatsapp.net')
    assert.equal(await resolveJid({}, { jid: '666@s.whatsapp.net' }), '666@s.whatsapp.net')
})

test('resolveJid adds the PN domain only to bare numeric strings and rejects other domains', async () => {
    assert.equal(await resolveJid({}, {}, '123456789'), '123456789@s.whatsapp.net')
    assert.equal(await resolveJid({}, {}, '123456789@s.whatsapp.net'), '123456789@s.whatsapp.net')
    assert.equal(await resolveJid({}, {}, '123456789@hosted'), '123456789@hosted')
    assert.equal(await resolveJid({}, {}, '123456789@c.us'), null)
    assert.equal(await resolveJid({}, {}, '123456789@g.us'), null)
})

test('resolveJid uses the native LID mapping before group metadata', async () => {
    const { conn, calls } = fakeSocket({ native: '987654@s.whatsapp.net' })
    const result = await resolveJid(conn, { chat: 'group@g.us' }, '12345@lid')
    assert.equal(result, '987654@s.whatsapp.net')
    assert.deepEqual(calls, [['native', '12345@lid']])
})

test('resolveJid supports hosted LID mappings', async () => {
    const { conn, calls } = fakeSocket({ native: '987654@hosted' })
    assert.equal(await resolveJid(conn, {}, '12345@hosted.lid'), '987654@hosted')
    assert.deepEqual(calls, [['native', '12345@hosted.lid']])
})

test('resolveJid falls back to matching group participant fields and survives metadata errors', async () => {
    const { conn, calls } = fakeSocket({
        native: null,
        metadata: {
            participants: [
                { id: '111@s.whatsapp.net', lid: '99999@lid' },
                { id: '222@lid', phoneNumber: '222222@s.whatsapp.net' },
                { id: '333@lid', phoneNumber: '333333' }
            ]
        }
    })

    assert.equal(await resolveJid(conn, { chat: 'group@g.us' }, '99999@lid'), '111@s.whatsapp.net')
    assert.equal(await resolveJid(conn, { chat: 'group@g.us' }, '222@lid'), '222222@s.whatsapp.net')
    assert.equal(await resolveJid(conn, { chat: 'group@g.us' }, '333@lid'), '333333@s.whatsapp.net')
    assert.deepEqual(calls, [
        ['native', '99999@lid'],
        ['metadata', 'group@g.us'],
        ['native', '222@lid'],
        ['metadata', 'group@g.us'],
        ['native', '333@lid'],
        ['metadata', 'group@g.us']
    ])

    const failing = fakeSocket({ metadataError: true })
    assert.equal(await resolveJid(failing.conn, { chat: 'group@g.us' }, '123@lid'), null)
})

test('resolveJid validates null and non-string inputs without claiming unavailable numbers', async () => {
    assert.equal(await resolveJid(null, null, null), null)
    assert.equal(await resolveJid({}, {}, 123), null)
    assert.equal(await resolveJid({}, {}, {}), null)
    assert.equal(await resolveJid({}, { sender: 'not-a-jid' }), null)
    assert.equal(await resolveJid({}, { sender: '123@lid' }), null)
})

test('resolveJids returns an ordered Promise batch using a fake socket', async () => {
    const { conn } = fakeSocket({ native: lid => lid === '20@lid' ? '200@s.whatsapp.net' : null })
    const result = await resolveJids(conn, { chat: 'group@g.us' }, ['10', '20@lid', null, '30@s.whatsapp.net'])
    assert.deepEqual(result, [
        '10@s.whatsapp.net',
        '200@s.whatsapp.net',
        null,
        '30@s.whatsapp.net'
    ])
    assert.deepEqual(await resolveJids(conn, {}), [])
})
