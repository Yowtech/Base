import test from 'node:test';
import assert from 'node:assert/strict';
import { proto } from '../WAProto/index.js';
import { A2UI, sendA2UIWidget } from '../lib/Utils/a2ui.js';

test('A2UI builds declarative components and survives BloksWidget protobuf round-trip', () => {
    const ui = new A2UI();
    const title = ui.text('Halo', { variant: 'h1' });
    const buttonText = ui.text('Buka');
    const button = ui.button(buttonText, { action: 'open' });
    const column = ui.column([title, button]);
    ui.root([column]);
    const built = ui.build({ uuid: 'widget-1' });
    const original = proto.Message.fromObject({ interactiveMessage: { bloksWidget: built } });
    const decoded = proto.Message.decode(proto.Message.encode(original).finish());
    assert.equal(decoded.interactiveMessage.bloksWidget.uuid, 'widget-1');
    const data = JSON.parse(decoded.interactiveMessage.bloksWidget.data);
    assert.equal(data.createSurface.components[1].component, 'Text');
    assert.equal(data.createSurface.components[0].id, 'root');
});

test('A2UI listCard fallback uses the existing Yowtech generated field', () => {
    const built = new A2UI().listCard({ title: 'Produk', items: [{ title: 'Paket A' }], fallbackText: 'Buka katalog' }).build();
    const message = proto.Message.fromObject({ interactiveMessage: { bloksWidget: built } });
    const decoded = proto.Message.decode(proto.Message.encode(message).finish());
    assert.equal(decoded.interactiveMessage.bloksWidget.fallback, 'Buka katalog');
    assert.equal(JSON.parse(decoded.interactiveMessage.bloksWidget.data).type, 'list_card');
});

test('sendA2UIWidget sends an opt-in interactive message and required biz node', async () => {
    const ui = new A2UI();
    const label = ui.text('Lanjut');
    ui.root([label]);
    const calls = [];
    const result = await sendA2UIWidget({ relayMessage: async (...args) => calls.push(args) }, '123@s.whatsapp.net', {
        a2ui: ui,
        bodyText: 'Widget demo',
        buttons: [{ name: 'cta_url', params: { url: 'https://example.com' } }],
        userJid: '456@s.whatsapp.net'
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], '123@s.whatsapp.net');
    assert.equal(calls[0][2].messageId, result.key.id);
    assert.equal(calls[0][2].additionalNodes[0].tag, 'biz');
    assert.ok(calls[0][1].interactiveMessage.bloksWidget);
});

test('A2UI rejects missing root children and invalid sender', async () => {
    assert.throws(() => new A2UI().build(), /root/);
    const ui = new A2UI();
    const child = ui.text('x');
    ui.root([child]);
    await assert.rejects(() => sendA2UIWidget({}, '123@s.whatsapp.net', { a2ui: ui }), TypeError);
});
