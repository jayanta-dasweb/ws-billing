'use client';

/** Tally-style fixed shortcut column — always visible, no toggle. */
const SHORTCUTS: { key: string; label: string }[] = [
  { key: 'F1', label: 'Scan' },
  { key: 'F8', label: 'Find' },
  { key: 'F2', label: 'Customer' },
  { key: 'F4', label: 'Park' },
  { key: 'F5', label: 'Pay' },
  { key: 'F6', label: 'Qty' },
  { key: 'F7', label: 'Invoice' },
  { key: '↑↓', label: 'Line' },
  { key: '1-9', label: 'Pick' },
  { key: 'Tab', label: 'Disc' },
  { key: 'Enter', label: 'Next' },
  { key: 'Del', label: 'Remove' },
  { key: 'Esc', label: 'Back' },
];

export function BillingKeyboardHelp() {
  return (
    <aside className="billing-shortcut-rail" aria-label="Keyboard shortcuts">
      <div className="billing-shortcut-rail__title">Keys</div>
      <ul className="billing-shortcut-rail__list">
        {SHORTCUTS.map((s) => (
          <li key={s.key} className="billing-shortcut-rail__item">
            <kbd>{s.key}</kbd>
            <span>{s.label}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
