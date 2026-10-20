import { randomUUID } from 'crypto';
import { proto } from '../../WAProto/index.js';
import { generateMessageIDV2 } from './generics.js';
import { generateWAMessageFromContent } from './messages.js';

export const WEBUI_PRIMITIVE_TYPENAME = 'GenAIaeacdsnwHtmlPrimitive';
export const DEFAULT_BOT_JID = '867051314767696@bot';
export const DEFAULT_FORWARD_ORIGIN = proto.ContextInfo.ForwardOrigin.META_AI;
export const WEBUI_MAX_PAYLOAD_BYTES = 64 * 1024;

export const generateWebuiMessageId = () => generateMessageIDV2();

const normalizeForwardOrigin = (value) => {
    if (value === undefined || value === null || value === 'META_AI') {
        return proto.ContextInfo.ForwardOrigin.META_AI;
    }
    if (typeof value === 'number' && Object.values(proto.ContextInfo.ForwardOrigin).includes(value)) {
        return value;
    }
    throw new TypeError('forwardOrigin harus bernilai enum ContextInfo.ForwardOrigin yang dikenal');
};

/** Membuat payload Rich WebUI tanpa mengirimkannya. Format ini internal WhatsApp. */
export function buildWebuiMessage({ html, title = 'WebUI', botJid = DEFAULT_BOT_JID, forwardOrigin = DEFAULT_FORWARD_ORIGIN, responseId } = {}) {
    if (typeof html !== 'string' || html.length === 0) {
        throw new TypeError('buildWebuiMessage: html wajib berupa string non-kosong');
    }
    const htmlBytes = Buffer.byteLength(html, 'utf8');
    if (htmlBytes > WEBUI_MAX_PAYLOAD_BYTES) {
        throw new RangeError(`HTML melebihi batas ${WEBUI_MAX_PAYLOAD_BYTES} byte`);
    }
    if (typeof title !== 'string' || typeof botJid !== 'string' || !botJid) {
        throw new TypeError('title dan botJid harus berupa string; botJid tidak boleh kosong');
    }

    const uuid = responseId || randomUUID();
    const unifiedResponse = {
        response_id: uuid,
        sections: [{
            view_model: {
                primitive: {
                    __typename: WEBUI_PRIMITIVE_TYPENAME,
                    payload: html,
                    trusted_sources: []
                },
                __typename: 'GenAISingleLayoutViewModel'
            }
        }]
    };
    const richResponseMessage = proto.AIRichResponseMessage.fromObject({
        messageType: proto.AIRichResponseMessageType.AI_RICH_RESPONSE_TYPE_STANDARD,
        submessages: [{
            messageType: proto.AIRichResponseSubMessageType.AI_RICH_RESPONSE_TEXT,
            messageText: title
        }],
        unifiedResponse: { data: Buffer.from(JSON.stringify(unifiedResponse), 'utf8') },
        contextInfo: {
            forwardingScore: 1,
            isForwarded: true,
            forwardedAiBotMessageInfo: { botJid },
            forwardOrigin: normalizeForwardOrigin(forwardOrigin)
        }
    });

    return proto.Message.fromObject({
        messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
            botMetadata: { botResponseId: uuid }
        },
        botForwardedMessage: { message: { richResponseMessage } }
    });
}

/** Membuat lalu mengirim Rich WebUI melalui relay socket; HTML hanya boleh dari sumber tepercaya. */
export async function sendInlineWebUI(sock, jid, html, title = 'WebUI', options = {}) {
    if (!sock || typeof sock.relayMessage !== 'function') {
        throw new TypeError('sendInlineWebUI: socket harus menyediakan relayMessage()');
    }
    if (typeof jid !== 'string' || !jid) {
        throw new TypeError('sendInlineWebUI: jid wajib berupa string non-kosong');
    }
    const { messageId: customMessageId, ...buildOptions } = options;
    const message = buildWebuiMessage({ html, title, ...buildOptions });
    const webMessage = generateWAMessageFromContent(jid, message, {
        userJid: buildOptions.userJid || sock.user?.id || sock.authState?.creds?.me?.id,
        quoted: buildOptions.quoted,
        messageId: customMessageId || generateWebuiMessageId()
    });
    await sock.relayMessage(jid, webMessage.message, { messageId: webMessage.key.id }, webMessage);
    return { messageId: webMessage.key.id, message: webMessage.message };
}

export default {
    buildWebuiMessage,
    sendInlineWebUI,
    generateWebuiMessageId,
    WEBUI_PRIMITIVE_TYPENAME,
    DEFAULT_BOT_JID,
    DEFAULT_FORWARD_ORIGIN,
    WEBUI_MAX_PAYLOAD_BYTES
};
