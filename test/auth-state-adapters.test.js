import assert from 'node:assert/strict';
import test from 'node:test';
import { proto } from '../WAProto/index.js';
import { makeCacheManagerAuthState } from '../lib/Utils/use-cache-manager-auth-state.js';
import { useMongoAuthState } from '../lib/Utils/use-mongo-auth-state.js';

class FakeCache {
    constructor() {
        this.values = new Map();
        this.setCalls = [];
    }

    async get(key) {
        return this.values.get(key);
    }

    async set(key, value, options) {
        this.setCalls.push({ key, value, options });
        this.values.set(key, value);
    }

    async del(key) {
        this.values.delete(key);
    }

    async keys() {
        return [...this.values.keys()];
    }
}

class FakeCollection {
    constructor() {
        this.documents = [];
        this.calls = [];
    }

    async findOne(filter) {
        this.calls.push(['findOne', filter]);
        return this.documents.find((document) => document.sessionId === filter.sessionId && document.key === filter.key) ?? null;
    }

    async updateOne(filter, update, options) {
        this.calls.push(['updateOne', filter, update, options]);
        const existing = this.documents.find((document) => document.sessionId === filter.sessionId && document.key === filter.key);
        if (existing) {
            existing.value = update.$set.value;
        }
        else if (options?.upsert) {
            this.documents.push({ ...filter, value: update.$set.value });
        }
    }

    async deleteOne(filter) {
        this.calls.push(['deleteOne', filter]);
        this.documents = this.documents.filter((document) => !(document.sessionId === filter.sessionId && document.key === filter.key));
    }

    async deleteMany(filter) {
        this.calls.push(['deleteMany', filter]);
        this.documents = this.documents.filter((document) => document.sessionId !== filter.sessionId);
    }
}

const appStateValue = () => proto.Message.AppStateSyncKeyData.fromObject({
    keyData: Buffer.from([1, 2, 3]),
    fingerprint: { rawId: 4, currentIndex: 5, deviceIndexes: [1, 2] },
    timestamp: 7
});

const assertAppStateValue = (value) => {
    assert.ok(value instanceof proto.Message.AppStateSyncKeyData);
    assert.deepEqual(Buffer.from(value.keyData), Buffer.from([1, 2, 3]));
    assert.equal(value.fingerprint.rawId, 4);
    assert.equal(value.fingerprint.currentIndex, 5);
    assert.deepEqual(value.fingerprint.deviceIndexes, [1, 2]);
};

test('cache-manager auth state round-trips creds, keys, and app-state keys', async () => {
    const cache = new FakeCache();
    const first = await makeCacheManagerAuthState(cache, 'team/a:one');
    first.state.creds.advSecretKey = Buffer.from('secret');
    const appState = appStateValue();
    await first.state.keys.set({
        preKey: { '1': { key: Buffer.from([9, 8]) } },
        'app-state-sync-key': { sync: appState }
    });
    await first.saveCreds();

    assert.equal(first.state.creds.advSecretKey.toString(), 'secret');
    assert.deepEqual(first.state.keys && await first.state.keys.get('preKey', ['1']), {
        '1': { key: Buffer.from([9, 8]) }
    });
    assertAppStateValue((await first.state.keys.get('app-state-sync-key', ['sync'])).sync);
    assert.deepEqual(first.state.creds.advSecretKey, Buffer.from('secret'));
    assert.equal(cache.setCalls.find((call) => call.key.endsWith(':creds')).options, undefined);

    const restored = await makeCacheManagerAuthState(cache, 'team/a:one');
    assert.deepEqual(restored.state.creds.advSecretKey, Buffer.from('secret'));
    assertAppStateValue((await restored.state.keys.get('app-state-sync-key', ['sync'])).sync);
});

test('cache-manager auth state isolates sessions and clears only its own keys', async () => {
    const cache = new FakeCache();
    const first = await makeCacheManagerAuthState(cache, 'same/session');
    const second = await makeCacheManagerAuthState(cache, 'other/session');
    first.state.creds.marker = Buffer.from('first');
    second.state.creds.marker = Buffer.from('second');
    await first.saveCreds();
    await second.saveCreds();
    await first.state.keys.set({ session: { id: { value: Buffer.from('first-key') } } });
    await second.state.keys.set({ session: { id: { value: Buffer.from('second-key') } } });

    await first.state.keys.set({ session: { id: null } });
    assert.deepEqual(await first.state.keys.get('session', ['id']), {});
    assert.deepEqual((await second.state.keys.get('session', ['id'])).id.value, Buffer.from('second-key'));

    await first.clearState();
    const remaining = await makeCacheManagerAuthState(cache, 'other/session');
    assert.deepEqual(remaining.state.creds.marker, Buffer.from('second'));
    assert.deepEqual((await remaining.state.keys.get('session', ['id'])).id.value, Buffer.from('second-key'));
    assert.equal((await makeCacheManagerAuthState(cache, 'same/session')).state.creds.marker, undefined);
});

test('cache-manager clearState rejects without key enumeration and storage errors propagate', async () => {
    const cache = {
        async get() { return null; },
        async set() {},
        async del() {}
    };
    const state = await makeCacheManagerAuthState(cache, 'no-enumeration');
    await assert.rejects(state.clearState, /requires.*key enumeration/);

    const failing = {
        async get() { throw new Error('backend read failed'); },
        async set() {},
        async del() {}
    };
    await assert.rejects(makeCacheManagerAuthState(failing, 'failing'), /backend read failed/);
});

test('Mongo auth state round-trips BufferJSON values and restores app-state keys', async () => {
    const collection = new FakeCollection();
    const first = await useMongoAuthState(collection, 'mongo-session');
    first.state.creds.marker = Buffer.from([6, 7]);
    await first.state.keys.set({
        signal: { abc: { public: Buffer.from([8, 9]) } },
        'app-state-sync-key': { sync: appStateValue() }
    });
    await first.saveCreds();

    const restored = await useMongoAuthState(collection, 'mongo-session');
    assert.deepEqual(restored.state.creds.marker, Buffer.from([6, 7]));
    assert.deepEqual((await restored.state.keys.get('signal', ['abc'])).abc.public, Buffer.from([8, 9]));
    assertAppStateValue((await restored.state.keys.get('app-state-sync-key', ['sync'])).sync);
    assert.ok(collection.documents.every((document) => document.sessionId === 'mongo-session' && typeof document.key === 'string'));
});

test('Mongo auth state isolates sessions, deletes keys, and clears its session', async () => {
    const collection = new FakeCollection();
    const first = await useMongoAuthState(collection, 'first');
    const second = await useMongoAuthState(collection, 'second');
    first.state.creds.marker = 'first';
    second.state.creds.marker = 'second';
    await first.saveCreds();
    await second.saveCreds();
    await first.state.keys.set({ signal: { id: { value: 1 } } });
    await second.state.keys.set({ signal: { id: { value: 2 } } });
    await first.state.keys.set({ signal: { id: null } });
    assert.deepEqual(await first.state.keys.get('signal', ['id']), {});
    assert.equal((await second.state.keys.get('signal', ['id'])).id.value, 2);

    await first.clearState();
    const restoredSecond = await useMongoAuthState(collection, 'second');
    assert.equal(restoredSecond.state.creds.marker, 'second');
    assert.equal((await restoredSecond.state.keys.get('signal', ['id'])).id.value, 2);
    assert.equal(collection.documents.some((document) => document.sessionId === 'first'), false);
});

test('adapters validate their storage contracts', async () => {
    await assert.rejects(makeCacheManagerAuthState({}, 'session'), /must implement get/);
    await assert.rejects(makeCacheManagerAuthState(new FakeCache(), ''), /non-empty string/);
    await assert.rejects(useMongoAuthState({}, 'session'), /must implement findOne/);
    await assert.rejects(useMongoAuthState(new FakeCollection(), ''), /non-empty string/);
});
