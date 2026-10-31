import { createRequire } from 'node:module'
import { DEFAULT_ORIGIN, WEBSOCKET_STATES } from '../../Defaults/index.js'
import { AbstractSocketClient } from './types.js'

const WS_ONLY_EVENTS = ['upgrade', 'ping', 'pong', 'unexpected-response']
let WsImplementation
const loadWs = () => WsImplementation ?? (WsImplementation = createRequire(import.meta.url)('ws'))

export class WebSocketClient extends AbstractSocketClient {
    constructor(...args) {
        super(...args)
        this.socket = null
        this.restartPromise = null
        this.nativeSocket = false
        this.connectTimer = null
    }

    get isOpen() {
        return this.socket?.readyState === WEBSOCKET_STATES.OPEN
    }

    get isClosed() {
        return this.socket === null || this.socket.readyState === WEBSOCKET_STATES.CLOSED
    }

    get isClosing() {
        return this.socket === null || this.socket.readyState === WEBSOCKET_STATES.CLOSING
    }

    get isConnecting() {
        return this.socket?.readyState === WEBSOCKET_STATES.CONNECTING
    }

    connect() {
        if (this.socket) {
            return
        }

        const { agent, connectTimeoutMs: timeoutMs, options = {} } = this.config || {}
        const headers = options.headers
        let socket

        if (globalThis.WebSocket) {
            this.nativeSocket = true
            socket = new globalThis.WebSocket(this.url, {
                headers: { Origin: DEFAULT_ORIGIN, ...headers }
            })
            socket.binaryType = 'arraybuffer'
            socket.onopen = () => {
                clearTimeout(this.connectTimer)
                this.connectTimer = null
                this.emit('open')
            }
            socket.onmessage = ({ data }) => {
                const binary = typeof data !== 'string'
                this.emit('message', binary ? Buffer.from(data) : data, binary)
            }
            socket.onerror = event => {
                this.emit('error', event.error || new Error(event.message || 'WebSocket error'))
            }
            socket.onclose = event => this.finishSocket(socket, event.code, event.reason || '')
            if (timeoutMs) {
                this.connectTimer = setTimeout(() => {
                    this.emit('error', new Error('Opening handshake has timed out'))
                    socket.close()
                }, timeoutMs)
            }
        }
        else {
            this.nativeSocket = false
            socket = new (loadWs())(this.url, {
                origin: DEFAULT_ORIGIN,
                headers,
                handshakeTimeout: timeoutMs,
                timeout: timeoutMs,
                agent
            })
            socket.on('open', () => this.emit('open'))
            socket.on('message', (data, binary) => this.emit('message', data, binary))
            socket.on('error', error => this.emit('error', error))
            socket.on('close', (code, reason) => this.finishSocket(socket, code, reason?.toString() || ''))
            for (const event of WS_ONLY_EVENTS) {
                socket.on(event, (...args) => this.emit(event, ...args))
            }
        }

        socket.setMaxListeners?.(0)
        this.socket = socket
    }

    finishSocket(socket, code, reason) {
        clearTimeout(this.connectTimer)
        this.connectTimer = null
        if (this.socket === socket) {
            this.socket = null
        }
        this.emit('close', code, reason)
    }

    restart() {
        if (this.restartPromise) {
            return this.restartPromise
        }
        const restartPromise = this.restartSocket()
        this.restartPromise = restartPromise
        restartPromise.then(() => {
            if (this.restartPromise === restartPromise) {
                this.restartPromise = null
            }
        }, () => {
            if (this.restartPromise === restartPromise) {
                this.restartPromise = null
            }
        })
        return restartPromise
    }

    async restartSocket() {
        const oldSocket = this.socket
        if (!oldSocket || oldSocket.readyState === WEBSOCKET_STATES.CLOSED) {
            if (this.socket === oldSocket) {
                this.socket = null
            }
            this.connect()
            return
        }

        const closeTimeoutMs = Number.isFinite(this.config?.restartCloseTimeoutMs)
            ? Math.max(0, this.config.restartCloseTimeoutMs)
            : 1000
        await new Promise(resolve => {
            let settled = false
            const finish = () => {
                if (settled) {
                    return
                }
                settled = true
                clearTimeout(timer)
                oldSocket.removeListener?.('close', onClose)
                resolve()
            }
            const onClose = () => finish()
            const timer = setTimeout(finish, closeTimeoutMs)
            oldSocket.once?.('close', onClose)
            if (typeof oldSocket.terminate === 'function') {
                oldSocket.terminate()
            }
            else {
                oldSocket.close()
            }
        })
        if (this.socket === oldSocket) {
            this.socket = null
        }
        this.connect()
    }

    async close() {
        const socket = this.socket
        if (!socket) {
            return
        }
        if (socket.readyState === WEBSOCKET_STATES.CLOSED) {
            this.socket = null
            return
        }
        const closePromise = new Promise(resolve => this.once('close', resolve))
        socket.close()
        await closePromise
    }

    send(data, cb) {
        const socket = this.socket
        if (!socket) {
            return false
        }
        if (this.nativeSocket) {
            try {
                socket.send(data)
                cb?.()
            }
            catch (error) {
                cb ? cb(error) : this.emit('error', error)
            }
        }
        else {
            socket.send(data, cb)
        }
        return true
    }
}
