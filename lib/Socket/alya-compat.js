function unwrapMessage(message) {
    let current = message?.message || message || {}
    for (let depth = 0; depth < 5; depth += 1) {
        const wrapped = current.ephemeralMessage?.message ||
            current.viewOnceMessage?.message ||
            current.viewOnceMessageV2?.message ||
            current.documentWithCaptionMessage?.message
        if (!wrapped) break
        current = wrapped
    }
    return current
}

function mediaKind(message) {
    const content = unwrapMessage(message)
    if (content.imageMessage) return "image"
    if (content.videoMessage) return "video"
    if (content.audioMessage) return "audio"
    if (content.documentMessage) return "document"
    if (content.stickerMessage) return "sticker"
    return null
}

function toSafeNumber(value) {
    if (value == null) return 0
    const number = typeof value?.toNumber === "function" ? value.toNumber() : Number(value)
    return Number.isFinite(number) ? number : 0
}

export function parseCallLogRecord(record) {
    if (!record || typeof record !== "object" || !record.callId) return null
    const results = ["CONNECTED", "REJECTED", "CANCELLED", "ACCEPTEDELSEWHERE", "MISSED", "INVALID", "UNAVAILABLE", "UPCOMING", "FAILED", "ABANDONED", "ONGOING"]
    const types = ["REGULAR", "SCHEDULED_CALL", "VOICE_CHAT"]
    const result = Number.isInteger(Number(record.callResult)) ? results[Number(record.callResult)] : undefined
    const callType = types[Number(record.callType)] || "REGULAR"
    const participants = Array.isArray(record.participants)
        ? record.participants.filter(item => item?.userJid).map(item => ({
            jid: item.userJid,
            ...(results[Number(item.callResult)] ? { callResult: results[Number(item.callResult)] } : {})
        }))
        : []
    return {
        callId: String(record.callId),
        ...(record.callCreatorJid ? { creatorJid: record.callCreatorJid } : {}),
        ...(record.groupJid ? { groupJid: record.groupJid } : {}),
        ...(record.startTime != null ? { startTime: toSafeNumber(record.startTime) } : {}),
        ...(record.duration != null ? { duration: toSafeNumber(record.duration) } : {}),
        ...(result ? { result } : {}),
        callType,
        isIncoming: record.isIncoming === true,
        isVideo: record.isVideo === true,
        isCallLink: record.isCallLink === true,
        isDndMode: record.isDndMode === true,
        ...(record.scheduledCallId ? { scheduledCallId: record.scheduledCallId } : {}),
        participants
    }
}

export function findFirstAlyaLink(text) {
    const patterns = [
        ["tiktok", /\b(?:https?:\/\/)?(?:www\.)?(?:vm|vt)\.tiktok\.com(?:\/[^\s]*)?/i],
        ["tiktok", /\b(?:https?:\/\/)?(?:www\.)?tiktok\.com(?:\/[^\s]*)?/i],
        ["instagram", /\b(?:https?:\/\/)?(?:www\.)?instagram\.com(?:\/[^\s]*)?/i],
        ["facebook", /\b(?:https?:\/\/)?(?:www\.)?fb\.com(?:\/[^\s]*)?/i],
        ["facebook", /\b(?:https?:\/\/)?(?:www\.)?facebook\.com(?:\/[^\s]*)?/i],
        ["whatsapp_group_invite", /\b(?:https?:\/\/)?(?:www\.)?chat\.whatsapp\.com\/[a-z0-9]+/i],
        ["whatsapp_channel", /\bwhatsapp:\/\/(?:channel\/)?\/?[a-z0-9]+/i],
        ["telegram", /\b(?:https?:\/\/)?(?:www\.)?t\.me(?:\/[^\s]*)?/i],
        ["generic", /https?:\/\/[^\s]+/i]
    ]
    const input = String(text || "")
    for (const [kind, pattern] of patterns) {
        const match = input.match(pattern)
        if (match) return { kind, url: match[0] }
    }
    return null
}

export function getAlyaMessageText(message) {
    const content = unwrapMessage(message)
    return content.conversation ||
        content.extendedTextMessage?.text ||
        content.imageMessage?.caption ||
        content.videoMessage?.caption ||
        content.documentMessage?.caption || ""
}

export function installAlyaCompatibility(sock, { maxStatuses = 1000, statusTtlMs = 24 * 60 * 60 * 1000 } = {}) {
    if (!sock?.sendMessage || !sock?.ev?.on) throw new TypeError("Socket Yowtech tidak valid.")
    const statuses = new Map()

    function pruneStatuses() {
        const threshold = Date.now() - statusTtlMs
        for (const [key, item] of statuses) {
            if (item.timestampMs < threshold) statuses.delete(key)
        }
        while (statuses.size > maxStatuses) statuses.delete(statuses.keys().next().value)
    }

    const onUpsert = event => {
        for (const message of event?.messages || []) {
            const key = message?.key || {}
            const remoteJid = key.remoteJid
            const content = unwrapMessage(message)
            const isStatus = remoteJid === "status@broadcast" ||
                Boolean(content.groupStatusMessage || content.groupStatusMessageV2)
            const kind = mediaKind(message)
            if (!isStatus || !kind || !key.id) continue
            const entry = {
                id: key.id,
                chatJid: remoteJid,
                ownerJid: key.participant || key.remoteJid,
                fromMe: key.fromMe === true,
                timestampMs: toSafeNumber(message.messageTimestamp) * 1000 || Date.now(),
                mediaKind: kind,
                mimetype: content[`${kind}Message`]?.mimetype,
                caption: content[`${kind}Message`]?.caption,
                message
            }
            statuses.set(`${remoteJid}:${key.id}`, entry)
        }
        pruneStatuses()
    }
    sock.ev.on("messages.upsert", onUpsert)

    const status = {
        list({ chatJid, chats, owner, kinds, since, limit = 100 } = {}) {
            pruneStatuses()
            const allowedChats = chats ? new Set(chats) : null
            const allowedKinds = kinds ? new Set(kinds) : null
            const maxItems = Math.max(0, Math.trunc(Number(limit) || 0))
            if (maxItems === 0) return []
            return [...statuses.values()]
                .filter(entry => (!chatJid || entry.chatJid === chatJid) &&
                    (!allowedChats || allowedChats.has(entry.chatJid)) &&
                    (!owner || entry.ownerJid === owner) &&
                    (!allowedKinds || allowedKinds.has(entry.mediaKind)) &&
                    (since === undefined || entry.timestampMs >= since))
                .slice(-maxItems)
        },
        async react({ statusId, owner, chatJid = "status@broadcast", emoji, options } = {}) {
            if (!statusId || typeof emoji !== "string") throw new TypeError("statusId dan emoji wajib diisi.")
            const key = { remoteJid: chatJid, id: statusId, fromMe: false }
            if (owner) key.participant = owner
            const sendOptions = options || (chatJid === "status@broadcast" && owner ? { statusJidList: [owner] } : {})
            return sock.sendMessage(chatJid, {
                react: { key, text: emoji, senderTimestampMs: Date.now() }
            }, sendOptions)
        },
        async like(input = {}) {
            return status.react({ ...input, emoji: "❤️" })
        },
        async apply({ targets, action, emoji, chats = ["status@broadcast"], list: listOptions = {}, intervalMs = 0, options } = {}) {
            if (!action || !["react", "like"].includes(action)) throw new TypeError("action harus react atau like.")
            const owners = Array.isArray(targets) && targets.length ? new Set(targets) : null
            const entries = status.list({ chats, ...listOptions }).filter(entry => !owners || owners.has(entry.ownerJid))
            const failed = []
            let reacted = 0
            for (let index = 0; index < entries.length; index += 1) {
                const entry = entries[index]
                try {
                    const input = { statusId: entry.id, owner: entry.ownerJid, chatJid: entry.chatJid, options }
                    if (action === "like") await status.like(input)
                    else await status.react({ ...input, emoji: emoji ?? "" })
                    reacted += 1
                } catch (error) {
                    failed.push({ statusId: entry.id, message: String(error?.message || error) })
                }
                if (intervalMs > 0 && index < entries.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, Math.min(60000, Number(intervalMs))))
                }
            }
            return { attempted: entries.length, reacted, failed }
        },
        async download({ chatJid, owner, kinds, limit = 100, maxBytes = 25 * 1024 * 1024 } = {}) {
            if (!chatJid) throw new TypeError("chatJid wajib diisi.")
            const entries = status.list({ chatJid, owner, kinds, limit })
            const { downloadMediaMessage } = await import("../Utils/messages.js")
            const downloaded = []
            for (const entry of entries) {
                const bytes = await downloadMediaMessage(entry.message, "buffer", {}, sock)
                if (bytes?.byteLength > maxBytes) {
                    throw new RangeError(`Media status ${entry.id} melebihi batas ${maxBytes} byte.`)
                }
                downloaded.push({ entry, bytes })
            }
            return downloaded
        },
        async downloadGroup(groupJid, options = {}) {
            return status.download({ ...options, chatJid: groupJid })
        }
    }

    const group = {
        async deleteStatus({ groupJid, messageId, participant, options } = {}) {
            if (!groupJid?.endsWith("@g.us") || !messageId) throw new TypeError("groupJid dan messageId status wajib valid.")
            return sock.sendMessage(groupJid, {
                delete: {
                    remoteJid: groupJid,
                    id: messageId,
                    fromMe: !participant,
                    ...(participant ? { participant } : {})
                }
            }, options)
        }
    }

    const privacy = {
        async sendBlockList({ to, title = "Blocked contacts", options } = {}) {
            if (!to) throw new TypeError("Tujuan pesan (to) wajib diisi.")
            if (typeof sock.fetchBlocklist !== "function") throw new Error("fetchBlocklist tidak tersedia.")
            const blocked = await sock.fetchBlocklist()
            const list = Array.isArray(blocked) ? blocked : blocked?.jids || []
            const text = [
                `*${title}*`,
                `Total: ${list.length}`,
                "",
                ...(list.length ? list.map((jid, index) => `${index + 1}. ${jid}`) : ["No blocked contacts."])
            ].join("\n")
            return sock.sendMessage(to, { text }, options)
        }
    }

    const newsletter = {
        async uploadMedia({ filePath, mediaType, timeoutMs } = {}) {
            if (!filePath || !mediaType) throw new TypeError("filePath dan mediaType wajib diisi.")
            if (!["image", "video", "audio", "gif"].includes(mediaType)) {
                throw new TypeError("mediaType harus image, video, audio, atau gif.")
            }
            if (typeof sock.waUploadToServer !== "function") throw new Error("waUploadToServer tidak tersedia pada socket ini.")
            const uploaded = await sock.waUploadToServer(filePath, { mediaType, timeoutMs, newsletter: true })
            const mediaHandle = uploaded?.fbid ?? uploaded?.id
            if (mediaHandle === undefined || mediaHandle === null || mediaHandle === "") {
                throw new Error("Upload tidak mengembalikan media handle newsletter.")
            }
            return { ...uploaded, mediaHandle: String(mediaHandle) }
        },
        sendStatus: args => requireMethod(sock, "newsletterSendStatus", args),
        reactToStatus: args => requireMethod(sock, "newsletterReactStatus", args),
        revokeStatus: args => requireMethod(sock, "newsletterRevokeStatus", args),
        fetchStatuses: args => requireMethod(sock, "newsletterFetchStatuses", args)
    }

    const links = {
        async evaluateGroupLink(event, { kinds, deleteMessage = true, isAllowedSender } = {}) {
            const key = event?.key || event?.message?.key || {}
            const chatJid = key.remoteJid
            const sender = key.participant
            const ignored = { matched: false, action: "ignored" }
            if (!chatJid?.endsWith("@g.us") || key.fromMe || !sender) return ignored
            const match = findFirstAlyaLink(getAlyaMessageText(event))
            if (!match || (kinds && !kinds.includes(match.kind))) return ignored
            try {
                let allowed
                if (isAllowedSender) {
                    allowed = await isAllowedSender(chatJid, sender)
                } else {
                    const metadata = await sock.groupMetadata(chatJid)
                    const participant = metadata?.participants?.find(item => item.id === sender || item.phoneNumber === sender || item.lid === sender)
                    allowed = metadata?.owner === sender || participant?.admin === "admin" || participant?.admin === "superadmin"
                }
                if (allowed) return { matched: true, action: "allowed", kind: match.kind, url: match.url }
                if (!deleteMessage) return { matched: true, action: "delete_failed", kind: match.kind, url: match.url }
                await sock.sendMessage(chatJid, {
                    delete: { remoteJid: chatJid, id: key.id, fromMe: false, participant: sender }
                })
                return { matched: true, action: "deleted", kind: match.kind, url: match.url }
            } catch (error) {
                return { matched: true, action: "delete_failed", kind: match.kind, url: match.url, error: String(error?.message || error) }
            }
        },
        createAdminAllowList(loadMetadata) {
            if (typeof loadMetadata !== "function") throw new TypeError("loadMetadata harus berupa fungsi")
            return async (groupJid, senderJid) => {
                const metadata = await loadMetadata(groupJid)
                const participant = metadata?.participants?.find(item => item.id === senderJid || item.phoneNumber === senderJid || item.lid === senderJid)
                return metadata?.owner === senderJid || participant?.admin === "admin" || participant?.admin === "superadmin"
            }
        }
    }

    const onCallLog = event => {
        const parsed = parseCallLogRecord(event?.record || event)
        if (parsed) sock.ev.emit("alya.call-log", parsed)
    }
    sock.ev.on("call-log", onCallLog)

    const api = {
        status,
        group,
        privacy,
        newsletter,
        links,
        parseCallLogRecord,
        dispose() {
            sock.ev.off?.("messages.upsert", onUpsert)
            sock.ev.off?.("call-log", onCallLog)
        }
    }
    sock.alya = api
    return api
}

function requireMethod(sock, name, args) {
    if (typeof sock[name] !== "function") throw new Error(`Metode ${name} belum tersedia. Pastikan SC memakai vendor/Yowtech yang sudah diperbarui.`)
    return sock[name](args)
}
