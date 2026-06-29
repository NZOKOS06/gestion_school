import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { Badge, Button, DataTable, Modal, PageHeader } from '../../components/ui';
import { Download, Eye, Filter, RotateCcw } from 'lucide-react';

const STATUS_LABELS = {
  en_cours: 'En cours',
  finalisee: 'Finalisée',
  annulee: 'Annulée',
};

const STATUS_VARIANTS = {
  en_cours: 'warning',
  finalisee: 'success',
  annulee: 'danger',
};

const MODE_LABELS = {
  especes: 'Espèces',
  mobile_money: 'Mobile Money',
  carte: 'Carte',
  credit: 'Crédit',
};

const PAGE_SIZE = 20;

function exportCSV(ventes, formatPrice) {
  const rows = [
    ['N° vente', 'Date', 'Client', 'Articles', 'Montant', 'Mode paiement', 'Statut'],
    ...ventes.map((v) => [
      v.numeroVente || '',
      v.createdAt ? new Date(v.createdAt).toLocaleString('fr-FR') : '',
      v.nomClient || 'Comptoir',
      v.lignesVente?.length ?? 0,
      v.montantTotal ?? 0,
      MODE_LABELS[v.modePaiement] || v.modePaiement || '',
      STATUS_LABELS[v.statut] || v.statut || '',
    ]),
  ];
  const csv =
    '\uFEFF' +
    rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mes-ventes-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const PaginationBar = ({ page, totalPages, onPage }) => {
  if (totalPages <= 1) return null;
  const delta = 2;
  const pages = [];
  for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) {
    pages.push(i);
  }
  const btnBase = {
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-secondary)',
    background: 'var(--surface-overlay)',
  };
  return (
    <div className="flex items-center justify-center gap-1 pt-4 flex-wrap">
      <button
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="h-8 px-3 text-xs rounded-md font-medium disabled:opacity-40"
        style={btnBase}
      >
        Précédent
      </button>
      {pages[0] > 1 && (
        <>
          <button onClick={() => onPage(1)} className="h-8 w-8 rounded-md text-xs font-medium" style={btnBase}>1</button>
          {pages[0] > 2 && <span className="px-1 text-xs" style={{ color: 'var(--text-muted)' }}>…</span>}
        </>
      )}
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPage(p)}
          className="h-8 w-8 rounded-md text-xs font-medium"
          style={{
            background: p === page ? 'var(--color-primary)' : 'var(--surface-overlay)',
            border: `1px solid ${p === page ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
            color: p === page ? '#fff' : 'var(--text-secondary)',
          }}
        >
          {p}
        </button>
      ))}
      {pages[pages.length - 1] < totalPages && (
        <>
          {pages[pages.length - 1] < totalPages - 1 && (
            <span className="px-1 text-xs" style={{ color: 'var(--text-muted)' }}>…</span>
          )}
          <button onClick={() => onPage(totalPages)} className="h-8 w-8 rounded-md text-xs font-medium" style={btnBase}>
            {totalPages}
          </button>
        </>
      )}
      <button
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        className="h-8 px-3 text-xs rounded-md font-medium disabled:opacity-40"
        style={btnBase}
      >
        Suivant
      </button>
    </div>
  );
};

const MesVentes = () => {
  const { get, loading } = useAxios();
  const { formatPrice } = useTenant();

  const [ventes, setVentes] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [selectedVente, setSelectedVente] = useState(null);

  const [filters, setFilters] = useState({ dateDebut: '', dateFin: '', statut: '' });
  const [applied, setApplied] = useState({ dateDebut: '', dateFin: '', statut: '' });

  const fetchVentes = useCallback(
    async (p, f) => {
      try {
        const qs = new URLSearchParams({ page: p, limit: PAGE_SIZE });
        if (f.dateDebut) qs.set('dateDebut', f.dateDebut);
        if (f.dateFin) qs.set('dateFin', f.dateFin);
        if (f.statut) qs.set('statut', f.statut);
        const res = await get(`/api/ventes/mes-ventes?${qs}`, { silent: true });
        setVentes(res?.ventes ?? res?.data ?? []);
        setTotal(res?.total ?? res?.pagination?.total ?? 0);
        setTotalPages(res?.pages ?? res?.pagination?.totalPages ?? 1);
        setPage(p);
      } catch {
        // silent
      }
    },
    [get]
  );

  useEffect(() => {
    fetchVentes(1, applied);
  }, [applied, fetchVentes]);

  const handleApply = () => setApplied({ ...filters });

  const handleReset = () => {
    const empty = { dateDebut: '', dateFin: '', statut: '' };
    setFilters(empty);
    setApplied(empty);
  };

  const totalMontant = useMemo(
    () => ventes.reduce((s, v) => s + parseFloat(v.montantTotal ?? 0), 0),
    [ventes]
  );

  const lignes = selectedVente?.lignesVente ?? selectedVente?.lignes ?? [];
  const sousTotalLignes = lignes.reduce(
    (s, l) => s + parseFloat(l.sousTotal ?? parseFloat(l.prixUnitaire) * l.quantite ?? 0),
    0
  );

  const inputStyle = {
    background: 'var(--surface-overlay)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
    outline: 'none',
  };

  const columns = [
    {
      key: 'numeroVente',
      label: 'N° vente',
      render: (val) => (
        <span className="mono text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {val || '—'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date / Heure',
      render: (val) => (
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
            {val ? new Date(val).toLocaleDateString('fr-FR') : '—'}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {val ? new Date(val).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'nomClient',
      label: 'Client',
      render: (val) => (
        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{val || 'Comptoir'}</span>
      ),
    },
    {
      key: 'lignesVente',
      label: 'Articles',
      render: (val) => (
        <span className="mono text-xs" style={{ color: 'var(--text-muted)' }}>
          {val?.length ?? 0} art.
        </span>
      ),
    },
    {
      key: 'montantTotal',
      label: 'Montant',
      render: (val) => (
        <span className="mono font-semibold" style={{ color: 'var(--text-primary)' }}>
          {formatPrice(val)}
        </span>
      ),
    },
    {
      key: 'modePaiement',
      label: 'Paiement',
      render: (val) => (
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {MODE_LABELS[val] || val || '—'}
        </span>
      ),
    },
    {
      key: 'statut',
      label: 'Statut',
      render: (val) => (
        <Badge variant={STATUS_VARIANTS[val] ?? 'neutral'}>{STATUS_LABELS[val] ?? val}</Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <Button
          size="sm"
          variant="ghost"
          icon={Eye}
          onClick={(e) => { e.stopPropagation(); setSelectedVente(row); }}
        >
          Détail
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes ventes"
        subtitle="Historique de toutes vos ventes"
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={Download}
            onClick={() => exportCSV(ventes, formatPrice)}
            disabled={ventes.length === 0}
          >
            Export CSV
          </Button>
        }
      />

      <div
        className="rounded-xl p-4 flex flex-wrap items-end gap-3"
        style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Filtres
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-3 flex-1">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Date début</label>
            <input
              type="date"
              value={filters.dateDebut}
              onChange={(e) => setFilters((f) => ({ ...f, dateDebut: e.target.value }))}
              className="h-9 px-3 rounded-md text-sm"
              style={inputStyle}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Date fin</label>
            <input
              type="date"
              value={filters.dateFin}
              onChange={(e) => setFilters((f) => ({ ...f, dateFin: e.target.value }))}
              className="h-9 px-3 rounded-md text-sm"
              style={inputStyle}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Statut</label>
            <select
              value={filters.statut}
              onChange={(e) => setFilters((f) => ({ ...f, statut: e.target.value }))}
              className="h-9 px-3 rounded-md text-sm"
              style={inputStyle}
            >
              <option value="">Tous</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="primary" icon={Filter} onClick={handleApply}>Appliquer</Button>
            <Button size="sm" variant="ghost" icon={RotateCcw} onClick={handleReset}>Réinitialiser</Button>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={ventes}
        loading={loading && ventes.length === 0}
        emptyMessage="Aucune vente trouvée pour ces critères"
        emptyAction={
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={handleReset}>
            Réinitialiser les filtres
          </Button>
        }
        onRowClick={setSelectedVente}
      />

      <PaginationBar page={page} totalPages={totalPages} onPage={(p) => fetchVentes(p, applied)} />

      {!loading && ventes.length > 0 && (
        <div className="flex items-center justify-between text-xs px-1 pb-2" style={{ color: 'var(--text-muted)' }}>
          <span>{total} vente{total !== 1 ? 's' : ''} au total</span>
          <span className="mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Total (page) : {formatPrice(totalMontant)}
          </span>
        </div>
      )}

      <Modal
        open={!!selectedVente}
        onClose={() => setSelectedVente(null)}
        title={`Vente ${selectedVente?.numeroVente || ''}`}
        subtitle={
          selectedVente
            ? `${new Date(selectedVente.createdAt).toLocaleString('fr-FR')} — ${selectedVente.nomClient || 'Comptoir'}`
            : ''
        }
        size="lg"
        footer={<Button variant="ghost" onClick={() => setSelectedVente(null)}>Fermer</Button>}
      >
        {selectedVente && (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border-subtle)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-overlay)' }}>
                    {['DCI / Médicament', 'Qté', 'Prix unit.', 'Sous-total'].map((h) => (
                      <th key={h} className="py-2.5 px-4 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lignes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                        Aucune ligne de vente
                      </td>
                    </tr>
                  ) : (
                    lignes.map((l, i) => (
                      <tr key={i} style={{ borderBottom: i < lignes.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                        <td className="py-3 px-4">
                          <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                            {l.medicament?.dci || '—'}
                          </p>
                          {l.medicament?.nomCommercial && (
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{l.medicament.nomCommercial}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 mono text-sm" style={{ color: 'var(--text-secondary)' }}>{l.quantite}</td>
                        <td className="py-3 px-4 mono text-sm" style={{ color: 'var(--text-secondary)' }}>{formatPrice(l.prixUnitaire)}</td>
                        <td className="py-3 px-4 mono font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                          {formatPrice(l.sousTotal ?? parseFloat(l.prixUnitaire) * l.quantite)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg p-4 space-y-2" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span>Sous-total HT</span>
                <span className="mono">{formatPrice(sousTotalLignes)}</span>
              </div>
              <div className="flex justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span>TVA</span><span className="mono">—</span>
              </div>
              <div className="flex justify-between font-bold text-base" style={{ color: 'var(--text-primary)', borderTop: '1px solid var(--border-default)', paddingTop: 8 }}>
                <span>Total</span>
                <span className="mono" style={{ color: 'var(--color-primary)' }}>{formatPrice(selectedVente.montantTotal)}</span>
              </div>
              {selectedVente.modePaiement && (
                <p className="text-xs pt-1" style={{ color: 'var(--text-muted)' }}>
                  Paiement : {MODE_LABELS[selectedVente.modePaiement] || selectedVente.modePaiement}
                </p>
              )}
            </div>

            <Badge variant={STATUS_VARIANTS[selectedVente.statut] ?? 'neutral'}>
              {STATUS_LABELS[selectedVente.statut] ?? selectedVente.statut}
            </Badge>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MesVentes;

