import test from 'node:test';
import assert from 'node:assert/strict';
import { makeNewsletterUtils, normalizeNewsletterJid } from '../lib/Utils/messages-newsletter.js';
import { parseNewsletterUpdates } from '../lib/Socket/newsletter.js';

test('newsletter utility normalizes bare ids and rejects non-newsletter domains', () => {
    assert.equal(normalizeNewsletterJid('12345'), '12345@newsletter');
    assert.equal(normalizeNewsletterJid('12345@newsletter'), '12345@newsletter');
    assert.throws(() => normalizeNewsletterJid('12345@s.whatsapp.net'), /bare id or @newsletter/);
});

test('newsletter wrappers forward native content and reactions without network requests', async () => {
    const sent = [];
    const reactions = [];
    const conn = {
        sendMessage: async (...args) => (sent.push(args), args),
        newsletterReactMessage: async (...args) => (reactions.push(args), undefined)
    };
    const utils = makeNewsletterUtils(conn);
    await utils.sendNewsletterText('42', 'hello');
    await utils.sendNewsletterImage('42@newsletter', 'https://example.test/a.jpg', 'caption');
    await utils.sendNewsletterButtons('42', 'choose', [{ id: 'a', text: 'A' }]);
    await utils.sendNewsletterCtaUrl('42', 'visit', 'https://example.test', 'Open');
    await utils.sendNewsletterReact('42', '17', '❤️');
    assert.deepEqual(sent[0], ['42@newsletter', { text: 'hello' }, {}]);
    assert.deepEqual(sent[1], ['42@newsletter', { image: { url: 'https://example.test/a.jpg' }, caption: 'caption' }, {}]);
    assert.deepEqual(sent[2][1], { text: 'choose', buttons: [{ id: 'a', text: 'A' }] });
    assert.equal(sent[3][1].nativeFlow[0].name, 'cta_url');
    assert.deepEqual(reactions, [['42@newsletter', '17', '❤️']]);
    assert.throws(() => utils.sendNewsletterButtons('42', 'too many', [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]), /1\.\.3/);
});

test('newsletter update parser defaults malformed analytics and skips invalid reactions', () => {
    assert.deepEqual(parseNewsletterUpdates(undefined), []);
    assert.deepEqual(parseNewsletterUpdates({ tag: 'iq', content: [] }), []);
    assert.deepEqual(parseNewsletterUpdates({ tag: 'iq', content: [null, { tag: 'message_updates', content: [null] }] }), []);
    const response = {
        tag: 'iq',
        content: [{
            tag: 'message_updates', attrs: {}, content: [{
                tag: 'messages', attrs: {}, content: [
                    { tag: 'message', attrs: { server_id: '101', views: '7' }, content: [{ tag: 'reactions', attrs: {}, content: [
                        { tag: 'reaction', attrs: { code: '👍', count: '3' } },
                        { tag: 'reaction', attrs: { code: '', count: '2' } },
                        { tag: 'reaction', attrs: { code: 'bad', count: 'x' } }
                    ] }] },
                    { tag: 'message', attrs: { server_id: '102' }, content: [{ tag: 'views_count', attrs: { count: 'nope' } }] },
                    { tag: 'message', attrs: { views: '9' }, content: [] }
                ]
            }]
        }]
    };
    assert.deepEqual(parseNewsletterUpdates(response), [
        { serverId: '101', views: 7, reactions: [{ code: '👍', count: 3 }] },
        { serverId: '102', views: 0, reactions: [] }
    ]);
});
