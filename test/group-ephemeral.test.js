import test from 'node:test'
import assert from 'node:assert/strict'
import {
    createGroupEphemeralMetadataCache,
    isPositiveFiniteEphemeralDuration,
    resolveGroupEphemeralOptions
} from '../lib/Utils/group-ephemeral.js'

test('group ephemeral inheritance is opt-in and does not mutate caller options', () => {
    const options = { quoted: { key: { id: 'q-1' } } }
    const result = resolveGroupEphemeralOptions({
        enabled: false,
        isGroup: true,
        options,
        ephemeralDuration: 60
    })
    assert.strictEqual(result, options)
    assert.equal(result.ephemeralExpiration, undefined)
})

test('enabled group ephemeral inheritance adds a positive finite duration immutably', () => {
    const options = { additionalNodes: [] }
    const result = resolveGroupEphemeralOptions({
        enabled: true,
        isGroup: true,
        options,
        ephemeralDuration: 60
    })
    assert.notStrictEqual(result, options)
    assert.equal(result.ephemeralExpiration, 60)
    assert.deepEqual(options, { additionalNodes: [] })
})

test('caller expiration always wins, including an explicit zero', () => {
    for (const ephemeralExpiration of [0, 42, null]) {
        const options = { ephemeralExpiration }
        const result = resolveGroupEphemeralOptions({
            enabled: true,
            isGroup: true,
            options,
            ephemeralDuration: 60
        })
        assert.strictEqual(result, options)
        assert.equal(result.ephemeralExpiration, ephemeralExpiration)
    }
})

test('control messages and invalid metadata never inherit expiration', () => {
    const options = {}
    assert.strictEqual(resolveGroupEphemeralOptions({
        enabled: true,
        isGroup: true,
        isDisappearingMessagesControl: true,
        options,
        ephemeralDuration: 60
    }), options)
    for (const duration of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, '60']) {
        assert.equal(isPositiveFiniteEphemeralDuration(duration), false)
        assert.strictEqual(resolveGroupEphemeralOptions({
            enabled: true,
            isGroup: true,
            options,
            ephemeralDuration: duration
        }), options)
    }
})

test('metadata cache shares in-flight lookups and reuses values within its TTL', async () => {
    let clock = 1000
    let calls = 0
    const cache = createGroupEphemeralMetadataCache({ ttlMs: 100, now: () => clock })
    const loader = async () => {
        calls++
        return { ephemeralDuration: 60 }
    }
    const [first, second] = await Promise.all([
        cache.get('123@g.us', loader),
        cache.get('123@g.us', loader)
    ])
    assert.deepEqual(first, { ephemeralDuration: 60 })
    assert.deepEqual(second, { ephemeralDuration: 60 })
    assert.equal(calls, 1)
    await cache.get('123@g.us', loader)
    assert.equal(calls, 1)
    clock += 101
    await cache.get('123@g.us', loader)
    assert.equal(calls, 2)
})

test('metadata cache gracefully caches loader errors for the TTL', async () => {
    let calls = 0
    const cache = createGroupEphemeralMetadataCache({ ttlMs: 100, now: () => 0 })
    const loader = async () => {
        calls++
        throw new Error('metadata unavailable')
    }
    assert.equal(await cache.get('broken@g.us', loader), undefined)
    assert.equal(await cache.get('broken@g.us', loader), undefined)
    assert.equal(calls, 1)
})

test('metadata cache stays bounded by evicting the oldest group entry', async () => {
    const cache = createGroupEphemeralMetadataCache({ maxEntries: 2, now: () => 0 })
    let reloads = 0
    await cache.get('first@g.us', async () => ({ id: 'first' }))
    await cache.get('second@g.us', async () => ({ id: 'second' }))
    await cache.get('third@g.us', async () => ({ id: 'third' }))
    const first = await cache.get('first@g.us', async () => {
        reloads++
        return { id: 'first' }
    })
    assert.deepEqual(first, { id: 'first' })
    assert.equal(reloads, 1)
})
