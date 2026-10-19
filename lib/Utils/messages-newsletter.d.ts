export type NewsletterMedia = string | Uint8Array | Record<string, any>;
export type NewsletterSendOptions = Record<string, any>;
export type NewsletterMessageContent = Record<string, any>;
export function normalizeNewsletterJid(jid: string): string;
export function makeNewsletterUtils(conn: {
    sendMessage: (jid: string, content: NewsletterMessageContent, options?: NewsletterSendOptions) => Promise<any>;
    newsletterReactMessage: (jid: string, serverId: string | number, reaction?: string) => Promise<any>;
}): {
    sendNewsletterText(jid: string, text: string, options?: NewsletterSendOptions): Promise<any>;
    sendNewsletterImage(jid: string, image: NewsletterMedia, caption?: string, options?: NewsletterSendOptions): Promise<any>;
    sendNewsletterVideo(jid: string, video: NewsletterMedia, caption?: string, options?: NewsletterSendOptions): Promise<any>;
    sendNewsletterPtv(jid: string, video: NewsletterMedia, caption?: string, options?: NewsletterSendOptions): Promise<any>;
    sendNewsletterAudio(jid: string, audio: NewsletterMedia, options?: NewsletterSendOptions): Promise<any>;
    sendNewsletterDocument(jid: string, document: NewsletterMedia, fileName?: string, options?: NewsletterSendOptions): Promise<any>;
    sendNewsletterSticker(jid: string, sticker: NewsletterMedia, options?: NewsletterSendOptions): Promise<any>;
    sendNewsletterButtons(jid: string, text: string | NewsletterMessageContent, buttons?: NewsletterMessageContent[], footer?: string | NewsletterSendOptions, options?: NewsletterSendOptions): Promise<any>;
    sendNewsletterList(jid: string, text: string | NewsletterMessageContent, sections?: NewsletterMessageContent[], buttonText?: string, title?: string, footer?: string, options?: NewsletterSendOptions): Promise<any>;
    sendNewsletterCtaUrl(jid: string, text: string, url: string, displayText?: string, options?: NewsletterSendOptions): Promise<any>;
    sendNewsletterReact(jid: string, serverId: string | number, reaction?: string): Promise<any>;
    editNewsletterMessage(jid: string, messageId: string | number, content: NewsletterMessageContent, options?: NewsletterSendOptions): Promise<any>;
    deleteNewsletterMessage(jid: string, messageId: string | number, options?: NewsletterSendOptions): Promise<any>;
    sendNewsletterEdit(jid: string, messageId: string | number, content: NewsletterMessageContent, options?: NewsletterSendOptions): Promise<any>;
    sendNewsletterDelete(jid: string, messageId: string | number, options?: NewsletterSendOptions): Promise<any>;
};
//# sourceMappingURL=messages-newsletter.d.ts.map
