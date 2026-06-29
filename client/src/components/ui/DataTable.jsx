import { Inbox } from 'lucide-react';

const SKELETON_ROWS = 5;

const DataTable = ({ columns, data, loading, emptyMessage = 'Aucun résultat', onRowClick, emptyAction }) => {
  const headerCell = 'text-left py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wider';
  const dataCell = 'py-3.5 px-4 text-sm';
  const borderBottom = { borderBottom: '1px solid var(--border-subtle)' };

  const EmptyState = (
    <tr>
      <td colSpan={columns.length} className="py-16 px-6 text-center">
        <div className="flex flex-col items-center justify-center">
          <Inbox className="h-12 w-12 mb-4" style={{ color: 'var(--text-muted)' }} strokeWidth={1.25} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {emptyMessage}
          </p>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--text-muted)' }}>
            Les données apparaîtront ici dès qu&apos;elles seront disponibles.
          </p>
          {emptyAction && <div className="mt-4">{emptyAction}</div>}
        </div>
      </td>
    </tr>
  );

  const SkeletonRow = ({ index }) => (
    <tr key={`sk-${index}`} style={borderBottom}>
      {columns.map((col, ci) => (
        <td key={col.key} className={dataCell}>
          <div
            className="skeleton"
            style={{
              height: 14,
              width: ci === 0 ? '60%' : '75%',
              borderRadius: 'var(--radius-sm)',
            }}
          />
        </td>
      ))}
    </tr>
  );

  return (
    <div
      className="overflow-x-auto rounded-lg"
      style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <table className="w-full">
        <thead>
          <tr style={borderBottom}>
            {columns.map((col) => (
              <th
                key={col.key}
                className={headerCell}
                style={{ color: 'var(--text-muted)' }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {loading ? (
            Array.from({ length: SKELETON_ROWS }).map((_, i) => (
              <SkeletonRow key={i} index={i} />
            ))
          ) : data?.length > 0 ? (
            data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                onClick={() => onRowClick?.(row)}
                className="transition-colors cursor-default group"
                style={{
                  borderBottom:
                    rowIndex === data.length - 1
                      ? 'none'
                      : '1px solid var(--border-subtle)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surface-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`${dataCell} ${onRowClick ? 'cursor-pointer' : ''}`}
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            EmptyState
          )}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
