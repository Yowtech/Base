import { proto } from '../../WAProto/index.js';

export type RichMenuButton = string | { label?: string; text?: string; toast?: string };
export interface RichMenuImage {
    url: string;
    inline?: boolean;
    mime_type?: string;
    width?: number;
    height?: number;
}
export interface RichMenuHeader {
    title?: string;
    image?: RichMenuImage;
    disclaimer?: boolean;
    disclaimerText?: string;
}
export interface RichMenuCard {
    title?: string;
    buttons?: RichMenuButton[];
    toast?: string;
}
export interface RichMenuBody {
    title?: string;
    buttons?: RichMenuButton[];
    toast?: string;
    carousel?: boolean;
    row?: boolean;
    cards?: RichMenuCard[];
}
export interface RichMenuFooter {
    text?: string;
    url?: string;
    image?: RichMenuImage;
}
export interface RichMenuContent {
    header?: RichMenuHeader;
    body?: RichMenuBody;
    footer?: RichMenuFooter;
    contextInfo?: proto.IContextInfo;
}
export interface RichMenuSendOptions { messageId?: string; userJid?: string; quoted?: proto.IWebMessageInfo }
export const RICH_MENU_MAX_PAYLOAD_BYTES: number;
export function buildRichMenuMessage(content?: RichMenuContent): proto.Message;
export function sendRichMenu(sock: { relayMessage: (...args: any[]) => Promise<any> }, jid: string, content?: RichMenuContent, options?: RichMenuSendOptions): Promise<{ messageId: string; message: proto.Message }>;
declare const _default: {
    buildRichMenuMessage: typeof buildRichMenuMessage;
    sendRichMenu: typeof sendRichMenu;
    RICH_MENU_MAX_PAYLOAD_BYTES: typeof RICH_MENU_MAX_PAYLOAD_BYTES;
};
export default _default;
