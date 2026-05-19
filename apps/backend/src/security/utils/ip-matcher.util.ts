export function normalizeClientIp(ip?: string): string {
  if (!ip) return '';
  const trimmed = ip.trim();
  if (trimmed.startsWith('::ffff:')) return trimmed.slice(7);
  return trimmed;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const octet = Number(p);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    n = (n << 8) + octet;
  }
  return n >>> 0;
}

export function ipMatchesRule(clientIp: string, rule: string): boolean {
  const ip = normalizeClientIp(clientIp);
  const cidr = rule.trim();

  if (!cidr.includes('/')) {
    return ip === normalizeClientIp(cidr);
  }

  const [base, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  const ipNum = ipv4ToInt(ip);
  const baseNum = ipv4ToInt(base);
  if (ipNum === null || baseNum === null || !Number.isInteger(bits) || bits < 0 || bits > 32) {
    return false;
  }
  if (bits === 0) return true;
  const mask = bits === 32 ? 0xffffffff : (~0 << (32 - bits)) >>> 0;
  return (ipNum & mask) === (baseNum & mask);
}
