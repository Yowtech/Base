import { proto } from '../../WAProto/index.js';
import { initAuthCreds } from './auth-utils.js';
import { BufferJSON } from './generics.js';

const encodePart = (value) => Buffer.from(value, 'utf8').toString('base64url');
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const validateSessionKey = (sessionKey) => {
    if (typeof sessionKey !== 'string' || sessionKey.length === 0) {
        throw new TypeError('sessionKey must be a non-empty string');
    }
};

const validateCache = (cache) => {
    if (!cache || typeof cache !== 'object') {
        throw new TypeError('cache must be a cache-manager instance');
    }
    for (const method of ['get', 'set', 'del']) {
        if (typeof cache[method] !== 'function') {
            throw new TypeError(`cache must implement ${method}()`);
        }
    }
};

const parseValue = (value, key) => {
    if (value === undefined || value === null) {
        return null;
    }
    if (typeof value !== 'string') {
        throw new TypeError(`cache value for ${key} must be a JSON string`);
    }
    return JSON.parse(value, BufferJSON.reviver);
};

const stringifyValue = (value, key) => {
    const serialized = JSON.stringify(value, BufferJSON.replacer);
    if (serialized === undefined) {
        throw new TypeError(`cannot serialize cache value for ${key}`);
    }
    return serialized;
};

/**
 * Store a Baileys authentication state in a cache-manager compatible cache.
 * The cache must expose get(), set(), and del(). clearState() additionally
 * requires cache.keys() or cache.store.keys() so it cannot clear partially.
 */
export async function makeCacheManagerAuthState(cache, sessionKey) {
    validateCache(cache);
    validateSessionKey(sessionKey);

    const prefix = `baileys-auth-state:${encodePart(sessionKey)}:`;
    const credsKey = `${prefix}creds`;
    const keyName = (type, id) => {
        if (typeof type !== 'string' || type.length === 0) {
            throw new TypeError('key type must be a non-empty string');
        }
        if (typeof id !== 'string' || id.length === 0) {
            throw new TypeError('key id must be a non-empty string');
        }
        return `${prefix}key:${encodePart(type)}:${encodePart(id)}`;
    };

    const storedCreds = parseValue(await cache.get(credsKey), credsKey);
    const creds = storedCreds ?? initAuthCreds();

    const getCacheKeys = async () => {
        const enumerate = typeof cache.keys === 'function'
            ? cache.keys.bind(cache)
            : cache.store && typeof cache.store.keys === 'function'
                ? cache.store.keys.bind(cache.store)
                : null;
        if (!enumerate) {
            throw new Error('clearState requires a cache backend that supports key enumeration via keys() or store.keys()');
        }
        const keys = await enumerate();
        if (!Array.isArray(keys)) {
            throw new Error('clearState requires key enumeration to return an array of keys');
        }
        return keys;
    };

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
                        const cacheKey = keyName(type, id);
                        let value = parseValue(await cache.get(cacheKey), cacheKey);
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
                            const cacheKey = keyName(type, id);
                            if (value === null || value === undefined) {
                                await cache.del(cacheKey);
                            }
                            else {
                                await cache.set(cacheKey, stringifyValue(value, cacheKey));
                            }
                        }
                    }
                }
            }
        },
        saveCreds: async () => {
            const serialized = stringifyValue(creds, credsKey);
            await cache.set(credsKey, serialized);
        },
        clearState: async () => {
            const keys = await getCacheKeys();
            for (const key of keys) {
                if (typeof key === 'string' && key.startsWith(prefix)) {
                    await cache.del(key);
                }
            }
        }
    };
}
