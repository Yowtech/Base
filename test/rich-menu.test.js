import test from 'node:test';
import assert from 'node:assert/strict';
import { proto } from '../WAProto/index.js';
import { buildRichMenuMessage, sendRichMenu } from '../lib/Utils/rich-menu.js';

const getRich = message => proto.Message.decode(proto.Message.encode(message).finish())
    .botForwardedMessage.message.richResponseMessage;

test('RichMenu serializes widget sections and CTA data using proto bytes', () => {
    const message = buildRichMenuMessage({
        header: { title: 'Pilih layanan' },
        body: { title: 'Menu', buttons: [{ label: 'Buka', toast: 'Dipilih' }] },
        footer: { text: 'Dokumentasi', url: 'https://example.com/docs' }
    });
    const decoded = getRich(message);
    assert.equal(decoded.contextInfo.forwardOrigin, proto.ContextInfo.ForwardOrigin.META_AI);
    const data = JSON.parse(Buffer.from(decoded.unifiedResponse.data).toString('utf8'));
    assert.equal(data.sections[0].view_model.primitive.text, '# Pilih layanan');
    const widget = data.sections[1].view_model.primitive;
    assert.equal(widget.__typename, 'GenAI3PExtWidgetPrimitive');
    assert.equal(widget.body.ctas[0].label, 'Buka');
    assert.equal(widget.body.ctas[0].toast.label, 'Dipilih');
    assert.equal(data.sections[2].view_model.primitives[0].cta_url, 'https://example.com/docs');
});

test('RichMenu supports carousel and disclaimer metadata while rejecting empty payloads', () => {
    const message = buildRichMenuMessage({
        header: { disclaimer: true, disclaimerText: 'UI eksperimental' },
        body: { carousel: true, cards: [{ title: 'A', buttons: ['Lihat'] }] }
    });
    const decoded = getRich(message);
    assert.equal(message.messageContextInfo.botMetadata.messageDisclaimerText, 'UI eksperimental');
    const data = JSON.parse(Buffer.from(decoded.unifiedResponse.data).toString('utf8'));
    assert.equal(data.sections[0].view_model.__typename, 'GenAIHScrollLayoutViewModel');
    assert.throws(() => buildRichMenuMessage({}), TypeError);
    assert.throws(() => buildRichMenuMessage({ body: { buttons: [''] } }), TypeError);
});

test('sendRichMenu relays once with an explicit message ID', async () => {
    const calls = [];
    const result = await sendRichMenu({ relayMessage: async (...args) => calls.push(args) }, '123@s.whatsapp.net', { body: { buttons: ['A'] } }, { messageId: 'rich-menu-id' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], '123@s.whatsapp.net');
    assert.equal(calls[0][2].messageId, 'rich-menu-id');
    assert.equal(result.messageId, 'rich-menu-id');
});
