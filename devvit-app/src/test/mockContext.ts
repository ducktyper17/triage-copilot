import type { Devvit } from "@devvit/public-api";

type HashStore = Map<string, Record<string, string>>;
type StringStore = Map<string, string>;

export function createMockRedis() {
  const hashes: HashStore = new Map();
  const strings: StringStore = new Map();

  return {
    hSet: async (key: string, fields: Record<string, string>) => {
      const existing = hashes.get(key) ?? {};
      hashes.set(key, { ...existing, ...fields });
    },
    hGetAll: async (key: string) => hashes.get(key) ?? {},
    hDel: async (key: string, fields: string[]) => {
      const existing = hashes.get(key);
      if (!existing) return;
      for (const field of fields) delete existing[field];
      if (Object.keys(existing).length === 0) hashes.delete(key);
      else hashes.set(key, existing);
    },
    expire: async () => {},
    del: async (key: string) => {
      hashes.delete(key);
      strings.delete(key);
    },
    get: async (key: string) => strings.get(key) ?? null,
    set: async (key: string, value: string) => {
      strings.set(key, value);
    },
    incrBy: async (key: string, amount: number) => {
      const current = Number(strings.get(key) ?? "0");
      const next = current + amount;
      strings.set(key, String(next));
      return next;
    },
    hIncrBy: async (key: string, field: string, amount: number) => {
      const existing = hashes.get(key) ?? {};
      const current = Number(existing[field] ?? "0");
      const next = current + amount;
      existing[field] = String(next);
      hashes.set(key, existing);
      return next;
    },
    hGet: async (key: string, field: string) => {
      const existing = hashes.get(key);
      return existing?.[field] ?? null;
    },
    _hashes: hashes,
    _strings: strings,
  };
}

export function createMockContext(
  overrides: Partial<Devvit.Context> = {}
): Devvit.Context {
  const redis = createMockRedis();
  return {
    redis,
    settings: {
      get: async () => undefined,
    },
    reddit: {},
    ...overrides,
  } as unknown as Devvit.Context;
}
