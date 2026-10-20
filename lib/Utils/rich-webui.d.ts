import { proto } from '../../WAProto/index.js';

export interface WebUIMessageOptions {
    html: string;
    title?: string;
    botJid?: string;
    forwardOrigin?: proto.ContextInfo.ForwardOrigin | 'META_AI';
    responseId?: string;
    userJid?: string;
    quoted?: proto.IWebMessageInfo;
}
export interface SendInlineWebUIOptions extends Omit<WebUIMessageOptions, 'html' | 'title'> {
    messageId?: string;
}
export const WEBUI_PRIMITIVE_TYPENAME: string;
export const DEFAULT_BOT_JID: string;
export const DEFAULT_FORWARD_ORIGIN: proto.ContextInfo.ForwardOrigin;
export const WEBUI_MAX_PAYLOAD_BYTES: number;
export function generateWebuiMessageId(): string;
export function buildWebuiMessage(options: WebUIMessageOptions): proto.Message;
export function sendInlineWebUI(sock: { relayMessage: (...args: any[]) => Promise<any> }, jid: string, html: string, title?: string, options?: SendInlineWebUIOptions): Promise<{ messageId: string; message: proto.Message }>;
declare const _default: {
    buildWebuiMessage: typeof buildWebuiMessage;
    sendInlineWebUI: typeof sendInlineWebUI;
    generateWebuiMessageId: typeof generateWebuiMessageId;
    WEBUI_PRIMITIVE_TYPENAME: typeof WEBUI_PRIMITIVE_TYPENAME;
    DEFAULT_BOT_JID: typeof DEFAULT_BOT_JID;
    DEFAULT_FORWARD_ORIGIN: typeof DEFAULT_FORWARD_ORIGIN;
    WEBUI_MAX_PAYLOAD_BYTES: typeof WEBUI_MAX_PAYLOAD_BYTES;
};
export default _default;
