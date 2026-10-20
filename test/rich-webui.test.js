import test from 'node:test';
import assert from 'node:assert/strict';
import { proto } from '../WAProto/index.js';
import { buildWebuiMessage, sendInlineWebUI, WEBUI_MAX_PAYLOAD_BYTES } from '../lib/Utils/rich-webui.js';

const richFrom = message => proto.Message.decode(proto.Message.encode(message).finish())
    .botForwardedMessage.message.richResponseMessage;

test('Rich WebUI round-trips through Yowtech protobuf with raw UTF-8 JSON bytes and numeric enums', () => {
    const message = buildWebuiMessage({ html: '<h1>Halo 世界</h1>', title: 'Menu', responseId: 'response-fixed' });
    const decoded = richFrom(message);
    assert.equal(decoded.messageType, proto.AIRichResponseMessageType.AI_RICH_RESPONSE_TYPE_STANDARD);
    assert.equal(decoded.submessages[0].messageType, proto.AIRichResponseSubMessageType.AI_RICH_RESPONSE_TEXT);
    assert.equal(decoded.contextInfo.forwardOrigin, proto.ContextInfo.ForwardOrigin.META_AI);
    const payload = JSON.parse(Buffer.from(decoded.unifiedResponse.data).toString('utf8'));
    assert.equal(payload.response_id, 'response-fixed');
    assert.equal(payload.sections[0].view_model.primitive.payload, '<h1>Halo 世界</h1>');
    assert.equal(message.messageContextInfo.botMetadata.botResponseId, 'response-fixed');
});

test('Rich WebUI validates HTML and UTF-8 byte limit before constructing a message', () => {
    assert.throws(() => buildWebuiMessage({ html: '' }), TypeError);
    assert.throws(() => buildWebuiMessage({ html: 'x'.repeat(WEBUI_MAX_PAYLOAD_BYTES + 1) }), RangeError);
    assert.throws(() => buildWebuiMessage({ html: 'ok', forwardOrigin: 'NOT_A_FORWARD_ORIGIN' }), TypeError);
});

test('sendInlineWebUI delegates to relayMessage with a generated ID and propagates the payload', async () => {
    const calls = [];
    const result = await sendInlineWebUI({ relayMessage: async (...args) => calls.push(args) }, '123@s.whatsapp.net', '<p>Safe</p>', 'Title', { responseId: 'r-1' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], '123@s.whatsapp.net');
    assert.match(calls[0][2].messageId, /^[A-Z0-9]+$/);
    assert.equal(result.messageId, calls[0][2].messageId);
    assert.equal(richFrom(result.message).unifiedResponse.data.length > 0, true);
    await assert.rejects(() => sendInlineWebUI({}, '123@s.whatsapp.net', '<p/>'), TypeError);
});
