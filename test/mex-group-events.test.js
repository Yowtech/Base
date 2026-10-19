import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMexGroupEvent } from '../lib/Utils/mex-group-events.js'

test('parses a complete group limit-sharing notification', () => {
    assert.deepEqual(parseMexGroupEvent('NotificationGroupLimitSharingPropertyUpdate', {
        xwa2_notify_group_on_prop_change: {
            group_id: '123@g.us',
            updated_by: 'admin@s.whatsapp.net',
            properties: {
                limit_sharing: {
                    limit_sharing_enabled: true,
                    limit_sharing_trigger: 'admin'
                }
            },
            update_time: '1710000000'
        }
    }), {
        event: 'limit-sharing.update',
        update: {
            id: '123@g.us',
            author: 'admin@s.whatsapp.net',
            action: 'on',
            trigger: 'admin',
            update_time: '1710000000'
        }
    })
})

test('parses a complete community-owner role notification', () => {
    assert.deepEqual(parseMexGroupEvent('NotificationCommunityOwnerUpdate', {
        xwa2_notify_group_on_participants_roles_change: {
            group_jid: '123@g.us',
            updated_by: 'old-owner@s.whatsapp.net',
            role_updates: [{ user: 'new-owner@s.whatsapp.net', new_role: 'COMMUNITY_OWNER' }],
            update_time: 1710000001
        }
    }), {
        event: 'community-owner.update',
        update: {
            id: '123@g.us',
            author: 'old-owner@s.whatsapp.net',
            user: 'new-owner@s.whatsapp.net',
            new_role: 'COMMUNITY_OWNER',
            update_time: 1710000001
        }
    })
})

test('omits optional fields when they are absent', () => {
    assert.deepEqual(parseMexGroupEvent('NotificationGroupLimitSharingPropertyUpdate', {
        xwa2_notify_group_on_prop_change: {
            id: '123@g.us',
            updated_by: 'admin@s.whatsapp.net',
            properties: { limit_sharing: { limit_sharing_enabled: false, limit_sharing_trigger: null } },
            update_time: null
        }
    }), {
        event: 'limit-sharing.update',
        update: { id: '123@g.us', author: 'admin@s.whatsapp.net', action: 'off' }
    })
})

test('rejects missing and partial nested payloads without throwing', () => {
    const cases = [
        undefined,
        null,
        {},
        { xwa2_notify_group_on_prop_change: {} },
        { xwa2_notify_group_on_prop_change: { id: '123@g.us', updated_by: 'admin@s.whatsapp.net' } },
        { xwa2_notify_group_on_participants_roles_change: { id: '123@g.us', updated_by: 'admin@s.whatsapp.net', role_updates: [] } },
        { xwa2_notify_group_on_participants_roles_change: { id: '123@g.us', updated_by: 'admin@s.whatsapp.net', role_updates: [{}] } }
    ]
    for (const data of cases) {
        assert.doesNotThrow(() => parseMexGroupEvent('NotificationGroupLimitSharingPropertyUpdate', data))
        assert.equal(parseMexGroupEvent('NotificationGroupLimitSharingPropertyUpdate', data), null)
    }
    assert.equal(parseMexGroupEvent('NotificationCommunityOwnerUpdate', cases[0]), null)
})

test('rejects malformed optional fields instead of emitting a partial event', () => {
    assert.equal(parseMexGroupEvent('NotificationGroupLimitSharingPropertyUpdate', {
        xwa2_notify_group_on_prop_change: {
            group_id: '123@g.us',
            updated_by: 'admin@s.whatsapp.net',
            properties: { limit_sharing: { limit_sharing_enabled: true, limit_sharing_trigger: {} } }
        }
    }), null)
    assert.equal(parseMexGroupEvent('NotificationCommunityOwnerUpdate', {
        xwa2_notify_group_on_participants_roles_change: {
            group_id: '123@g.us',
            updated_by: 'admin@s.whatsapp.net',
            role_updates: [{ user: 'new-owner@s.whatsapp.net', new_role: 'COMMUNITY_OWNER' }],
            update_time: {}
        }
    }), null)
})

test('matches operation names exactly', () => {
    const data = {
        xwa2_notify_group_on_prop_change: {
            group_id: '123@g.us',
            updated_by: 'admin@s.whatsapp.net',
            properties: { limit_sharing: { limit_sharing_enabled: true } }
        }
    }
    assert.equal(parseMexGroupEvent('NotificationGroupLimitSharingPropertyUpdateExtra', data), null)
    assert.equal(parseMexGroupEvent('notificationgrouplimitsharingpropertyupdate', data), null)
})

test('parses server payload identities and group id from notification node', () => {
    assert.deepEqual(parseMexGroupEvent('NotificationGroupLimitSharingPropertyUpdate', {
        xwa2_notify_group_on_prop_change: {
            updated_by: { pn: 'admin@s.whatsapp.net' },
            properties: { limit_sharing: { limit_sharing_enabled: true, limit_sharing_trigger: 'owner' } },
            update_time: '1710000002'
        }
    }, '123@g.us'), {
        event: 'limit-sharing.update',
        update: {
            id: '123@g.us',
            author: 'admin@s.whatsapp.net',
            action: 'on',
            trigger: 'owner',
            update_time: '1710000002'
        }
    })

    assert.deepEqual(parseMexGroupEvent('NotificationCommunityOwnerUpdate', {
        xwa2_notify_group_on_participants_roles_change: {
            updated_by: { id: 'old-owner@s.whatsapp.net' },
            role_updates: [{ user: { pn: 'new-owner@s.whatsapp.net' }, new_role: 'COMMUNITY_OWNER' }]
        }
    }, '123@g.us'), {
        event: 'community-owner.update',
        update: {
            id: '123@g.us',
            author: 'old-owner@s.whatsapp.net',
            user: 'new-owner@s.whatsapp.net',
            new_role: 'COMMUNITY_OWNER'
        }
    })
})
