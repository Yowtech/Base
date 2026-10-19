import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { WebSocketClient } from '../lib/Socket/Client/websocket.js';

const OPEN = 1;
const CLOSED = 3;

class FakeSocket extends EventEmitter {
    constructor(readyState = OPEN, emitsCloseOnTerminate = true) {
        super();
        this.readyState = readyState;
        this.emitsCloseOnTerminate = emitsCloseOnTerminate;
        this.terminateCalls = 0;
    }

    terminate() {
        this.terminateCalls += 1;
        if (this.emitsCloseOnTerminate) {
            this.readyState = CLOSED;
            this.emit('close');
        }
    }
}

function clientWithConnectStub(replacement, restartCloseTimeoutMs = 20) {
    const client = new WebSocketClient('ws://unused.invalid', {
        connectTimeoutMs: 20,
        restartCloseTimeoutMs
    });
    let connectCalls = 0;
    client.connect = () => {
        connectCalls += 1;
        client.socket = replacement;
    };
    return { client, getConnectCalls: () => connectCalls };
}

test('restart connects when there is no socket', async () => {
    const replacement = new FakeSocket(OPEN);
    const { client, getConnectCalls } = clientWithConnectStub(replacement);

    await client.restart();

    assert.equal(getConnectCalls(), 1);
    assert.equal(client.socket, replacement);
});

test('restart replaces a CLOSED socket without terminating it', async () => {
    const oldSocket = new FakeSocket(CLOSED);
    const replacement = new FakeSocket(OPEN);
    const { client, getConnectCalls } = clientWithConnectStub(replacement);
    client.socket = oldSocket;

    await client.restart();

    assert.equal(oldSocket.terminateCalls, 0);
    assert.equal(getConnectCalls(), 1);
    assert.equal(client.socket, replacement);
});

test('restart terminates an active socket and reconnects after close', async () => {
    const oldSocket = new FakeSocket(OPEN);
    const replacement = new FakeSocket(OPEN);
    const { client, getConnectCalls } = clientWithConnectStub(replacement);
    client.socket = oldSocket;

    await client.restart();

    assert.equal(oldSocket.terminateCalls, 1);
    assert.equal(getConnectCalls(), 1);
    assert.equal(client.socket, replacement);
});

test('concurrent restart calls share one lifecycle and reconnect once', async () => {
    const oldSocket = new FakeSocket(OPEN, false);
    const replacement = new FakeSocket(OPEN);
    const { client, getConnectCalls } = clientWithConnectStub(replacement, 50);
    client.socket = oldSocket;

    const first = client.restart();
    const second = client.restart();
    assert.equal(first, second);

    await Promise.all([first, second]);

    assert.equal(oldSocket.terminateCalls, 1);
    assert.equal(getConnectCalls(), 1);
    assert.equal(client.socket, replacement);
});

test('restart reconnects after bounded close timeout', async () => {
    const oldSocket = new FakeSocket(OPEN, false);
    const replacement = new FakeSocket(OPEN);
    const { client, getConnectCalls } = clientWithConnectStub(replacement, 10);
    client.socket = oldSocket;

    await client.restart();

    assert.equal(oldSocket.terminateCalls, 1);
    assert.equal(getConnectCalls(), 1);
    assert.equal(client.socket, replacement);
});
