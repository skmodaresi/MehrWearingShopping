/** Resolves the response locale from `x-locale` or `accept-language`. */
export function resolveLocale(request: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const explicit = header(request, 'x-locale');
  if (explicit === 'fa-IR' || explicit === 'en') return explicit;

  const accepted = header(request, 'accept-language') ?? '';
  if (accepted.toLowerCase().startsWith('en')) return 'en';
  return 'fa-IR';
}

function header(
  request: { headers: Record<string, string | string[] | undefined> },
  name: string,
): string | undefined {
  const value = request.headers[name];
  if (Array.isArray(value)) return value[0];
  return value;
}
