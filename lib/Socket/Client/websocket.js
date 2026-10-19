import WebSocket from 'ws';
import { DEFAULT_ORIGIN } from '../../Defaults/index.js';
import { AbstractSocketClient } from './types.js';
export class WebSocketClient extends AbstractSocketClient {
    constructor() {
        super(...arguments);
        this.socket = null;
        this.restartPromise = null;
    }
    get isOpen() {
        return this.socket?.readyState === WebSocket.OPEN;
    }
    get isClosed() {
        return this.socket === null || this.socket?.readyState === WebSocket.CLOSED;
    }
    get isClosing() {
        return this.socket === null || this.socket?.readyState === WebSocket.CLOSING;
    }
    get isConnecting() {
        return this.socket?.readyState === WebSocket.CONNECTING;
    }
    connect() {
        if (this.socket) {
            return;
        }
        const socket = new WebSocket(this.url, {
            origin: DEFAULT_ORIGIN,
            headers: this.config.options?.headers,
            handshakeTimeout: this.config.connectTimeoutMs,
            timeout: this.config.connectTimeoutMs,
            agent: this.config.agent
        });
        this.socket = socket;
        socket.setMaxListeners(0);
        const events = ['close', 'error', 'upgrade', 'message', 'open', 'ping', 'pong', 'unexpected-response'];
        for (const event of events) {
            socket.on(event, (...args) => {
                if (this.socket === socket) {
                    this.emit(event, ...args);
                }
            });
        }
    }
    restart() {
        if (this.restartPromise) {
            return this.restartPromise;
        }
        const restartPromise = this.restartSocket();
        this.restartPromise = restartPromise;
        restartPromise.then(() => {
            if (this.restartPromise === restartPromise) {
                this.restartPromise = null;
            }
        }, () => {
            if (this.restartPromise === restartPromise) {
                this.restartPromise = null;
            }
        });
        return restartPromise;
    }
    async restartSocket() {
        const oldSocket = this.socket;
        if (!oldSocket || oldSocket.readyState === WebSocket.CLOSED) {
            if (this.socket === oldSocket) {
                this.socket = null;
            }
            this.connect();
            return;
        }
        const closeTimeoutMs = Number.isFinite(this.config?.restartCloseTimeoutMs)
            ? Math.max(0, this.config.restartCloseTimeoutMs)
            : 1000;
        await new Promise(resolve => {
            let settled = false;
            const finish = () => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timer);
                oldSocket.removeListener?.('close', onClose);
                resolve();
            };
            const onClose = () => finish();
            const timer = setTimeout(finish, closeTimeoutMs);
            oldSocket.once('close', onClose);
            oldSocket.terminate();
        });
        if (this.socket === oldSocket) {
            this.socket = null;
        }
        this.connect();
    }
    async close() {
        if (!this.socket) {
            return;
        }
        const closePromise = new Promise(resolve => {
            this.socket?.once('close', resolve);
        });
        this.socket.close();
        await closePromise;
        this.socket = null;
    }
    send(str, cb) {
        this.socket?.send(str, cb);
        return Boolean(this.socket);
    }
}
//# sourceMappingURL=websocket.js.map
