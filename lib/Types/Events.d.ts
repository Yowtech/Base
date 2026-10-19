export interface LimitSharingUpdate {
    id: string;
    author: string;
    action: 'on' | 'off';
    trigger?: string | number;
    update_time?: string | number;
}
export interface CommunityOwnerUpdate {
    id: string;
    author: string;
    user: string;
    new_role: string;
    update_time?: string | number;
}
export interface BaileysEventMap {
    'limit-sharing.update': LimitSharingUpdate;
    'community-owner.update': CommunityOwnerUpdate;
}
//# sourceMappingURL=Events.d.ts.map
