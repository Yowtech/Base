import { randomBytes, randomUUID } from 'crypto';
import { proto } from '../../WAProto/index.js';
import { generateWAMessageFromContent } from './messages.js';

const DEFAULT_CATALOG_ID = 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json';

/** Builder deklaratif untuk widget BloksWidget/A2UI. Rendering bergantung pada dukungan klien WhatsApp. */
export class A2UI {
    constructor({ catalogId = DEFAULT_CATALOG_ID, version = 'v0.9' } = {}) {
        if (typeof catalogId !== 'string' || !catalogId) throw new TypeError('catalogId harus berupa string non-kosong');
        if (typeof version !== 'string' || !version) throw new TypeError('version harus berupa string non-kosong');
        this._version = version;
        this._catalogId = catalogId;
        this._components = new Map();
        this._counter = 0;
        this._rootChildren = [];
        this._listCardPayload = undefined;
    }
    #nextId(prefix) { return `${prefix}_${(this._counter++).toString(36)}`; }
    #reg(id, component, extra = {}) {
        id ??= this.#nextId(component.toLowerCase());
        if (typeof id !== 'string' || !id) throw new TypeError('Component id harus berupa string non-kosong');
        if (this._components.has(id)) throw new Error(`Component id "${id}" sudah digunakan`);
        this._components.set(id, { id, component, ...extra });
        return id;
    }
    text(text, { id, variant = 'body' } = {}) {
        if (typeof text !== 'string') throw new TypeError('text harus berupa string');
        return this.#reg(id, 'Text', { text, variant });
    }
    image(url, { id, variant, fit = 'cover' } = {}) {
        if (typeof url !== 'string' || !url) throw new TypeError('image(url) memerlukan URL non-kosong');
        return this.#reg(id, 'Image', { url, ...(variant ? { variant } : {}), fit });
    }
    video(url, { id } = {}) {
        if (typeof url !== 'string' || !url) throw new TypeError('video(url) memerlukan URL non-kosong');
        return this.#reg(id, 'Video', { url });
    }
    checkbox(label, { id, value = false } = {}) { return this.#reg(id, 'CheckBox', { label: String(label), value: Boolean(value) }); }
    textField(label, { id, variant = 'text' } = {}) { return this.#reg(id, 'TextField', { label: String(label), variant }); }
    button(childId, { id, variant = 'primary', action } = {}) {
        if (!childId) throw new TypeError('button(childId) memerlukan id komponen child');
        return this.#reg(id, 'Button', { child: childId, variant, ...(action ? { action } : {}) });
    }
    card(childId, { id } = {}) {
        if (!childId) throw new TypeError('card(childId) memerlukan id komponen child');
        return this.#reg(id, 'Card', { child: childId });
    }
    column(children = [], { id, justify, align } = {}) {
        if (!Array.isArray(children) || !children.length) throw new TypeError('column(children) memerlukan id child');
        return this.#reg(id, 'Column', { children, ...(justify ? { justify } : {}), ...(align ? { align } : {}) });
    }
    row(children = [], { id } = {}) {
        if (!Array.isArray(children) || !children.length) throw new TypeError('row(children) memerlukan id child');
        return this.#reg(id, 'Row', { children });
    }
    divider({ id } = {}) { return this.#reg(id, 'Divider', {}); }
    choicePicker(label, options, { id, variant = 'mutuallyExclusive', value, displayStyle = 'checkbox', filterable = false } = {}) {
        if (!Array.isArray(options) || !options.length) throw new TypeError('choicePicker memerlukan options non-kosong');
        return this.#reg(id, 'ChoicePicker', { label: String(label), variant, ...(value !== undefined ? { value } : {}), options, displayStyle, filterable });
    }
    root(children) {
        if (!Array.isArray(children) || !children.length) throw new TypeError('root(children) memerlukan array id non-kosong');
        this._rootChildren = [...children];
        return this;
    }
    listCard({ title, items, fallbackText, uuid = randomUUID() } = {}) {
        if (!title) throw new TypeError('listCard memerlukan title');
        if (!Array.isArray(items) || !items.length) throw new TypeError('listCard memerlukan items non-kosong');
        this._listCardPayload = {
            uuid,
            data: JSON.stringify({
                type: 'list_card',
                title,
                fallback_text: fallbackText ?? '',
                items: items.map(item => ({
                    asset_id: item.assetId ?? randomUUID().replace(/-/g, '').slice(0, 17),
                    asset_type: item.assetType ?? 'PRODUCT_ITEM',
                    title: item.title,
                    trailing_label: item.price ?? item.trailingLabel ?? '',
                    trailing_emphasis: item.emphasis ?? 'strong'
                }))
            }),
            type: 'im_a2ui',
            fallback: fallbackText ?? ''
        };
        return this;
    }
    build({ uuid = randomUUID(), surfaceId, type = 'im_a2ui', wrapped = true } = {}) {
        if (this._listCardPayload) return { ...this._listCardPayload };
        if (!this._rootChildren.length) throw new Error('Panggil root([...ids]) sebelum build()');
        for (const id of this._rootChildren) {
            if (!this._components.has(id)) throw new Error(`Root merujuk component id yang tidak dikenal: ${id}`);
        }
        const components = [{ id: 'root', component: 'Column', children: this._rootChildren }, ...this._components.values()];
        const data = wrapped
            ? { version: this._version, createSurface: { surfaceId: surfaceId ?? `starcore-widget=${uuid}`, catalogId: this._catalogId, components } }
            : { components };
        return { uuid, data: JSON.stringify(data), type };
    }
}

/** Mengirim widget A2UI dengan relayMessage target; format ini internal dan tidak dijamin dirender klien. */
export async function sendA2UIWidget(client, jid, {
    a2ui,
    bodyText = '',
    footer = '',
    buttons = [],
    contextInfo = {},
    expiration,
    quoted,
    type = 'im_a2ui',
    wrapped = true,
    singleScreen = false,
    userJid
} = {}) {
    if (!client || typeof client.relayMessage !== 'function') throw new TypeError('Socket harus menyediakan relayMessage()');
    if (typeof jid !== 'string' || !jid) throw new TypeError('jid wajib berupa string non-kosong');
    if (!(a2ui instanceof A2UI)) throw new TypeError('a2ui harus berupa instance A2UI');
    if (!Array.isArray(buttons)) throw new TypeError('buttons harus berupa array');

    const nativeFlowMessage = buttons.length
        ? {
            buttons: buttons.map(button => ({
                name: button.name ?? 'cta_url',
                buttonParamsJson: typeof button.params === 'string' ? button.params : JSON.stringify(button.params ?? {})
            })),
            messageParamsJson: '{}',
            messageVersion: 1
        }
        : { messageParamsJson: '' };
    const ctx = expiration || Object.keys(contextInfo).length
        ? { contextInfo: { ...(expiration ? { expiration } : {}), ...contextInfo } }
        : {};
    const interactiveMessage = singleScreen
        ? { nativeFlowMessage, bloksWidget: a2ui.build({ type, wrapped }), ...ctx }
        : {
            ...(footer !== undefined ? { header: { hasMediaAttachment: false } } : {}),
            ...(bodyText !== undefined ? { body: { text: bodyText } } : {}),
            ...(footer !== undefined ? { footer: { text: footer } } : {}),
            nativeFlowMessage,
            bloksWidget: a2ui.build({ type, wrapped }),
            ...ctx
        };
    const messageContent = proto.Message.fromObject({
        messageContextInfo: { messageSecret: randomBytes(32) },
        interactiveMessage
    });
    const resolvedUserJid = userJid || client.user?.id || client.authState?.creds?.me?.id;
    const msg = generateWAMessageFromContent(jid, messageContent, { quoted, userJid: resolvedUserJid });
    const now = String(Math.floor(Date.now() / 1000));
    await client.relayMessage(msg.key.remoteJid, msg.message, {
        messageId: msg.key.id,
        additionalNodes: [{
            tag: 'biz',
            attrs: { actual_actors: '2', host_storage: '2', privacy_mode_ts: now },
            content: [
                { tag: 'interactive', attrs: { type: 'native_flow', v: '1' }, content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }] },
                { tag: 'quality_control', attrs: { decision_id: randomUUID().replace(/-/g, ''), source_type: 'third_party' }, content: [{ tag: 'decision_source', attrs: { value: 'df' } }] }
            ]
        }]
    }, msg);
    return msg;
}

export default { A2UI, sendA2UIWidget };
