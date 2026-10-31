export class WebSocketClient extends AbstractSocketClient {
    constructor(...args: any[]);
    socket: any | null;
    get isOpen(): boolean;
    get isClosed(): boolean;
    get isClosing(): boolean;
    get isConnecting(): boolean;
    connect(): void;
    restart(): Promise<void>;
    close(): Promise<void>;
    send(data: any, cb?: (error?: Error) => void): boolean;
}
import { AbstractSocketClient } from './types.js';
//# sourceMappingURL=websocket.d.ts.map
