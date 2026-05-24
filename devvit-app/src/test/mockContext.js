export function createMockRedis() {
    const hashes = new Map();
    const strings = new Map();
    return {
        hSet: async (key, fields) => {
            const existing = hashes.get(key) ?? {};
            hashes.set(key, { ...existing, ...fields });
        },
        hGetAll: async (key) => hashes.get(key) ?? {},
        hDel: async (key, fields) => {
            const existing = hashes.get(key);
            if (!existing)
                return;
            for (const field of fields)
                delete existing[field];
            if (Object.keys(existing).length === 0)
                hashes.delete(key);
            else
                hashes.set(key, existing);
        },
        expire: async () => { },
        del: async (key) => {
            hashes.delete(key);
            strings.delete(key);
        },
        get: async (key) => strings.get(key) ?? null,
        set: async (key, value) => {
            strings.set(key, value);
        },
        incrBy: async (key, amount) => {
            const current = Number(strings.get(key) ?? "0");
            const next = current + amount;
            strings.set(key, String(next));
            return next;
        },
        hIncrBy: async (key, field, amount) => {
            const existing = hashes.get(key) ?? {};
            const current = Number(existing[field] ?? "0");
            const next = current + amount;
            existing[field] = String(next);
            hashes.set(key, existing);
            return next;
        },
        hGet: async (key, field) => {
            const existing = hashes.get(key);
            return existing?.[field] ?? null;
        },
        _hashes: hashes,
        _strings: strings,
    };
}
export function createMockContext(overrides = {}) {
    const redis = createMockRedis();
    return {
        redis,
        settings: {
            get: async () => undefined,
        },
        reddit: {},
        ...overrides,
    };
}
