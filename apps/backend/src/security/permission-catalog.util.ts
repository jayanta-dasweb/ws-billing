import type { PermissionDef } from '@billing/shared';

export function groupPermissionsByModule(catalog: PermissionDef[]) {
  const groups: Record<string, Record<string, PermissionDef[]>> = {};
  for (const perm of catalog) {
    if (!groups[perm.group]) groups[perm.group] = {};
    if (!groups[perm.group][perm.resource]) groups[perm.group][perm.resource] = [];
    groups[perm.group][perm.resource].push(perm);
  }
  return groups;
}
