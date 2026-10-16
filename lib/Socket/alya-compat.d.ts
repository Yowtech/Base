export type AlyaStatusMediaKind = 'image' | 'video' | 'audio' | 'document' | 'sticker'
export type AlyaLinkKind = 'tiktok' | 'instagram' | 'facebook' | 'whatsapp_channel' | 'whatsapp_group_invite' | 'telegram' | 'generic'

export interface AlyaStatusEntry {
    id: string
    ownerJid: string
    chatJid: string
    fromMe: boolean
    timestampMs: number
    mediaKind: AlyaStatusMediaKind
    mimetype?: string
    caption?: string
    message: any
}

export interface AlyaCompat {
    status: {
        list(options?: { chatJid?: string; chats?: string[]; owner?: string; kinds?: AlyaStatusMediaKind[]; since?: number; limit?: number }): AlyaStatusEntry[]
        react(input: { statusId: string; owner?: string; chatJid?: string; emoji: string; options?: any }): Promise<any>
        like(input: { statusId: string; owner?: string; chatJid?: string; options?: any }): Promise<any>
        apply(input: { targets?: string[]; action: 'react' | 'like'; emoji?: string; chats?: string[]; list?: { kinds?: AlyaStatusMediaKind[]; since?: number; limit?: number }; intervalMs?: number; options?: any }): Promise<{ attempted: number; reacted: number; failed: { statusId: string; message: string }[] }>
        download(input: { chatJid: string; owner?: string; kinds?: AlyaStatusMediaKind[]; limit?: number; maxBytes?: number }): Promise<{ entry: AlyaStatusEntry; bytes: Uint8Array }[]>
        downloadGroup(groupJid: string, options?: { owner?: string; kinds?: AlyaStatusMediaKind[]; limit?: number; maxBytes?: number }): Promise<{ entry: AlyaStatusEntry; bytes: Uint8Array }[]>
    }
    group: {
        deleteStatus(input: { groupJid: string; messageId: string; participant?: string; options?: any }): Promise<any>
    }
    privacy: {
        sendBlockList(input: { to: string; title?: string; options?: any }): Promise<any>
    }
    newsletter: {
        uploadMedia(input: { filePath: string | Uint8Array; mediaType: 'image' | 'video' | 'audio' | 'gif'; timeoutMs?: number }): Promise<Record<string, any> & { mediaHandle: string }>
        sendStatus(input: any): Promise<{ id: string; serverId?: number; ack: any; payload: Uint8Array }>
        reactToStatus(input: { jid: string; messageId: string; parentServerId: number | string; reaction?: string }): Promise<any>
        revokeStatus(input: { jid: string; statusId: string }): Promise<any>
        fetchStatuses(input: { jid: string; count?: number; since?: number; before?: number | string; after?: number | string }): Promise<{ jid?: string; t?: number; statuses: any[] }>
    }
    links: {
        evaluateGroupLink(event: any, options?: { kinds?: AlyaLinkKind[]; deleteMessage?: boolean; isAllowedSender?: (groupJid: string, senderJid: string) => Promise<boolean> }): Promise<{ matched: boolean; action: 'ignored' | 'allowed' | 'deleted' | 'delete_failed'; kind?: AlyaLinkKind; url?: string; error?: string }>
        createAdminAllowList(loadMetadata: (groupJid: string) => Promise<any>): (groupJid: string, senderJid: string) => Promise<boolean>
    }
    parseCallLogRecord(record: any): any
    dispose(): void
}
