import fs from 'node:fs';

const path = new URL('../src/modules/billing/BillingScreen.tsx', import.meta.url);
let s = fs.readFileSync(path, 'utf8');
const fixes = [
  [/\u00e2\u20ac\u201d/g, '-'],
  [/\u00e2\u20ac\u201c/g, '-'],
  [/\u00e2\u20ac\u00a6/g, '...'],
  [/\u00e2\u88\u92/g, '-'],
  [/âˆ'/g, '-'],
  [/\u00c2\u00b7/g, '|'],
  [/\u00e2\u20b9\u00a0/g, '₹ '],
  [/\u00e2\u201a\u00b9/g, '₹'],
  [/\u00e2\u2020\u2018/g, '^'],
  [/\u00e2\u2020\u201c/g, 'v'],
  [/\u2014/g, '-'],
  [/\u2013/g, '-'],
  [/\u2212/g, '-'],
];
for (const [re, rep] of fixes) {
  s = s.replace(re, rep);
}
fs.writeFileSync(path, s, 'utf8');
console.log('Fixed', path.pathname);
