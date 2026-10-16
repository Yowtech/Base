import { proto } from '../../WAProto/index.js';
import { QueryIds, XWAPaths } from '../Types/index.js';
import { generateProfilePicture } from '../Utils/messages-media.js';
import { getBinaryNodeChild, getBinaryNodeChildren, S_WHATSAPP_NET } from '../WABinary/index.js';
import { makeGroupsSocket } from './groups.js';
import { executeWMexQuery as genericExecuteWMexQuery } from './mex.js';
const parseNewsletterCreateResponse = (response) => {
    const { id, thread_metadata: thread, viewer_metadata: viewer } = response;
    return {
        id: id,
        owner: undefined,
        name: thread.name.text,
        creation_time: parseInt(thread.creation_time, 10),
        description: thread.description.text,
        invite: thread.invite,
        subscribers: parseInt(thread.subscribers_count, 10),
        verification: thread.verification,
        picture: {
            id: thread.picture?.id,
            directPath: thread.picture?.direct_path
        },
        mute_state: viewer.mute
    };
};
const parseNewsletterMetadata = (result) => {
    if (typeof result !== 'object' || result === null) {
        return null;
    }
    if ('id' in result && typeof result.id === 'string') {
        return result;
    }
    if ('result' in result && typeof result.result === 'object' && result.result !== null && 'id' in result.result) {
        return result.result;
    }
    return null;
};
export const makeNewsletterSocket = (config) => {
    const sock = makeGroupsSocket(config);
    const { query, generateMessageTag } = sock;
    const assertNewsletterStatusTarget = (jid) => {
        if (typeof jid !== 'string' || !jid.endsWith('@newsletter')) {
            throw new TypeError(`newsletter status target must be a @newsletter jid, got ${String(jid)}`);
        }
    };
    const normalizeNewsletterServerId = (value, name) => {
        const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
        if (!Number.isInteger(parsed) || parsed < 99 || parsed > 2147476647) {
            throw new RangeError(`${name} must be an integer in 99..2147476647`);
        }
        return String(parsed);
    };
    const buildNewsletterStatusMeta = ({ interactionType, parentServerId, responseServerId, aiContent }) => {
        const attrs = {};
        if (interactionType) {
            if (!['question', 'question_response', 'question_reshare'].includes(interactionType)) {
                throw new TypeError(`Unsupported newsletter status interaction: ${interactionType}`);
            }
            if (interactionType !== 'question') attrs.interaction_type = interactionType;
            if (interactionType === 'question_reshare') {
                if (parentServerId === undefined || responseServerId === undefined) {
                    throw new TypeError('question_reshare requires parentServerId and responseServerId');
                }
                attrs.parent_server_id = normalizeNewsletterServerId(parentServerId, 'parentServerId');
                attrs.response_server_id = String(responseServerId);
            } else if (interactionType === 'question_response') {
                if (parentServerId === undefined) throw new TypeError('question_response requires parentServerId');
                if (responseServerId !== undefined) attrs.response_server_id = String(responseServerId);
            }
        }
        if (!interactionType && !aiContent) return undefined;
        return { tag: 'meta', attrs, ...(aiContent ? { content: [{ tag: 'ai_content', attrs: {}, content: undefined }] } : {}) };
    };
    const withNewsletterStatusAttribution = (message) => {
        const attribution = {
            statusAttributions: [{ type: proto.StatusAttribution.Type.NEWSLETTER_STATUS }],
            featureEligibilities: { canBeReshared: true }
        };
        if (message?.extendedTextMessage) {
            return { ...message, extendedTextMessage: { ...message.extendedTextMessage, contextInfo: { ...(message.extendedTextMessage.contextInfo || {}), ...attribution } } };
        }
        if (message?.conversation !== undefined) {
            const { conversation, ...rest } = message;
            return { ...rest, extendedTextMessage: { text: conversation, contextInfo: attribution } };
        }
        const mediaKey = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].find(key => message?.[key]);
        if (mediaKey) {
            return { ...message, [mediaKey]: { ...message[mediaKey], contextInfo: { ...(message[mediaKey].contextInfo || {}), ...attribution } } };
        }
        throw new TypeError('newsletter status content must be conversation/extendedTextMessage or a media message');
    };
    const readStatusCount = (attrs, name) => {
        const value = attrs?.[name];
        if (value === undefined || value === '') return undefined;
        const parsed = Number.parseInt(String(value), 10);
        return Number.isFinite(parsed) ? parsed : undefined;
    };
    const parseNewsletterStatusNode = (node) => {
        const plaintext = getBinaryNodeChild(node, 'plaintext');
        const meta = getBinaryNodeChild(node, 'meta');
        const reaction = getBinaryNodeChild(node, 'reaction');
        const reactions = getBinaryNodeChild(node, 'reactions');
        const reactionCounts = reactions ? getBinaryNodeChildren(reactions, 'reaction').map(item => ({
            ...(item.attrs?.code ? { code: item.attrs.code } : {}),
            ...(readStatusCount(item.attrs, 'count') !== undefined ? { count: readStatusCount(item.attrs, 'count') } : {})
        })) : undefined;
        let message;
        try { if (plaintext?.content && !Array.isArray(plaintext.content)) message = proto.Message.decode(plaintext.content); } catch {}
        return {
            ...(node.attrs?.id ? { id: node.attrs.id } : {}),
            ...(readStatusCount(node.attrs, 'server_id') !== undefined ? { serverId: readStatusCount(node.attrs, 'server_id') } : {}),
            ...(readStatusCount(node.attrs, 't') !== undefined ? { t: readStatusCount(node.attrs, 't') } : {}),
            isSender: node.attrs?.is_sender === 'true',
            ...(node.attrs?.type ? { type: node.attrs.type } : {}),
            ...(node.attrs?.edit ? { edit: node.attrs.edit } : {}),
            ...(plaintext?.attrs?.mediatype ? { mediaType: plaintext.attrs.mediatype } : {}),
            ...(meta?.attrs?.interaction_type ? { interactionType: meta.attrs.interaction_type } : {}),
            ...(reaction ? { reaction: reaction.attrs?.code ?? '' } : {}),
            paidPartnership: !!getBinaryNodeChild(meta, 'paid_partnership'),
            aiContent: !!getBinaryNodeChild(meta, 'ai_content'),
            ...(readStatusCount(meta?.attrs, 'msg_edit_t') !== undefined ? { editTimestamp: readStatusCount(meta.attrs, 'msg_edit_t') } : {}),
            ...(readStatusCount(meta?.attrs, 'original_msg_t') !== undefined ? { originalTimestamp: readStatusCount(meta.attrs, 'original_msg_t') } : {}),
            ...(reactionCounts ? { reactionCounts } : {}),
            ...(readStatusCount(getBinaryNodeChild(node, 'views_count')?.attrs, 'count') !== undefined ? { viewsCount: readStatusCount(getBinaryNodeChild(node, 'views_count').attrs, 'count') } : {}),
            ...(readStatusCount(getBinaryNodeChild(node, 'responses_count')?.attrs, 'count') !== undefined ? { responsesCount: readStatusCount(getBinaryNodeChild(node, 'responses_count').attrs, 'count') } : {}),
            ...(message ? { message } : {}),
            node
        };
    };
    const fetchNewsletterStatuses = async ({ jid, count = 20, since, before, after } = {}) => {
        assertNewsletterStatusTarget(jid);
        const attrs = { count: String(count) };
        if (since !== undefined) attrs.since = String(since);
        if (before !== undefined) attrs.before = normalizeNewsletterServerId(before, 'before');
        else if (after !== undefined) attrs.after = normalizeNewsletterServerId(after, 'after');
        const response = await query({ tag: 'iq', attrs: { to: jid, type: 'get', xmlns: 'newsletter' }, content: [{ tag: 'status_updates', attrs }] });
        const updates = getBinaryNodeChild(response, 'status_updates');
        const statusesContainer = updates && getBinaryNodeChild(updates, 'statuses');
        if (!statusesContainer) throw new Error('newsletter status response has no <status_updates><statuses> container');
        return {
            ...(statusesContainer.attrs?.jid ? { jid: statusesContainer.attrs.jid } : {}),
            ...(readStatusCount(statusesContainer.attrs, 't') !== undefined ? { t: readStatusCount(statusesContainer.attrs, 't') } : {}),
            statuses: getBinaryNodeChildren(statusesContainer, 'status').map(parseNewsletterStatusNode)
        };
    };
    const executeWMexQuery = (variables, queryId, dataPath) => {
        return genericExecuteWMexQuery(variables, queryId, dataPath, query, generateMessageTag);
    };
    const newsletterUpdate = async (jid, updates) => {
        const variables = {
            newsletter_id: jid,
            updates: {
                ...updates,
                settings: null
            }
        };
        return executeWMexQuery(variables, QueryIds.UPDATE_METADATA, 'xwa2_newsletter_update');
    };
    return {
        ...sock,
        executeWMexQuery,
        newsletterCreate: async (name, description) => {
            const variables = {
                input: {
                    name,
                    description: description ?? null
                }
            };
            const rawResponse = await executeWMexQuery(variables, QueryIds.CREATE, XWAPaths.xwa2_newsletter_create);
            return parseNewsletterCreateResponse(rawResponse);
        },
        newsletterUpdate,
        newsletterSubscribers: async (jid) => {
            return executeWMexQuery({ newsletter_id: jid }, QueryIds.SUBSCRIBERS, XWAPaths.xwa2_newsletter_subscribers);
        },
        // Lia@Changes 29-01-26 --- Add newsletterSubscribed to fetch all subscribed newsletters (similar to groupFetchAllParticipating (⁠ ⁠╹⁠▽⁠╹⁠ ⁠))
        newsletterSubscribed: async () => {
            return executeWMexQuery({}, QueryIds.SUBSCRIBED, XWAPaths.xwa2_newsletter_subscribed);
        },
        newsletterMetadata: async (type, key) => {
            const variables = {
                fetch_creation_time: true,
                fetch_full_image: true,
                fetch_viewer_metadata: true,
                input: {
                    key,
                    type: type.toUpperCase()
                }
            };
            const result = await executeWMexQuery(variables, QueryIds.METADATA, XWAPaths.xwa2_newsletter_metadata);
            return parseNewsletterMetadata(result);
        },
        newsletterFollow: (jid) => {
            return executeWMexQuery({ newsletter_id: jid }, QueryIds.FOLLOW, XWAPaths.xwa2_newsletter_join_v2);
        },
        newsletterUnfollow: (jid) => {
            return executeWMexQuery({ newsletter_id: jid }, QueryIds.UNFOLLOW, XWAPaths.xwa2_newsletter_leave_v2);
        },
        newsletterMute: (jid) => {
            return executeWMexQuery({ newsletter_id: jid }, QueryIds.MUTE, XWAPaths.xwa2_newsletter_mute_v2);
        },
        newsletterUnmute: (jid) => {
            return executeWMexQuery({ newsletter_id: jid }, QueryIds.UNMUTE, XWAPaths.xwa2_newsletter_unmute_v2);
        },
        newsletterUpdateName: async (jid, name) => {
            return await newsletterUpdate(jid, { name });
        },
        newsletterUpdateDescription: async (jid, description) => {
            return await newsletterUpdate(jid, { description });
        },
        newsletterUpdatePicture: async (jid, content) => {
            const { img } = await generateProfilePicture(content);
            return await newsletterUpdate(jid, { picture: img.toString('base64') });
        },
        newsletterRemovePicture: async (jid) => {
            return await newsletterUpdate(jid, { picture: '' });
        },
        newsletterSendStatus: async ({ jid, content, mediaType, mediaHandle, interactionType, parentServerId, responseServerId, aiContent, messageId, resolveServerId = false, serverIdTimeoutMs = 8000, statusAttribution = true } = {}) => {
            assertNewsletterStatusTarget(jid);
            if (!content || typeof content !== 'object') throw new TypeError('newsletter status content must be a protobuf Message object');
            if (mediaType && !['image', 'video', 'audio', 'gif'].includes(mediaType)) throw new TypeError(`Unsupported newsletter status media type: ${mediaType}`);
            const handle = mediaHandle === undefined || mediaHandle === '' ? undefined : String(mediaHandle);
            if (mediaType && !handle) throw new TypeError('newsletter status media requires mediaHandle returned by upload');
            if (handle && !mediaType) throw new TypeError('newsletter status mediaHandle requires mediaType');
            if (interactionType === 'question_reshare' && !mediaType) throw new TypeError('question_reshare requires media');
            if (interactionType === 'question_response' && mediaType) throw new TypeError('question_response is a text status');
            if (interactionType === 'question_response' && parentServerId === undefined) throw new TypeError('question_response requires parentServerId');
            const id = messageId || generateMessageTag();
            const attrs = { to: jid, id, type: mediaType ? 'media' : 'text' };
            if (mediaType && handle) attrs.media_id = handle;
            if (interactionType === 'question_response') attrs.server_id = normalizeNewsletterServerId(parentServerId, 'parentServerId');
            const meta = buildNewsletterStatusMeta({ interactionType, parentServerId, responseServerId, aiContent });
            const payload = proto.Message.encode(statusAttribution ? withNewsletterStatusAttribution(content) : content).finish();
            const nodes = [{ tag: 'plaintext', attrs: mediaType ? { mediatype: mediaType } : {}, content: payload }];
            if (meta) nodes.push(meta);
            const ackNode = await query({ tag: 'status', attrs, content: nodes });
            const ackAttrs = ackNode?.attrs || {};
            let serverId = readStatusCount(ackAttrs, 'server_id');
            if (resolveServerId && serverId === undefined) {
                const deadline = Date.now() + Math.max(0, Number(serverIdTimeoutMs) || 0);
                while (Date.now() < deadline && serverId === undefined) {
                    const page = await fetchNewsletterStatuses({ jid, count: 50 });
                    serverId = page.statuses.find(status => status.id === id)?.serverId;
                    if (serverId === undefined) await new Promise(resolve => setTimeout(resolve, Math.min(1000, deadline - Date.now())));
                }
            }
            return {
                id,
                ...(serverId !== undefined ? { serverId } : {}),
                ack: {
                    ...(ackAttrs.class ? { class: ackAttrs.class } : {}),
                    ...(ackAttrs.from ? { from: ackAttrs.from } : {}),
                    ...(ackAttrs.id ? { id: ackAttrs.id } : {}),
                    ...(readStatusCount(ackAttrs, 't') !== undefined ? { t: readStatusCount(ackAttrs, 't') } : {}),
                    ...(serverId !== undefined ? { serverId } : {}),
                    node: ackNode
                },
                payload
            };
        },
        newsletterReactStatus: async ({ jid, messageId, parentServerId, reaction } = {}) => {
            assertNewsletterStatusTarget(jid);
            if (!messageId) throw new TypeError('newsletter status reaction requires messageId');
            const serverId = normalizeNewsletterServerId(parentServerId, 'parentServerId');
            const clearing = reaction === undefined || reaction === '';
            return query({
                tag: 'status',
                attrs: { to: jid, id: messageId, server_id: serverId, type: 'reaction', ...(clearing ? { edit: '7' } : {}) },
                content: [{ tag: 'reaction', attrs: clearing ? {} : { code: String(reaction) }, content: undefined }]
            });
        },
        newsletterRevokeStatus: async ({ jid, statusId } = {}) => {
            assertNewsletterStatusTarget(jid);
            if (!statusId) throw new TypeError('newsletter status revoke requires statusId');
            return query({ tag: 'status', attrs: { to: jid, id: statusId, type: 'text', edit: '8' }, content: [{ tag: 'plaintext', attrs: {}, content: undefined }] });
        },
        newsletterFetchStatuses: fetchNewsletterStatuses,
        newsletterReactMessage: async (jid, serverId, reaction) => {
            await query({
                tag: 'message',
                attrs: {
                    to: jid,
                    ...(reaction ? {} : { edit: '7' }),
                    type: 'reaction',
                    server_id: serverId,
                    id: generateMessageTag()
                },
                content: [
                    {
                        tag: 'reaction',
                        attrs: reaction ? { code: reaction } : {}
                    }
                ]
            });
        },
        newsletterFetchMessages: async (type, key, count, after, before) => {
            // WA Web: GetNewsletterMessages endpoint
            // Request: iq(to=s.whatsapp.net) -> messages(count, type, jid|key, [after|before])
            const messagesAttrs = {
                count: count.toString(),
                type,
                [type === 'jid' ? 'jid' : 'key']: key
            };
            if (after) {
                messagesAttrs.after = after.toString();
            }
            if (before) {
                messagesAttrs.before = before.toString();
            }
            const result = await query({
                tag: 'iq',
                attrs: {
                    id: generateMessageTag(),
                    type: 'get',
                    xmlns: 'newsletter',
                    to: S_WHATSAPP_NET
                },
                content: [
                    {
                        tag: 'messages',
                        attrs: messagesAttrs
                    }
                ]
            });
            // Response: iq -> messages(jid="newsletter_jid") -> message[]
            const messagesNode = getBinaryNodeChild(result, 'messages');
            if (!messagesNode) {
                return [];
            }
            // The response messages node carries the newsletter JID
            const newsletterJid = messagesNode.attrs.jid || (type === 'jid' ? key : undefined);
            const messages = [];
            // WA Web: mapChildrenWithTag(messages, "message", 0, 300, ...)
            for (const child of getBinaryNodeChildren(messagesNode, 'message')) {
                const plaintextNode = getBinaryNodeChild(child, 'plaintext');
                if (!plaintextNode?.content) {
                    continue;
                }
                try {
                    const contentBuf = typeof plaintextNode.content === 'string'
                        ? Buffer.from(plaintextNode.content, 'binary')
                        : Buffer.from(plaintextNode.content);
                    const messageProto = proto.Message.decode(contentBuf).toJSON();
                    const fullMessage = proto.WebMessageInfo.fromObject({
                        key: {
                            remoteJid: newsletterJid,
                            id: child.attrs.id || child.attrs.server_id,
                            server_id: child.attrs.server_id,
                            fromMe: false
                        },
                        message: messageProto,
                        messageTimestamp: child.attrs.t ? +child.attrs.t : undefined
                    }).toJSON();
                    messages.push(fullMessage);
                }
                catch (error) {
                    logger.error({ error }, 'Failed to decode newsletter message');
                }
            }
            return messages;
        },
        subscribeNewsletterUpdates: async (jid) => {
            const result = await query({
                tag: 'iq',
                attrs: {
                    id: generateMessageTag(),
                    type: 'set',
                    xmlns: 'newsletter',
                    to: jid
                },
                content: [{ tag: 'live_updates', attrs: {}, content: [] }]
            });
            const liveUpdatesNode = getBinaryNodeChild(result, 'live_updates');
            const duration = liveUpdatesNode?.attrs?.duration;
            return duration ? { duration: duration } : null;
        },
        newsletterAdminCount: async (jid) => {
            const response = await executeWMexQuery({ newsletter_id: jid }, QueryIds.ADMIN_COUNT, XWAPaths.xwa2_newsletter_admin_count);
            return response.admin_count;
        },
        newsletterChangeOwner: async (jid, newOwnerJid) => {
            await executeWMexQuery({ newsletter_id: jid, user_id: newOwnerJid }, QueryIds.CHANGE_OWNER, XWAPaths.xwa2_newsletter_change_owner);
        },
        newsletterDemote: async (jid, userJid) => {
            await executeWMexQuery({ newsletter_id: jid, user_id: userJid }, QueryIds.DEMOTE, XWAPaths.xwa2_newsletter_demote);
        },
        newsletterDelete: async (jid) => {
            await executeWMexQuery({ newsletter_id: jid }, QueryIds.DELETE, XWAPaths.xwa2_newsletter_delete_v2);
        }
    };
};
//# sourceMappingURL=newsletter.js.map
