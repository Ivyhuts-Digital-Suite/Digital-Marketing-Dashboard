const UNIT_SECONDS = { s: 1, m: 60, h: 3600, d: 86400 } as const;

export const DURATION_PATTERN = /^(\d+)([smhd])$/;

/** Parses durations such as "15m", "12h" or "30d" into whole seconds. */
export function parseDurationToSeconds(value: string): number {
  const match = DURATION_PATTERN.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration "${value}". Use a number followed by s, m, h or d.`);
  }
  const amount = Number(match[1]);
  const unit = match[2] as keyof typeof UNIT_SECONDS;
  return amount * UNIT_SECONDS[unit];
}
