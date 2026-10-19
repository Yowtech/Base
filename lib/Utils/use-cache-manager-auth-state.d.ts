export interface CacheManagerAuthState {
    state: {
        creds: any;
        keys: {
            get(type: string, ids: string[]): Promise<Record<string, any>>;
            set(data: Record<string, Record<string, any>>): Promise<void>;
        };
    };
    saveCreds(): Promise<void>;
    clearState(): Promise<void>;
}
export function makeCacheManagerAuthState(cache: {
    get(key: string): Promise<unknown> | unknown;
    set(key: string, value: string): Promise<unknown> | unknown;
    del(key: string): Promise<unknown> | unknown;
    keys?: () => Promise<string[]> | string[];
    store?: { keys?: () => Promise<string[]> | string[] };
}, sessionKey: string): Promise<CacheManagerAuthState>;
