'use client';

import { useEffect, useState } from 'react';

export function useMasterList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  return { page, setPage, search, setSearch, debouncedSearch };
}

export function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="badge badge-success">Active</span>
  ) : (
    <span className="badge badge-secondary">Inactive</span>
  );
}
