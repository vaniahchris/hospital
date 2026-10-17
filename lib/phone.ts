/** Normalize common UG mobile forms to E.164 (+256…). Returns null if invalid. */
export function normalizeUgandanPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '').replace(/^\+/, '');
  let national = digits;
  if (national.startsWith('256')) national = national.slice(3);
  else if (national.startsWith('0')) national = national.slice(1);
  if (!/^7\d{8}$/.test(national)) return null;
  return `+256${national}`;
}
