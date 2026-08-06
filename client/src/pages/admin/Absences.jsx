import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { PageHeader, DataTable, Badge, Button, Modal } from '../../components/ui';
import { CalendarX, Check, FileImage, Clock, LogOut } from 'lucide-react';

const Absences = () => {
  const { get, put } = useAxios();
  const [absences, setAbsences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ classe: '', justifiee: '', periode: 'aujourdhui', typeAbsence: '' });
  const [justifModal, setJustifModal] = useState(null);

  const fetchAbsences = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.classe) params.set('classe', filters.classe);
      if (filters.justifiee) params.set('justifiee', filters.justifiee);
      if (filters.periode) params.set('periode', filters.periode);
      if (filters.typeAbsence) params.set('typeAbsence', filters.typeAbsence);
      const res = await get(`/api/absences?${params.toString()}`);
      setAbsences(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [filters]);

  useEffect(() => { fetchAbsences(); }, [fetchAbsences]);

  const justifier = async (absence) => {
    try {
      await put(`/api/absences/${absence.id}`, { justifiee: true });
      setJustifModal(null);
      fetchAbsences();
    } catch { /* silent */ }
  };

  const selectStyle = {
    height: 36,
    background: 'var(--surface-overlay)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 13,
    padding: '0 8px',
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Absences" subtitle="Suivi des absences et justificatifs" />

      <div className="flex gap-3 flex-wrap">
        <select style={selectStyle} value={filters.periode} onChange={(e) => setFilters({ ...filters, periode: e.target.value })}>
          <option value="aujourdhui">Aujourd'hui</option>
          <option value="semaine">Cette semaine</option>
          <option value="mois">Ce mois</option>
          <option value="">Tout l'historique</option>
        </select>
        <select style={selectStyle} value={filters.typeAbsence} onChange={(e) => setFilters({ ...filters, typeAbsence: e.target.value })}>
          <option value="">Tous types</option>
          <option value="absent">Absent</option>
          <option value="retard">Retard</option>
          <option value="depart_anticipe">Départ anticipé</option>
        </select>
        <select style={selectStyle} value={filters.justifiee} onChange={(e) => setFilters({ ...filters, justifiee: e.target.value })}>
          <option value="">Toutes</option>
          <option value="true">Justifiées</option>
          <option value="false">Non justifiées</option>
        </select>
      </div>

      <DataTable
        columns={[
          {
            key: 'eleve',
            label: 'Élève',
            render: (_, row) => (
              <div>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {row.elevePrenom || row.eleve?.prenom} {row.eleveNom || row.eleve?.nom}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.classeNom || row.classe?.nom}</p>
              </div>
            ),
          },
          {
            key: 'typeAbsence',
            label: 'Type',
            render: (val) => {
              const config = {
                absent: { label: 'Absent', variant: 'danger', icon: CalendarX },
                retard: { label: 'Retard', variant: 'warning', icon: Clock },
                depart_anticipe: { label: 'Départ anticipé', variant: 'warning', icon: LogOut },
              };
              const c = config[val] || config.absent;
              return <Badge variant={c.variant} dot>{c.label}</Badge>;
            },
          },
          {
            key: 'dateAbsence',
            label: 'Date',
            render: (val) => <span style={{ color: 'var(--text-secondary)' }}>{new Date(val).toLocaleDateString('fr-FR')}</span>,
          },
          {
            key: 'motifJustif',
            label: 'Motif',
            render: (val) => <span style={{ color: 'var(--text-secondary)' }}>{val || '—'}</span>,
          },
          {
            key: 'justifiee',
            label: 'Statut',
            render: (val) => val ? <Badge variant="success">Justifiée</Badge> : <Badge variant="danger" dot>Non justifiée</Badge>,
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (_, row) => (
              <div className="flex items-center gap-1">
                {row.pieceJustifUrl && (
                  <button onClick={() => setJustifModal(row)} className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title="Voir justificatif">
                    <FileImage className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                )}
                {!row.justifiee && (
                  <button onClick={() => setJustifModal(row)} className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title="Justifier">
                    <Check className="h-4 w-4" style={{ color: 'var(--color-success)' }} />
                  </button>
                )}
              </div>
            ),
          },
        ]}
        data={absences}
        loading={loading}
        emptyMessage="Aucune absence"
      />

      <Modal
        open={!!justifModal}
        onClose={() => setJustifModal(null)}
        title="Justificatif d'absence"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setJustifModal(null)}>Fermer</Button>
            {!justifModal?.justifiee && (
              <Button icon={Check} onClick={() => justifier(justifModal)}>Marquer comme justifiée</Button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {justifModal?.elevePrenom || justifModal?.eleve?.prenom} {justifModal?.eleveNom || justifModal?.eleve?.nom}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {justifModal?.dateAbsence && new Date(justifModal.dateAbsence).toLocaleDateString('fr-FR')}
            </p>
          </div>
          {justifModal?.motifJustif && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Motif</p>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{justifModal.motifJustif}</p>
            </div>
          )}
          {justifModal?.pieceJustifUrl && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Pièce justificative</p>
              <img src={justifModal.pieceJustifUrl} alt="Justificatif" className="w-full rounded-lg" style={{ border: '1px solid var(--border-subtle)' }} />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Absences;
