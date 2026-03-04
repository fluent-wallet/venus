export function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const maybe = error as { code?: unknown };
  return typeof maybe.code === 'string' ? maybe.code : undefined;
}
