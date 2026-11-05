/** Accepts only same-origin relative paths, preventing open redirects through `?next=`. */
export function safeNextPath(value: string | null | undefined, fallback = '/dashboard'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}
