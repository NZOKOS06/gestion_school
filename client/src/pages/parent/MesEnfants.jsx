import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { PageHeader, Card, Badge, DataTable } from '../../components/ui';
import { Users, GraduationCap } from 'lucide-react';

const MesEnfants = () => {
  const { get } = useAxios();
  const { formatPrice } = useTenant();
  const [enfants, setEnfants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);

  const fetchEnfants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get('/api/parent/mes-enfants');
      setEnfants(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchEnfants(); }, [fetchEnfants]);

  const openDetail = async (enfant) => {
    setSelected(enfant);
    try {
      const res = await get(`/api/parent/enfants/${enfant.id}`, { silent: true });
      setDetail(res);
    } catch { setDetail(null); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Mes enfants" subtitle="Dossiers scolaires de vos enfants" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <div className="skeleton h-12 w-12 rounded-full mb-3" />
              <div className="skeleton h-5 w-32 rounded mb-2" />
              <div className="skeleton h-3 w-24 rounded" />
            </div>
          ))
        ) : enfants.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <Users className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} strokeWidth={1.25} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucun enfant enregistré</p>
          </div>
        ) : (
          enfants.map((enfant) => (
            <Card key={enfant.id}>
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}>
                  {enfant.prenom?.[0]}{enfant.nom?.[0]}
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{enfant.prenom} {enfant.nom}</h3>
                  <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{enfant.matricule}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Classe</span>
                  <span style={{ color: 'var(--text-primary)' }}>{enfant.classeNom || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Date de naissance</span>
                  <span style={{ color: 'var(--text-primary)' }}>{new Date(enfant.dateNaissance).toLocaleDateString('fr-FR')}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Solde scolarité</span>
                  <span className="font-semibold" style={{ color: enfant.soldeScolarite > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                    {formatPrice(enfant.soldeScolarite || 0)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => openDetail(enfant)}
                className="mt-4 w-full text-center text-xs font-medium py-2 rounded-md transition-all"
                style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', color: 'var(--color-primary)' }}
              >
                Voir le dossier complet
              </button>
            </Card>
          ))
        )}
      </div>

      {selected && detail && (
        <Card title={`Dossier — ${selected.prenom} ${selected.nom}`} subtitle={selected.classeNom}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Notes récentes</h4>
              <DataTable
                columns={[
                  { key: 'matiere', label: 'Matière', render: (_, r) => <span style={{ color: 'var(--text-primary)' }}>{r.matiereNom}</span> },
                  { key: 'evaluation', label: 'Évaluation', render: (v) => <span style={{ color: 'var(--text-secondary)' }}>{v}</span> },
                  { key: 'valeur', label: 'Note', render: (v, r) => <span className="font-mono font-semibold" style={{ color: 'var(--color-primary)' }}>{Number(v).toFixed(2)}/{r.noteMaximale || 20}</span> },
                ]}
                data={detail.notes || []}
                emptyMessage="Aucune note"
              />
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Absences</h4>
              <DataTable
                columns={[
                  { key: 'dateAbsence', label: 'Date', render: (v) => <span style={{ color: 'var(--text-secondary)' }}>{new Date(v).toLocaleDateString('fr-FR')}</span> },
                  { key: 'justifiee', label: 'Statut', render: (v) => <Badge variant={v ? 'success' : 'danger'}>{v ? 'Justifiée' : 'Non justifiée'}</Badge> },
                ]}
                data={detail.absences || []}
                emptyMessage="Aucune absence"
              />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default MesEnfants;
