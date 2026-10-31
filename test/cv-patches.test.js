import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_CONNECTION_CONFIG, WEBSOCKET_STATES } from '../lib/Defaults/index.js'
import { getBizBinaryNode } from '../lib/WABinary/generic-utils.js'

test('cv uses the current client revision in connection defaults', () => {
    assert.deepEqual(DEFAULT_CONNECTION_CONFIG.version, [2, 3000, 1051815529])
})

test('cv exposes WebSocket state constants', () => {
    assert.deepEqual(WEBSOCKET_STATES, {
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3
    })
})

test('cv maps form_message to the business native flow', () => {
    const node = getBizBinaryNode({
        interactiveMessage: {
            nativeFlowMessage: {
                buttons: [{ name: 'form_message' }]
            }
        }
    })
    assert.equal(node.attrs.native_flow_name, 'form_message')
})
