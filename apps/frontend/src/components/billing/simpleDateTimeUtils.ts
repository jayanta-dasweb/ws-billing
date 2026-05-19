export function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function formatDateTyping(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function parseIsoToParts(iso?: string): {
  date: string;
  hour12: string;
  minute: string;
  ampm: 'AM' | 'PM';
} {
  if (!iso?.trim()) {
    return { date: '', hour12: '', minute: '', ampm: 'AM' };
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { date: '', hour12: '', minute: '', ampm: 'AM' };
  }
  let h = d.getHours();
  const ampm: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return {
    date: `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`,
    hour12: String(h),
    minute: pad2(d.getMinutes()),
    ampm,
  };
}

export function partsToIso(date: string, hour12: string, minute: string, ampm: 'AM' | 'PM'): string {
  const dm = date.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!dm) return '';
  const day = parseInt(dm[1], 10);
  const month = parseInt(dm[2], 10);
  const year = parseInt(dm[3], 10);
  const h12 = parseInt(hour12, 10);
  const min = parseInt(minute, 10);
  if (!h12 || h12 < 1 || h12 > 12 || Number.isNaN(min) || min < 0 || min > 59) return '';
  let h24 = h12 % 12;
  if (ampm === 'PM') h24 += 12;
  const d = new Date(year, month - 1, day, h24, min, 0, 0);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return '';
  return d.toISOString();
}

export function todayDateStr(): string {
  const n = new Date();
  return `${pad2(n.getDate())}/${pad2(n.getMonth() + 1)}/${n.getFullYear()}`;
}

export function toDisplayDate(value?: string): string {
  if (!value?.trim()) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-');
    return `${d}/${m}/${y}`;
  }
  return parseIsoToParts(value).date;
}

export function displayToStoredDate(display: string): string {
  const dm = display.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!dm) return '';
  const day = dm[1].padStart(2, '0');
  const month = dm[2].padStart(2, '0');
  const year = dm[3];
  return `${year}-${month}-${day}`;
}
