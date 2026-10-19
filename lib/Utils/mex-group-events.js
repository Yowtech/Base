const GROUP_LIMIT_SHARING_OPERATION = 'NotificationGroupLimitSharingPropertyUpdate';
const COMMUNITY_OWNER_OPERATION = 'NotificationCommunityOwnerUpdate';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = value => typeof value === 'string' && value.trim().length > 0;
const isOptionalScalar = value => typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));

const getIdentity = value => {
    if (isNonEmptyString(value)) return value;
    if (!isRecord(value)) return undefined;
    for (const candidate of [value.pn, value.jid, value.id]) {
        if (isNonEmptyString(candidate)) return candidate;
    }
    return undefined;
};

const getGroupId = (payload, fallbackGroupJid) => {
    const candidates = [fallbackGroupJid, payload.group_jid, payload.group_id, payload.jid, payload.id];
    return candidates.find(isNonEmptyString);
};

/**
 * Parse a supported group MEX notification without side effects. `fallbackGroupJid`
 * is normally the notification node's `from` attribute; some server payloads do
 * not repeat the group JID inside their JSON body.
 */
export function parseMexGroupEvent(operation, data, fallbackGroupJid) {
    if (operation === GROUP_LIMIT_SHARING_OPERATION) {
        return parseGroupLimitSharingUpdate(data, fallbackGroupJid);
    }
    if (operation === COMMUNITY_OWNER_OPERATION) {
        return parseCommunityOwnerUpdate(data, fallbackGroupJid);
    }
    return null;
}

export function parseGroupLimitSharingUpdate(data, fallbackGroupJid) {
    const payload = isRecord(data) ? data.xwa2_notify_group_on_prop_change : undefined;
    if (!isRecord(payload)) return null;

    const id = getGroupId(payload, fallbackGroupJid);
    const author = getIdentity(payload.updated_by);
    const limitSharing = isRecord(payload.properties) ? payload.properties.limit_sharing : undefined;
    if (!isNonEmptyString(id) || !author || !isRecord(limitSharing) || typeof limitSharing.limit_sharing_enabled !== 'boolean') {
        return null;
    }

    const update = { id, author, action: limitSharing.limit_sharing_enabled ? 'on' : 'off' };
    if (limitSharing.limit_sharing_trigger !== undefined && limitSharing.limit_sharing_trigger !== null) {
        if (!isOptionalScalar(limitSharing.limit_sharing_trigger)) return null;
        update.trigger = limitSharing.limit_sharing_trigger;
    }
    if (payload.update_time !== undefined && payload.update_time !== null) {
        if (!isOptionalScalar(payload.update_time)) return null;
        update.update_time = payload.update_time;
    }
    return { event: 'limit-sharing.update', update };
}

export function parseCommunityOwnerUpdate(data, fallbackGroupJid) {
    const payload = isRecord(data) ? data.xwa2_notify_group_on_participants_roles_change : undefined;
    if (!isRecord(payload)) return null;

    const id = getGroupId(payload, fallbackGroupJid);
    const author = getIdentity(payload.updated_by);
    const roleUpdate = Array.isArray(payload.role_updates) ? payload.role_updates[0] : undefined;
    const user = isRecord(roleUpdate) ? getIdentity(roleUpdate.user) : undefined;
    if (!isNonEmptyString(id) || !author || !user || !isNonEmptyString(roleUpdate.new_role)) return null;

    const update = { id, author, user, new_role: roleUpdate.new_role };
    if (payload.update_time !== undefined && payload.update_time !== null) {
        if (!isOptionalScalar(payload.update_time)) return null;
        update.update_time = payload.update_time;
    }
    return { event: 'community-owner.update', update };
}
