import { isHostedLidUser, isHostedPnUser, isJidGroup, jidNormalizedUser } from '../WABinary/jid-utils.js'

const PN_DOMAIN = '@s.whatsapp.net'
const LID_DOMAIN = '@lid'

const isString = value => typeof value === 'string' && value.trim().length > 0

const asPN = value => {
    if (!isString(value)) {
        return null
    }

    const jid = value.trim()
    if (/^\d+$/.test(jid)) {
        return `${jid}${PN_DOMAIN}`
    }

    const isPn = jid.endsWith(PN_DOMAIN) || isHostedPnUser(jid)
    if (!isPn) {
        return null
    }

    const normalized = jidNormalizedUser(jid)
    return normalized.endsWith(PN_DOMAIN) || isHostedPnUser(normalized) ? normalized : null
}

const asLID = value => {
    if (!isString(value)) {
        return null
    }

    const jid = value.trim()
    if (!jid.endsWith(LID_DOMAIN) && !isHostedLidUser(jid)) return null
    const domain = isHostedLidUser(jid) ? '@hosted.lid' : LID_DOMAIN
    if (jid.slice(0, -domain.length).length === 0) return null

    const normalized = jidNormalizedUser(jid)
    return normalized.endsWith(LID_DOMAIN) || isHostedLidUser(normalized) ? normalized : null
}

const getQuotedCandidates = message => {
    const quoted = message?.quoted ?? message?.quotedMessage ?? message?.contextInfo?.quotedMessage
    if (!quoted || typeof quoted !== 'object') {
        return []
    }

    return [
        quoted.sender,
        quoted.participant,
        quoted.key?.participant,
        quoted.key?.remoteJid
    ]
}

const getCandidates = (message, target) => {
    const contextInfo = message?.message?.extendedTextMessage?.contextInfo
        ?? message?.message?.imageMessage?.contextInfo
        ?? message?.message?.videoMessage?.contextInfo
        ?? message?.message?.documentMessage?.contextInfo
        ?? message?.contextInfo

    return [
        target,
        message?.mentionedJid?.[0],
        message?.mentionedJids?.[0],
        message?.mentions?.[0],
        ...getQuotedCandidates(message),
        contextInfo?.mentionedJid?.[0],
        contextInfo?.participant,
        message?.sender,
        message?.participant,
        message?.key?.participant,
        message?.jid,
        message?.key?.remoteJid
    ].filter(isString)
}

const getPNFromNativeMapping = async (conn, lid) => {
    const getPNForLID = conn?.signalRepository?.lidMapping?.getPNForLID
    if (typeof getPNForLID !== 'function') {
        return null
    }

    try {
        return asPN(await getPNForLID.call(conn.signalRepository.lidMapping, lid))
    } catch {
        return null
    }
}

const getPNFromMetadata = async (conn, message, lid) => {
    const groupMetadata = conn?.groupMetadata
    if (typeof groupMetadata !== 'function') {
        return null
    }

    const chat = message?.chat ?? message?.key?.remoteJid
    if (!isString(chat) || !isJidGroup(chat)) {
        return null
    }

    try {
        const metadata = await groupMetadata.call(conn, chat)
        const participants = Array.isArray(metadata?.participants) ? metadata.participants : []
        const participant = participants.find(entry => {
            if (!entry || typeof entry !== 'object') {
                return false
            }
            return [entry.id, entry.lid, entry.phoneNumber].some(value => asLID(value) === lid)
        })

        if (!participant) {
            return null
        }

        return asPN(participant.phoneNumber) ?? asPN(participant.id)
    } catch {
        return null
    }
}

const resolveCandidate = async (conn, message, candidate) => {
    const pn = asPN(candidate)
    if (pn) {
        return pn
    }

    const lid = asLID(candidate)
    if (!lid) {
        return null
    }

    return await getPNFromNativeMapping(conn, lid)
        ?? await getPNFromMetadata(conn, message, lid)
}

/**
 * Resolve a message target to its phone-number JID.
 *
 * @param {any} conn Baileys socket/connection.
 * @param {any} message Message-like object containing target hints.
 * @param {string|null|undefined} target Explicit target, taking precedence.
 * @returns {Promise<string|null>} A normalized PN JID, or null when unavailable.
 */
export const resolveJid = async (conn, message, target) => {
    for (const candidate of getCandidates(message, target)) {
        const resolved = await resolveCandidate(conn, message, candidate)
        if (resolved) {
            return resolved
        }
    }

    return null
}

/**
 * Resolve multiple message targets while preserving input order.
 *
 * @param {any} conn Baileys socket/connection.
 * @param {any} message Message-like object containing target hints.
 * @param {Array<string|null|undefined>} targets Explicit targets.
 * @returns {Promise<Array<string|null>>} Resolved PN JIDs in input order.
 */
export const resolveJids = async (conn, message, targets = []) => {
    if (!Array.isArray(targets)) {
        return []
    }

    return Promise.all(targets.map(target => resolveJid(conn, message, target)))
}
