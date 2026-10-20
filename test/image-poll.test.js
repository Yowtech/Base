import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { proto } from '../WAProto/index.js';
import { generateWAMessageContent, generateWAMessageFromImagePoll, hashImagePollOption } from '../lib/Utils/messages.js';

const sha256 = input => createHash('sha256').update(input).digest();

test('ImagePoll option hash is deterministic and binds option name to uploaded media hash', () => {
    const fileSha256 = Buffer.from('media-hash');
    const expected = sha256(Buffer.from(sha256(Buffer.from('Blue')).toString('hex') + fileSha256.toString('base64'))).toString('hex');
    assert.equal(hashImagePollOption('Blue', fileSha256), expected);
    assert.notEqual(hashImagePollOption('Red', fileSha256), expected);
    assert.notEqual(hashImagePollOption('Blue', Buffer.from('other-media')), expected);
    assert.throws(() => hashImagePollOption('Blue', undefined), TypeError);
});

test('imagePoll generator encodes IMAGE poll content and keeps text-poll behavior separate', async () => {
    const content = await generateWAMessageContent({ imagePoll: {
        name: 'Warna?', selectableCount: 1,
        options: [{ optionName: 'Biru', optionHash: 'hash-1' }, { optionName: 'Merah', optionHash: 'hash-2' }]
    } }, {});
    const decoded = proto.Message.decode(proto.Message.encode(proto.Message.fromObject(content)).finish());
    assert.equal(decoded.pollCreationMessageV3.pollContentType, proto.Message.PollContentType.IMAGE);
    assert.equal(decoded.pollCreationMessageV3.selectableOptionsCount, 1);
    assert.equal(decoded.pollCreationMessageV3.options[0].optionName, 'Biru');
    assert.equal(decoded.messageContextInfo.messageSecret.length, 32);
    await assert.rejects(() => generateWAMessageContent({ imagePoll: { name: 'bad', options: [] } }, {}), error => error.output?.statusCode === 400);
});

test('send helper relays poll first, then associated image options using Yowtech relay signature', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pWQAAAAASUVORK5CYII=', 'base64');
    const calls = [];
    const logger = { debug() {}, info() {}, warn() {} };
    const poll = await generateWAMessageFromImagePoll('123@s.whatsapp.net', {
        name: 'Pilih', selectableCount: 1,
        options: [{ name: 'A', image: png }, { name: 'B', image: png }]
    }, async (...args) => calls.push(args), {
        userJid: '456@s.whatsapp.net',
        logger,
        upload: async () => ({ mediaUrl: 'https://media.example/image', directPath: '/v/t/1' })
    });

    assert.equal(calls.length, 3);
    assert.equal(calls[0][0], '123@s.whatsapp.net');
    assert.equal(calls[0][1].pollCreationMessageV3.pollContentType, proto.Message.PollContentType.IMAGE);
    assert.deepEqual(calls[0][2].additionalNodes, [{ tag: 'meta', attrs: { polltype: 'creation' } }]);
    for (const [index, call] of calls.slice(1).entries()) {
        assert.equal(call[0], '123@s.whatsapp.net');
        assert.ok(call[1].pollCreationOptionImageMessage);
        assert.equal(call[1].messageContextInfo.messageAssociation.associationType, proto.MessageAssociation.AssociationType.MEDIA_POLL);
        assert.equal(call[1].messageContextInfo.messageAssociation.parentMessageKey.id, poll.key.id);
        assert.ok(call[2].messageId);
        assert.equal(index >= 0, true);
    }
});

test('ImagePoll validates before upload and rejects a relay without the target signature', async () => {
    let uploads = 0;
    const upload = async () => { uploads++; return {}; };
    await assert.rejects(() => generateWAMessageFromImagePoll('123@s.whatsapp.net', { name: 'bad', options: [] }, async () => {}, { upload }), error => error.output?.statusCode === 400);
    assert.equal(uploads, 0);
    await assert.rejects(() => generateWAMessageFromImagePoll('123@s.whatsapp.net', { name: 'ok', options: [{ name: 'A', image: Buffer.from('x') }] }, null, { upload }), TypeError);
});
