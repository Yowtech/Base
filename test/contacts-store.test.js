import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { makeInMemoryStore } from '../lib/Store/make-in-memory-store.js'

test('contacts.getAll returns cached contacts and honors a positive limit', async () => {
    const store = makeInMemoryStore()
    const ev = new EventEmitter()
    store.bind(ev)
    const contacts = [
        { id: '111@s.whatsapp.net', name: 'First' },
        { id: '222@s.whatsapp.net', name: 'Second' }
    ]

    ev.emit('contacts.upsert', contacts)

    assert.deepEqual(await store.contacts.getAll(), contacts)
    assert.deepEqual(await store.contacts.getAll(1), contacts.slice(0, 1))
})

test('contacts.getAll remains non-enumerable and does not affect saved contacts', async () => {
    const store = makeInMemoryStore()
    const ev = new EventEmitter()
    store.bind(ev)
    const contact = { id: '111@s.whatsapp.net', name: 'First' }

    ev.emit('contacts.upsert', [contact])

    assert.equal(Object.keys(store.contacts).includes('getAll'), false)
    assert.deepEqual(store.toJSON().contacts, { [contact.id]: contact })
})

test('contacts.getAll rejects invalid limits', async () => {
    const store = makeInMemoryStore()

    for (const limit of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        await assert.rejects(store.contacts.getAll(limit), /invalid query limit/)
    }
})
