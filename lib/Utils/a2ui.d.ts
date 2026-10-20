import { proto } from '../../WAProto/index.js';

export interface A2UIBuildOptions { uuid?: string; surfaceId?: string; type?: string; wrapped?: boolean }
export interface A2UIListCardItem {
    assetId?: string;
    assetType?: string;
    title: string;
    price?: string;
    trailingLabel?: string;
    emphasis?: string;
}
export interface A2UIButton { name?: string; params?: string | Record<string, unknown> }
export interface SendA2UIOptions {
    a2ui: A2UI;
    bodyText?: string;
    footer?: string;
    buttons?: A2UIButton[];
    contextInfo?: proto.IContextInfo;
    expiration?: number;
    quoted?: proto.IWebMessageInfo;
    type?: string;
    wrapped?: boolean;
    singleScreen?: boolean;
    userJid?: string;
}
export class A2UI {
    constructor(options?: { catalogId?: string; version?: string });
    text(text: string, options?: { id?: string; variant?: string }): string;
    image(url: string, options?: { id?: string; variant?: string; fit?: string }): string;
    video(url: string, options?: { id?: string }): string;
    checkbox(label: string, options?: { id?: string; value?: boolean }): string;
    textField(label: string, options?: { id?: string; variant?: string }): string;
    button(childId: string, options?: { id?: string; variant?: string; action?: unknown }): string;
    card(childId: string, options?: { id?: string }): string;
    column(children?: string[], options?: { id?: string; justify?: string; align?: string }): string;
    row(children?: string[], options?: { id?: string }): string;
    divider(options?: { id?: string }): string;
    choicePicker(label: string, options: Array<{ label: string; value: string }>, config?: { id?: string; variant?: string; value?: string; displayStyle?: string; filterable?: boolean }): string;
    root(children: string[]): this;
    listCard(options: { title: string; items: A2UIListCardItem[]; fallbackText?: string; uuid?: string }): this;
    build(options?: A2UIBuildOptions): proto.Message.InteractiveMessage.IBloksWidget;
}
export function sendA2UIWidget(client: { relayMessage: (...args: any[]) => Promise<any>; user?: { id?: string }; authState?: any }, jid: string, options: SendA2UIOptions): Promise<proto.WebMessageInfo>;
declare const _default: { A2UI: typeof A2UI; sendA2UIWidget: typeof sendA2UIWidget };
export default _default;
