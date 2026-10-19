import { proto } from '../../WAProto/index.js';
import { initAuthCreds } from './auth-utils.js';
import { BufferJSON } from './generics.js';

const CREDS_KEY = 'creds';
const encodePart = (value) => Buffer.from(value, 'utf8').toString('base64url');
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const validateSessionKey = (sessionKey) => {
    if (typeof sessionKey !== 'string' || sessionKey.length === 0) {
        throw new TypeError('sessionKey must be a non-empty string');
    }
};

const validateCollection = (collection) => {
    if (!collection || typeof collection !== 'object') {
        throw new TypeError('collection must be a MongoDB collection-like object');
    }
    for (const method of ['findOne', 'updateOne', 'deleteOne', 'deleteMany']) {
        if (typeof collection[method] !== 'function') {
            throw new TypeError(`collection must implement ${method}()`);
        }
    }
};

const parseValue = (value, key) => {
    if (value === undefined || value === null) {
        return null;
    }
    if (typeof value !== 'string') {
        throw new TypeError(`Mongo value for ${key} must be a JSON string`);
    }
    return JSON.parse(value, BufferJSON.reviver);
};

const stringifyValue = (value, key) => {
    const serialized = JSON.stringify(value, BufferJSON.replacer);
    if (serialized === undefined) {
        throw new TypeError(`cannot serialize Mongo value for ${key}`);
    }
    return serialized;
};

const keyName = (type, id) => {
    if (typeof type !== 'string' || type.length === 0) {
        throw new TypeError('key type must be a non-empty string');
    }
    if (typeof id !== 'string' || id.length === 0) {
        throw new TypeError('key id must be a non-empty string');
    }
    return `key:${encodePart(type)}:${encodePart(id)}`;
};

/**
 * Store a Baileys authentication state in a MongoDB collection. Documents
 * have the shape { sessionId, key, value }, with every lookup session-scoped.
 */
export async function useMongoAuthState(collection, sessionKey = 'default') {
    validateCollection(collection);
    validateSessionKey(sessionKey);

    const find = async (key) => {
        const document = await collection.findOne({ sessionId: sessionKey, key });
        return parseValue(document?.value, key);
    };
    const save = async (key, value) => {
        await collection.updateOne(
            { sessionId: sessionKey, key },
            { $set: { value: stringifyValue(value, key) } },
            { upsert: true }
        );
    };
    const remove = async (key) => {
        await collection.deleteOne({ sessionId: sessionKey, key });
    };

    const creds = (await find(CREDS_KEY)) ?? initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    if (!Array.isArray(ids)) {
                        throw new TypeError('key ids must be an array');
                    }
                    const data = {};
                    for (const id of ids) {
                        const key = keyName(type, id);
                        let value = await find(key);
                        if (value === null) {
                            continue;
                        }
                        if (type === 'app-state-sync-key') {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }
                    return data;
                },
                set: async (data) => {
                    if (!isRecord(data)) {
                        throw new TypeError('key data must be an object');
                    }
                    for (const [type, values] of Object.entries(data)) {
                        if (!isRecord(values)) {
                            throw new TypeError(`key data for ${type} must be an object`);
                        }
                        for (const [id, value] of Object.entries(values)) {
                            const key = keyName(type, id);
                            if (value === null || value === undefined) {
                                await remove(key);
                            }
                            else {
                                await save(key, value);
                            }
                        }
                    }
                }
            }
        },
        saveCreds: async () => save(CREDS_KEY, creds),
        clearState: async () => {
            await collection.deleteMany({ sessionId: sessionKey });
        }
    };
}
