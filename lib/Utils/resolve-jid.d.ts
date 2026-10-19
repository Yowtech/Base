export function resolveJid(conn: any, message: any, target?: string | null): Promise<string | null>;
export function resolveJids(conn: any, message: any, targets?: Array<string | null | undefined>): Promise<Array<string | null>>;
