import { randomBytes } from 'crypto';
import { proto } from '../../WAProto/index.js';
import { generateMessageIDV2 } from './generics.js';
import { generateWAMessageFromContent } from './messages.js';

const IMAGE_TTL_MS = 24 * 60 * 60 * 1000;
const FORWARD_ORIGIN_META_AI = proto.ContextInfo.ForwardOrigin.META_AI;
export const RICH_MENU_MAX_PAYLOAD_BYTES = 64 * 1024;

const toolCallId = () => randomBytes(8).toString('hex');
const section = viewModel => ({ __typename: 'GenAIUnifiedResponseSection', view_model: viewModel });
const single = primitive => section({ __typename: 'GenAISingleLayoutViewModel', primitive });

const inlineImagePrimitive = (image, { width, height, padding }) => ({
    __typename: 'GenAIMarkdownTextUXPrimitive',
    text: '{{header}}.{{/header}}',
    inline_entities: [{
        __typename: 'GenAITextInlineEntity',
        key: 'header',
        metadata: {
            __typename: 'GenAILatexItem',
            latex_expression: '.',
            font_height: 24,
            padding,
            latex_image: {
                __typename: 'GenAIMediaItem',
                mime_type: image.mime_type || 'image/png',
                url: image.url,
                url_fallback: image.url,
                width: image.width || width,
                height: image.height || height,
                expiration_timestamp_ms: Date.now() + IMAGE_TTL_MS
            }
        }
    }]
});

const normalizeButton = (button, fallbackToast = '') => {
    const label = typeof button === 'string' ? button : (button?.label ?? button?.text ?? '');
    const toast = typeof button === 'object' && button?.toast !== undefined ? button.toast : fallbackToast;
    if (!String(label).trim()) {
        throw new TypeError('Setiap RichMenu button harus memiliki label/text non-kosong');
    }
    return {
        label: String(label),
        state: 'PENDING',
        kind: 'OTHER',
        tool_call_id: toolCallId(),
        toast: { label: String(toast || ''), __typename: 'GenAI3PExtWidgetToast' },
        __typename: 'GenAI3PExtWidgetCTA'
    };
};

const widgetPrimitive = (title, buttons = [], toast = '') => ({
    __typename: 'GenAI3PExtWidgetPrimitive',
    header: { __typename: 'GenAI3PExtWidgetStandardHeader', title: title || '' },
    body: {
        __typename: 'GenAI3PExtCalendarEventList',
        ctas: buttons.map(button => normalizeButton(button, toast)),
        sections: []
    }
});

/** Membangun content RichMenu; CTA di format internal ini bukan callback bot. */
export function buildRichMenuMessage(content = {}) {
    if (!content || typeof content !== 'object' || Array.isArray(content)) {
        throw new TypeError('buildRichMenuMessage: content harus berupa object');
    }
    const { header, body, footer } = content;
    const sections = [];
    let messageContextInfo;

    if (header) {
        const { disclaimer = false, disclaimerText = ' ', image, title = '' } = header;
        if (disclaimer) messageContextInfo = { botMetadata: { messageDisclaimerText: disclaimerText } };
        if (title) sections.push(single({ __typename: 'FOATextPrimitive', text: '# ' + title }));
        if (image?.url) {
            if (image.inline) {
                sections.push(single(inlineImagePrimitive(image, { width: 500, height: 500, padding: 4 })));
            }
            else {
                sections.push(single({
                    __typename: 'GenAIImagePrimitive',
                    preview_image: { __typename: 'GenAIMediaItem', mime_type: image.mime_type || 'image/png', url: image.url },
                    full_image: { __typename: 'GenAIMediaItem', mime_type: image.mime_type || 'image/png', url: image.url }
                }));
            }
        }
    }

    if (body) {
        const { cards, buttons, title = '', toast = '', carousel = false, row = false } = body;
        if (carousel || row) {
            if (Array.isArray(cards) && cards.length) {
                sections.push(section({
                    __typename: carousel ? 'GenAIHScrollLayoutViewModel' : 'GenAIActionRowLayoutViewModel',
                    primitives: cards.map(card => widgetPrimitive(card?.title, card?.buttons || [], card?.toast))
                }));
            }
        }
        else if (Array.isArray(buttons) && buttons.length) {
            sections.push(single(widgetPrimitive(title, buttons, toast)));
        }
    }

    if (footer) {
        const { text = '', url = '', image } = footer;
        const primitives = [];
        if (url) {
            primitives.push({ __typename: 'GenAIFooterActionPrimitive', cta_text: text || 'Open', cta_type: 'OPEN_URL', cta_url: url });
        }
        if (image?.url) primitives.push(inlineImagePrimitive(image, { width: 100, height: 100, padding: -5 }));
        if (primitives.length) sections.push({ view_model: { __typename: 'GenAIActionRowLayoutViewModel', primitives } });
    }

    if (!sections.length) {
        throw new TypeError('RichMenu kosong: isi header title/image, body buttons/cards, atau footer URL/image');
    }

    const data = Buffer.from(JSON.stringify({ sections }), 'utf8');
    if (data.byteLength > RICH_MENU_MAX_PAYLOAD_BYTES) {
        throw new RangeError(`RichMenu payload melebihi batas ${RICH_MENU_MAX_PAYLOAD_BYTES} byte`);
    }
    const contextInfo = { isForwarded: true, forwardOrigin: FORWARD_ORIGIN_META_AI, ...(content.contextInfo ?? {}) };
    const richResponseMessage = proto.AIRichResponseMessage.fromObject({
        unifiedResponse: { data },
        contextInfo
    });
    return proto.Message.fromObject({
        ...(messageContextInfo ? { messageContextInfo } : {}),
        botForwardedMessage: { message: { richResponseMessage } }
    });
}

/** Membuat lalu merelay content RichMenu; hasil payload hanya dapat dirender oleh klien yang mendukung format ini. */
export async function sendRichMenu(sock, jid, content = {}, options = {}) {
    if (!sock || typeof sock.relayMessage !== 'function') {
        throw new TypeError('sendRichMenu: socket harus menyediakan relayMessage()');
    }
    if (typeof jid !== 'string' || !jid) throw new TypeError('sendRichMenu: jid wajib berupa string non-kosong');
    const message = buildRichMenuMessage(content);
    const webMessage = generateWAMessageFromContent(jid, message, {
        userJid: options.userJid || sock.user?.id || sock.authState?.creds?.me?.id,
        quoted: options.quoted,
        messageId: options.messageId || generateMessageIDV2()
    });
    await sock.relayMessage(jid, webMessage.message, { messageId: webMessage.key.id }, webMessage);
    return { messageId: webMessage.key.id, message: webMessage.message };
}

export default { buildRichMenuMessage, sendRichMenu, RICH_MENU_MAX_PAYLOAD_BYTES };
