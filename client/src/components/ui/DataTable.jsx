import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import EmptyState from './EmptyState';
import Skeleton from './Skeleton';
import Checkbox from './Checkbox';

const SKELETON_ROWS = 5;

const DataTable = ({
  columns,
  data,
  loading,
  emptyMessage = 'Aucun résultat',
  emptyDescription,
  emptyAction,
  onRowClick,
  sortable = false,
  sortKey: controlledSortKey,
  sortDir: controlledSortDir,
  onSortChange,
  pagination,
  pageSize: pageSizeProp = 10,
  selectable = false,
  selectedKeys = [],
  onSelectionChange,
  rowKey = (row, i) => row.id ?? i,
  mobileCards = true,
}) => {
  const [localSortKey, setLocalSortKey] = useState(null);
  const [localSortDir, setLocalSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  const sortKey = controlledSortKey ?? localSortKey;
  const sortDir = controlledSortDir ?? localSortDir;
  const pageSize = pagination?.pageSize ?? pageSizeProp;

  const handleSort = (key) => {
    if (!sortable && !columns.find((c) => c.key === key)?.sortable) return;
    const nextDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc';
    if (onSortChange) {
      onSortChange(key, nextDir);
    } else {
      setLocalSortKey(key);
      setLocalSortDir(nextDir);
    }
    setPage(1);
  };

  const sorted = useMemo(() => {
    if (!data?.length || !sortKey) return data || [];
    const col = columns.find((c) => c.key === sortKey);
    if (col?.sortFn) return [...data].sort((a, b) => col.sortFn(a, b, sortDir));
    return [...data].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const cmp = String(av).localeCompare(String(bv), 'fr', { sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, columns]);

  const totalPages = pagination
    ? Math.max(1, Math.ceil((pagination.total ?? sorted.length) / pageSize))
    : Math.max(1, Math.ceil(sorted.length / pageSize));

  const pageData = useMemo(() => {
    if (pagination?.serverSide) return sorted;
    if (!pagination && sorted.length <= pageSize) return sorted;
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize, pagination]);

  const allKeys = pageData.map((row, i) => rowKey(row, i));
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selectedKeys.includes(k));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(selectedKeys.filter((k) => !allKeys.includes(k)));
    } else {
      onSelectionChange([...new Set([...selectedKeys, ...allKeys])]);
    }
  };

  const toggleRow = (key) => {
    if (!onSelectionChange) return;
    if (selectedKeys.includes(key)) {
      onSelectionChange(selectedKeys.filter((k) => k !== key));
    } else {
      onSelectionChange([...selectedKeys, key]);
    }
  };

  const SortIcon = ({ colKey }) => {
    if (sortKey !== colKey) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const headerCell = 'text-left py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wider';
  const dataCell = 'py-3.5 px-4 text-sm';

  return (
    <div
      className="overflow-hidden rounded-lg"
      style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* Desktop table */}
      <div className={`${mobileCards ? 'hidden md:block' : ''} overflow-x-auto`}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {selectable && (
                <th className="w-10 px-3 py-2.5">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </th>
              )}
              {columns.map((col) => {
                const canSort = sortable || col.sortable;
                return (
                  <th
                    key={col.key}
                    className={headerCell}
                    style={{ color: 'var(--text-muted)', width: col.width }}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col.key)}
                        className="inline-flex items-center gap-1.5 hover:text-[var(--text-primary)] transition-colors"
                      >
                        {col.label}
                        <SortIcon colKey={col.key} />
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <tr key={`sk-${i}`} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {selectable && <td className="px-3"><Skeleton height={16} width={16} /></td>}
                  {columns.map((col, ci) => (
                    <td key={col.key} className={dataCell}>
                      <Skeleton height={14} width={ci === 0 ? '60%' : '75%'} />
                    </td>
                  ))}
                </tr>
              ))
            ) : pageData?.length > 0 ? (
              pageData.map((row, rowIndex) => {
                const key = rowKey(row, rowIndex);
                const selected = selectedKeys.includes(key);
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick?.(row)}
                    className="transition-colors group"
                    style={{
                      borderBottom: rowIndex === pageData.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                      background: selected ? 'var(--surface-brand-soft)' : undefined,
                      cursor: onRowClick ? 'pointer' : 'default',
                    }}
                    onMouseEnter={(e) => {
                      if (!selected) e.currentTarget.style.background = 'var(--surface-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = selected ? 'var(--surface-brand-soft)' : 'transparent';
                    }}
                  >
                    {selectable && (
                      <td className="px-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selected} onCheckedChange={() => toggleRow(key)} />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className={dataCell} style={{ color: 'var(--text-primary)' }}>
                        {col.render ? col.render(row[col.key], row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)}>
                  <EmptyState title={emptyMessage} description={emptyDescription} action={emptyAction} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      {mobileCards && (
        <div className="md:hidden divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 space-y-2">
                <Skeleton height={16} width="50%" />
                <Skeleton height={12} width="80%" />
                <Skeleton height={12} width="40%" />
              </div>
            ))
          ) : pageData?.length > 0 ? (
            pageData.map((row, i) => {
              const key = rowKey(row, i);
              return (
                <div
                  key={key}
                  className="p-4 space-y-2"
                  onClick={() => onRowClick?.(row)}
                  style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                >
                  {columns.slice(0, 4).map((col) => (
                    <div key={col.key} className="flex justify-between gap-3 text-sm">
                      <span style={{ color: 'var(--text-muted)' }}>{col.label}</span>
                      <span className="text-right font-medium" style={{ color: 'var(--text-primary)' }}>
                        {col.render ? col.render(row[col.key], row) : row[col.key]}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })
          ) : (
            <EmptyState title={emptyMessage} description={emptyDescription} action={emptyAction} />
          )}
        </div>
      )}

      {/* Pagination */}
      {(pagination || sorted.length > pageSize) && !loading && sorted.length > 0 && (
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Page {pagination?.page ?? page} / {totalPages}
            {pagination?.total != null && ` · ${pagination.total} éléments`}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={(pagination?.page ?? page) <= 1}
              onClick={() => {
                if (pagination?.onPageChange) pagination.onPageChange((pagination.page ?? page) - 1);
                else setPage((p) => Math.max(1, p - 1));
              }}
              className="p-1.5 rounded-md disabled:opacity-40 hover:bg-[var(--surface-hover)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={(pagination?.page ?? page) >= totalPages}
              onClick={() => {
                if (pagination?.onPageChange) pagination.onPageChange((pagination.page ?? page) + 1);
                else setPage((p) => Math.min(totalPages, p + 1));
              }}
              className="p-1.5 rounded-md disabled:opacity-40 hover:bg-[var(--surface-hover)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
