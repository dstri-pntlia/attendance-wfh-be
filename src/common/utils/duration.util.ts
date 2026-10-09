const UNIT_SECONDS = { s: 1, m: 60, h: 3600, d: 86_400 } as const;

export function ttlToSeconds(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) {
    throw new Error(
      `Invalid duration "${ttl}"; expected e.g. 900s, 15m, 8h or 1d`,
    );
  }
  return Number(match[1]) * UNIT_SECONDS[match[2] as keyof typeof UNIT_SECONDS];
}
