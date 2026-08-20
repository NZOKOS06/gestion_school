import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAxios } from '../../hooks/useAxios';
import { PageHeader, Card, DataTable, Badge, Button } from '../../components/ui';
import { School, Users, BookOpen, ClipboardEdit, Plus } from 'lucide-react';

const CYCLE_LABELS = { prescolaire: 'Préscolaire', primaire: 'Primaire', college: 'Collège', lycee: 'Lycée' };

const MesClasses = () => {
  const { get } = useAxios();
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClasse, setSelectedClasse] = useState(null);
  const [eleves, setEleves] = useState([]);

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get('/api/enseignant/mes-classes');
      setClasses(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [get]);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  const viewEleves = async (classe) => {
    setSelectedClasse(classe);
    try {
      const res = await get(`/api/classes/${classe.id}/eleves`, { silent: true });
      setEleves(res?.data || res || []);
    } catch { setEleves([]); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Mes classes" subtitle="Classes et élèves qui vous sont affectés" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <div className="skeleton h-5 w-32 rounded mb-3" />
              <div className="skeleton h-3 w-20 rounded" />
            </div>
          ))
        ) : classes.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <School className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} strokeWidth={1.25} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucune classe affectée</p>
          </div>
        ) : (
          classes.map((classe) => (
            <Card key={classe.id}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{classe.nom}</h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{classe.niveau} {classe.filiere ? `· ${classe.filiere}` : ''}</p>
                </div>
                <Badge variant="info">{CYCLE_LABELS[classe.cycle] || classe.cycle}</Badge>
              </div>
              <div className="flex items-center gap-4 text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {classe.effectif || 0} élève{classe.effectif > 1 ? 's' : ''}</span>
                <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {classe.nbMatieres || 0} matières</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => viewEleves(classe)}>Voir les élèves</Button>
                {classe.effectif > 0 && (
                  <Button size="sm" icon={ClipboardEdit} onClick={() => navigate(`/enseignant/saisie-notes?classeId=${classe.id}`)}>
                    Saisir les notes
                  </Button>
                )}
                <Button size="sm" icon={Plus} onClick={() => navigate(`/enseignant/saisie-notes?classeId=${classe.id}&nouveau=1`)}>
                  Programmer un devoir
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {selectedClasse && (
        <Card title={`Élèves — ${selectedClasse.nom}`}>
          <DataTable
            columns={[
              { key: 'matricule', label: 'Matricule', render: (v) => <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{v}</span> },
              { key: 'nom', label: 'Nom', render: (_, r) => (
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}>
                    {r.prenom?.[0]}{r.nom?.[0]}
                  </div>
                  <span style={{ color: 'var(--text-primary)' }}>{r.prenom} {r.nom}</span>
                </div>
              )},
              { key: 'sexe', label: 'Sexe', render: (v) => <span style={{ color: 'var(--text-secondary)' }}>{v === 'M' ? 'Garçon' : 'Fille'}</span> },
              { key: 'dateNaissance', label: 'Naissance', render: (v) => <span style={{ color: 'var(--text-muted)' }}>{new Date(v).toLocaleDateString('fr-FR')}</span> },
            ]}
            data={eleves}
            emptyMessage="Aucun élève dans cette classe"
          />
        </Card>
      )}
    </div>
  );
};

export default MesClasses;
