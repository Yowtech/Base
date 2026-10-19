export interface GroupEphemeralOptionsInput {
    enabled: boolean;
    isGroup: boolean;
    isDisappearingMessagesControl?: boolean;
    options?: Record<string, any>;
    ephemeralDuration?: unknown;
}
export declare const isPositiveFiniteEphemeralDuration: (value: unknown) => value is number;
export declare const resolveGroupEphemeralOptions: (input: GroupEphemeralOptionsInput) => Record<string, any>;
export interface GroupEphemeralMetadataCache {
    get: (key: string, loader: () => unknown | Promise<unknown>) => Promise<any>;
    clear: (key?: string) => void;
}
export declare const createGroupEphemeralMetadataCache: (input?: {
    ttlMs?: number;
    maxEntries?: number;
    now?: () => number;
}) => GroupEphemeralMetadataCache;
