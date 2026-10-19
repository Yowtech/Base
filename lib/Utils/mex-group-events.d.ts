import type { CommunityOwnerUpdate, LimitSharingUpdate } from '../Types/Events.js';
export type MexGroupEvent = {
    event: 'limit-sharing.update';
    update: LimitSharingUpdate;
} | {
    event: 'community-owner.update';
    update: CommunityOwnerUpdate;
};
export declare function parseMexGroupEvent(operation: string, data: unknown, fallbackGroupJid?: string): MexGroupEvent | null;
export declare function parseGroupLimitSharingUpdate(data: unknown, fallbackGroupJid?: string): MexGroupEvent | null;
export declare function parseCommunityOwnerUpdate(data: unknown, fallbackGroupJid?: string): MexGroupEvent | null;
