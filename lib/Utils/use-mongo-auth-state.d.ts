export interface MongoAuthState {
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
export function useMongoAuthState(collection: {
    findOne(filter: { sessionId: string; key: string }): Promise<{ value?: string } | null> | { value?: string } | null;
    updateOne(filter: { sessionId: string; key: string }, update: { $set: { value: string } }, options: { upsert: true }): Promise<unknown> | unknown;
    deleteOne(filter: { sessionId: string; key: string }): Promise<unknown> | unknown;
    deleteMany(filter: { sessionId: string }): Promise<unknown> | unknown;
}, sessionKey?: string): Promise<MongoAuthState>;
