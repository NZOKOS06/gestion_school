import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { PageHeader, DataTable, Badge, Button, Card } from '../../components/ui';
import { FileText, Calculator, FileDown, CheckCircle, Eye } from 'lucide-react';

const MENTION_VARIANT = {
  felicitations: 'success',
  tableau_honneur: 'success',
  encouragements: 'info',
  avertissement_travail: 'warning',
  avertissement_conduite: 'warning',
  aucune: 'neutral',
};

const MENTION_LABEL = {
  felicitations: 'Félicitations',
  tableau_honneur: 'Tableau d\'honneur',
  encouragements: 'Encouragements',
  avertissement_travail: 'Avert. travail',
  avertissement_conduite: 'Avert. conduite',
  aucune: '—',
};

const Bulletins = () => {
  const { get, post, put } = useAxios();
  const [annees, setAnnees] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedAnnee, setSelectedAnnee] = useState('');
  const [selectedClasse, setSelectedClasse] = useState('');
  const [selectedPeriode, setSelectedPeriode] = useState(1);
  const [resultats, setResultats] = useState([]);
  const [bulletins, setBulletins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [an, cl] = await Promise.all([
          get('/api/annees-scolaires', { silent: true }),
          get('/api/classes', { silent: true }),
        ]);
        const anData = an?.data || an || [];
        const clData = cl?.data || cl || [];
        setAnnees(anData);
        setClasses(clData);
        const active = anData.find((a) => a.actif);
        if (active) setSelectedAnnee(active.id);
      } catch { /* silent */ }
    })();
  }, []);

  const fetchBulletins = useCallback(async () => {
    if (!selectedAnnee || !selectedClasse) return;
    try {
      const res = await get(`/api/bulletins?anneeScolaireId=${selectedAnnee}&classeId=${selectedClasse}&periodeIndex=${selectedPeriode}`, { silent: true });
      setBulletins(res?.data || res || []);
    } catch { /* silent */ }
  }, [selectedAnnee, selectedClasse, selectedPeriode]);

  useEffect(() => { fetchBulletins(); }, [fetchBulletins]);

  const calculerMoyennes = async () => {
    if (!selectedAnnee || !selectedClasse) return;
    setCalculating(true);
    try {
      const res = await post('/api/bulletins/calculer', {
        anneeScolaireId: selectedAnnee,
        classeId: selectedClasse,
        periodeIndex: parseInt(selectedPeriode),
      });
      setResultats(res?.data || res || []);
    } catch { /* silent */ }
    setCalculating(false);
  };

  const genererPDFs = async () => {
    setGenerating(true);
    try {
      await post('/api/bulletins/generer-masse', {
        anneeScolaireId: selectedAnnee,
        classeId: selectedClasse,
        periodeIndex: parseInt(selectedPeriode),
      });
      fetchBulletins();
    } catch { /* silent */ }
    setGenerating(false);
  };

  const publier = async () => {
    try {
      await put('/api/bulletins/publier', {
        anneeScolaireId: selectedAnnee,
        classeId: selectedClasse,
        periodeIndex: parseInt(selectedPeriode),
      });
      fetchBulletins();
    } catch { /* silent */ }
  };

  const selectStyle = {
    height: 38,
    background: 'var(--surface-overlay)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 14,
    padding: '0 12px',
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Bulletins" subtitle="Calcul des moyennes et génération des bulletins" />

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Année scolaire</label>
            <select style={selectStyle} value={selectedAnnee} onChange={(e) => setSelectedAnnee(e.target.value)}>
              <option value="">Sélectionner</option>
              {annees.map((a) => <option key={a.id} value={a.id}>{a.libelle}{a.actif ? ' (active)' : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Classe</label>
            <select style={selectStyle} value={selectedClasse} onChange={(e) => setSelectedClasse(e.target.value)}>
              <option value="">Sélectionner</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Période</label>
            <select style={selectStyle} value={selectedPeriode} onChange={(e) => setSelectedPeriode(parseInt(e.target.value))}>
              <option value={1}>Trimestre/Semestre 1</option>
              <option value={2}>Trimestre/Semestre 2</option>
              <option value={3}>Trimestre 3</option>
            </select>
          </div>
          <Button icon={Calculator} onClick={calculerMoyennes} loading={calculating} disabled={!selectedAnnee || !selectedClasse}>
            Calculer les moyennes
          </Button>
        </div>
      </Card>

      {resultats.length > 0 && (
        <Card title="Résultats du calcul">
          <div className="flex gap-2 mb-4">
            <Button icon={FileDown} onClick={genererPDFs} loading={generating}>Générer les PDFs</Button>
            <Button icon={CheckCircle} variant="secondary" onClick={publier}>Valider et publier</Button>
          </div>
          <DataTable
            columns={[
              {
                key: 'eleve',
                label: 'Élève',
                render: (_, row) => <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{row.elevePrenom} {row.eleveNom}</span>,
              },
              {
                key: 'moyenneGenerale',
                label: 'Moyenne',
                render: (val) => <span className="font-mono font-semibold" style={{ color: 'var(--color-primary)' }}>{Number(val).toFixed(2)}</span>,
              },
              {
                key: 'rang',
                label: 'Rang',
                render: (val) => <Badge variant={val <= 3 ? 'success' : 'neutral'}>{val}{val === 1 ? 'er' : 'e'}</Badge>,
              },
              {
                key: 'mention',
                label: 'Mention',
                render: (val) => <Badge variant={MENTION_VARIANT[val] || 'neutral'}>{MENTION_LABEL[val] || val}</Badge>,
              },
            ]}
            data={resultats}
            emptyMessage="Aucun résultat"
          />
        </Card>
      )}

      {bulletins.length > 0 && (
        <Card title="Bulletins générés">
          <DataTable
            columns={[
              {
                key: 'eleve',
                label: 'Élève',
                render: (_, row) => <span style={{ color: 'var(--text-primary)' }}>{row.elevePrenom} {row.eleveNom}</span>,
              },
              {
                key: 'moyenneGenerale',
                label: 'Moyenne',
                render: (val) => <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{Number(val).toFixed(2)}</span>,
              },
              {
                key: 'rang',
                label: 'Rang',
                render: (val) => <span style={{ color: 'var(--text-secondary)' }}>{val}</span>,
              },
              {
                key: 'valide',
                label: 'Statut',
                render: (val) => val ? <Badge variant="success" dot>Publié</Badge> : <Badge variant="warning">Brouillon</Badge>,
              },
              {
                key: 'actions',
                label: 'PDF',
                render: (_, row) => row.pdfUrl ? (
                  <a href={row.pdfUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md hover:bg-[var(--surface-hover)] inline-flex">
                    <Eye className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                  </a>
                ) : <span style={{ color: 'var(--text-muted)' }}>—</span>,
              },
            ]}
            data={bulletins}
            emptyMessage="Aucun bulletin généré"
          />
        </Card>
      )}
    </div>
  );
};

export default Bulletins;
