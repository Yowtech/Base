const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

/**
 * Return true only for a usable WhatsApp disappearing-message duration.
 * Metadata values are intentionally not coerced so malformed values cannot
 * accidentally turn into an expiration.
 */
export const isPositiveFiniteEphemeralDuration = value =>
    typeof value === 'number' && Number.isFinite(value) && value > 0;

/**
 * Resolve sendMessage options without mutating the caller-owned object.
 * This is deliberately pure so the opt-in and precedence rules can be tested
 * independently of a live socket.
 */
export const resolveGroupEphemeralOptions = ({
    enabled,
    isGroup,
    isDisappearingMessagesControl = false,
    options = {},
    ephemeralDuration
}) => {
    if (!enabled || !isGroup || isDisappearingMessagesControl || hasOwn(options, 'ephemeralExpiration')) {
        return options;
    }
    if (!isPositiveFiniteEphemeralDuration(ephemeralDuration)) {
        return options;
    }
    return {
        ...options,
        ephemeralExpiration: ephemeralDuration
    };
};

/**
 * Small promise-aware TTL cache. In-flight lookups are shared, and failed
 * lookups are cached as undefined for the TTL to avoid retry storms.
 */
export const createGroupEphemeralMetadataCache = ({
    ttlMs = 5_000,
    maxEntries = 500,
    now = () => Date.now()
} = {}) => {
    const entries = new Map();
    const ttl = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : 5_000;
    const maxSize = Number.isSafeInteger(maxEntries) && maxEntries > 0 ? maxEntries : 500;

    const get = (key, loader) => {
        const timestamp = now();
        const existing = entries.get(key);
        if (existing && existing.expiresAt > timestamp) {
            return existing.promise;
        }
        if (existing) entries.delete(key);
        if (entries.size >= maxSize) {
            const oldestKey = entries.keys().next().value;
            if (oldestKey !== undefined) entries.delete(oldestKey);
        }
        const promise = Promise.resolve()
            .then(loader)
            .catch(() => undefined);
        entries.set(key, { expiresAt: timestamp + ttl, promise });
        return promise;
    };

    const clear = key => {
        if (key === undefined) {
            entries.clear();
        }
        else {
            entries.delete(key);
        }
    };

    return { get, clear };
};
