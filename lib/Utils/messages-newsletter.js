const MAX_NEWSLETTER_BUTTONS = 3;

export const normalizeNewsletterJid = (jid) => {
    if (typeof jid !== 'string' || !jid.trim()) {
        throw new TypeError(`newsletter target must be a non-empty id or @newsletter jid, got ${String(jid)}`);
    }
    const value = jid.trim();
    if (value.includes('@')) {
        if (!value.endsWith('@newsletter') || value.slice(0, -'@newsletter'.length).length === 0) {
            throw new TypeError(`newsletter target must be a bare id or @newsletter jid, got ${jid}`);
        }
        return value;
    }
    return `${value}@newsletter`;
};

const asMediaInput = (media) => {
    if (typeof media === 'string') return { url: media };
    if (media === undefined || media === null) throw new TypeError('newsletter media is required');
    return media;
};

const isOptionsObject = value => value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Uint8Array);
const splitCaptionOptions = (caption, options) => isOptionsObject(caption) && options === undefined
    ? { caption: undefined, options: caption }
    : { caption, options: options ?? {} };
const assertButtons = buttons => {
    if (!Array.isArray(buttons) || buttons.length === 0 || buttons.length > MAX_NEWSLETTER_BUTTONS) {
        throw new RangeError(`newsletter buttons must contain 1..${MAX_NEWSLETTER_BUTTONS} items`);
    }
    if (buttons.some(button => !button || typeof button !== 'object')) throw new TypeError('newsletter buttons must be objects');
    return buttons;
};
const assertUrl = url => {
    if (typeof url !== 'string' || !/^https?:\/\/[^\s]+$/i.test(url)) throw new TypeError('newsletter URL must be an http(s) URL');
    return url;
};
const assertMessageId = messageId => {
    if (typeof messageId !== 'string' && typeof messageId !== 'number' || String(messageId).trim() === '') {
        throw new TypeError('newsletter messageId is required');
    }
    return String(messageId);
};

export const makeNewsletterUtils = (conn) => {
    if (!conn || typeof conn.sendMessage !== 'function' || typeof conn.newsletterReactMessage !== 'function') {
        throw new TypeError('makeNewsletterUtils requires a connection with sendMessage and newsletterReactMessage');
    }
    const send = (jid, content, options) => conn.sendMessage(normalizeNewsletterJid(jid), content, options ?? {});
    const media = (jid, key, value, caption, options) => {
        const split = splitCaptionOptions(caption, options);
        return send(jid, { [key]: asMediaInput(value), ...(split.caption !== undefined ? { caption: split.caption } : {}) }, split.options);
    };
    const withContent = (jid, content, options) => {
        if (!content || typeof content !== 'object' || Array.isArray(content)) throw new TypeError('newsletter content must be an object');
        return send(jid, content, options);
    };
    const edit = (jid, messageId, content, options = {}) => {
        const normalized = normalizeNewsletterJid(jid);
        const id = assertMessageId(messageId);
        if (!content || typeof content !== 'object' || Array.isArray(content)) throw new TypeError('edited newsletter content must be an object');
        return conn.sendMessage(normalized, { ...content, edit: { remoteJid: normalized, id, fromMe: true } }, options ?? {});
    };
    const remove = (jid, messageId, options = {}) => {
        const normalized = normalizeNewsletterJid(jid);
        const id = assertMessageId(messageId);
        return conn.sendMessage(normalized, { delete: { remoteJid: normalized, id, fromMe: true } }, options ?? {});
    };
    return {
        sendNewsletterText: (jid, text, options = {}) => send(jid, { text }, options),
        sendNewsletterImage: (jid, image, caption, options) => media(jid, 'image', image, caption, options),
        sendNewsletterVideo: (jid, video, caption, options) => media(jid, 'video', video, caption, options),
        sendNewsletterPtv: (jid, video, caption, options) => {
            const split = splitCaptionOptions(caption, options);
            return send(jid, { video: asMediaInput(video), ptv: true, ...(split.caption !== undefined ? { caption: split.caption } : {}) }, split.options);
        },
        sendNewsletterAudio: (jid, audio, options = {}) => send(jid, { audio: asMediaInput(audio) }, options),
        sendNewsletterDocument: (jid, document, fileName, options) => {
            const split = splitCaptionOptions(fileName, options);
            const content = { document: asMediaInput(document), ...(typeof split.caption === 'string' ? { fileName: split.caption } : {}) };
            if (typeof split.caption !== 'string' && split.caption !== undefined) content.caption = split.caption;
            return send(jid, content, split.options);
        },
        sendNewsletterSticker: (jid, sticker, options = {}) => send(jid, { sticker: asMediaInput(sticker) }, options),
        sendNewsletterButtons: (jid, textOrContent, buttons, footer, options) => {
            if (textOrContent && typeof textOrContent === 'object' && !Array.isArray(textOrContent) && (buttons === undefined || !Array.isArray(buttons))) {
                const content = { ...textOrContent, buttons: assertButtons(textOrContent.buttons) };
                return withContent(jid, content, buttons ?? footer ?? options ?? {});
            }
            const content = { text: textOrContent, buttons: assertButtons(buttons), ...(footer !== undefined ? { footer } : {}) };
            return send(jid, content, options ?? {});
        },
        sendNewsletterList: (jid, textOrContent, sections, buttonText, title, footer, options) => {
            if (textOrContent && typeof textOrContent === 'object' && !Array.isArray(textOrContent)) {
                const content = { ...textOrContent };
                if (!Array.isArray(content.sections) || content.sections.length === 0) throw new TypeError('newsletter list sections are required');
                const contentOptions = !Array.isArray(sections) ? sections : buttonText && isOptionsObject(buttonText) ? buttonText : options ?? {};
                return withContent(jid, content, contentOptions);
            }
            if (!Array.isArray(sections) || sections.length === 0 || sections.some(section => !section || typeof section !== 'object')) throw new TypeError('newsletter list sections are required');
            if (typeof buttonText !== 'string' || !buttonText.trim()) throw new TypeError('newsletter list buttonText is required');
            return send(jid, { text: textOrContent, sections, buttonText, ...(title !== undefined ? { title } : {}), ...(footer !== undefined ? { footer } : {}) }, options ?? {});
        },
        sendNewsletterCtaUrl: (jid, text, url, displayText = 'Visit', options = {}) => {
            if (isOptionsObject(displayText)) { options = displayText; displayText = 'Visit'; }
            const validUrl = assertUrl(url);
            return send(jid, {
                text,
                nativeFlow: [{ name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: displayText, url: validUrl, merchant_url: validUrl }) }]
            }, options ?? {});
        },
        sendNewsletterReact: (jid, serverId, reaction) => {
            const normalized = normalizeNewsletterJid(jid);
            if ((typeof serverId !== 'string' && typeof serverId !== 'number') || String(serverId).trim() === '') throw new TypeError('newsletter serverId is required');
            return conn.newsletterReactMessage(normalized, serverId, reaction);
        },
        editNewsletterMessage: edit,
        deleteNewsletterMessage: remove,
        sendNewsletterEdit: edit,
        sendNewsletterDelete: remove
    };
};
