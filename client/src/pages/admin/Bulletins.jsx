import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import axiosInstance from '../../utils/axios';
import {
  PageHeader, DataTable, Badge, Button, Card, KpiCard, KpiGrid, Modal,
} from '../../components/ui';
import {
  Calculator, FileDown, CheckCircle, Eye, Printer, Users,
  UserCheck, UserX, Percent, TrendingUp, Lock, Unlock,
} from 'lucide-react';
import toast from 'react-hot-toast';

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

const eleveLabel = (row) => {
  const prenom = row.elevePrenom || row.eleve?.prenom || '';
  const nom = row.eleveNom || row.eleve?.nom || '';
  return `${prenom} ${nom}`.trim() || '—';
};

const Bulletins = () => {
  const { get, post, put } = useAxios();
  const { config, slug, refreshConfig } = useTenant();
  const [togglingLock, setTogglingLock] = useState(false);
  const [searchParams] = useSearchParams();
  const [annees, setAnnees] = useState([]);
  const [classes, setClasses] = useState([]);
  const [periodes, setPeriodes] = useState([]);
  const [selectedAnnee, setSelectedAnnee] = useState('');
  const [selectedClasse, setSelectedClasse] = useState('');
  const [selectedPeriode, setSelectedPeriode] = useState('');
  const [resultats, setResultats] = useState([]);
  const [bulletins, setBulletins] = useState([]);
  const [stats, setStats] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [an, cl] = await Promise.all([
          get('/api/annees-scolaires', { silent: true }),
          get('/api/classes?limit=200', { silent: true }),
        ]);
        const anData = an?.data || an || [];
        const clData = cl?.data || cl || [];
        setAnnees(anData);
        setClasses(clData);
        const qAnnee = searchParams.get('anneeScolaireId');
        const qClasse = searchParams.get('classeId');
        const active = anData.find((a) => a.actif);
        setSelectedAnnee(qAnnee || active?.id || '');
        if (qClasse) setSelectedClasse(qClasse);
      } catch { /* silent */ }
    })();
  }, [get, searchParams]);

  const selectedClasseObj = classes.find((c) => c.id === selectedClasse);

  useEffect(() => {
    (async () => {
      if (!selectedAnnee) {
        setPeriodes([]);
        return;
      }
      try {
        const cycle = selectedClasseObj?.cycle;
        const qs = new URLSearchParams({ anneeScolaireId: selectedAnnee });
        if (cycle) qs.set('cycle', cycle);
        const res = await get(`/api/referentiel/periodes?${qs}`, { silent: true });
        const list = res?.data || res || [];
        setPeriodes(list);
        if (list.length) {
          setSelectedPeriode((prev) => {
            if (prev !== '' && list.some((p) => String(p.index) === String(prev))) return prev;
            return list[0].index;
          });
        } else {
          setSelectedPeriode('');
        }
      } catch {
        setPeriodes([]);
      }
    })();
  }, [selectedAnnee, selectedClasseObj?.cycle, get]);

  const fetchBulletins = useCallback(async () => {
    if (!selectedAnnee || selectedPeriode === '') return;
    try {
      const qs = new URLSearchParams({
        anneeScolaireId: selectedAnnee,
        periodeIndex: String(selectedPeriode),
        limit: '500',
      });
      if (selectedClasse) qs.set('classeId', selectedClasse);
      const res = await get(`/api/bulletins?${qs}`, { silent: true });
      setBulletins(res?.data || res || []);
    } catch { /* silent */ }
  }, [selectedAnnee, selectedClasse, selectedPeriode, get]);

  const fetchStats = useCallback(async () => {
    if (!selectedAnnee || selectedPeriode === '') {
      setStats(null);
      return;
    }
    try {
      const qs = new URLSearchParams({
        anneeScolaireId: selectedAnnee,
        periodeIndex: String(selectedPeriode),
      });
      if (selectedClasse) qs.set('classeId', selectedClasse);
      const res = await get(`/api/bulletins/stats?${qs}`, { silent: true });
      setStats(res?.data || res || null);
    } catch {
      setStats(null);
    }
  }, [selectedAnnee, selectedClasse, selectedPeriode, get]);

  useEffect(() => {
    fetchBulletins();
    fetchStats();
    setResultats([]);
  }, [fetchBulletins, fetchStats]);

  const calculerMoyennes = async () => {
    if (!selectedAnnee || !selectedClasse || selectedPeriode === '') return;
    setCalculating(true);
    try {
      const res = await post('/api/bulletins/calculer', {
        anneeScolaireId: selectedAnnee,
        classeId: selectedClasse,
        periodeIndex: parseInt(selectedPeriode, 10),
      });
      setResultats(res?.data || res || []);
      toast.success('Moyennes calculées');
    } catch { /* toast via useAxios */ }
    setCalculating(false);
  };

  const genererPDFs = async () => {
    if (!selectedClasse) {
      toast.error('Sélectionnez une classe pour générer les bulletins');
      return;
    }
    setGenerating(true);
    try {
      await post('/api/bulletins/generer-masse', {
        anneeScolaireId: selectedAnnee,
        classeId: selectedClasse,
        periodeIndex: parseInt(selectedPeriode, 10),
      });
      toast.success('Bulletins PDF générés');
      fetchBulletins();
      fetchStats();
    } catch { /* toast via useAxios */ }
    setGenerating(false);
  };

  const publier = async () => {
    if (!selectedClasse) return;
    try {
      await put('/api/bulletins/publier', {
        anneeScolaireId: selectedAnnee,
        classeId: selectedClasse,
        periodeIndex: parseInt(selectedPeriode, 10),
      });
      toast.success('Bulletins publiés');
      fetchBulletins();
    } catch { /* toast via useAxios */ }
  };

  const openPdf = async (bulletinId) => {
    if (!bulletinId) {
      toast.error('Générez d’abord le bulletin PDF');
      return;
    }
    try {
      const res = await axiosInstance.get(`/api/bulletins/${bulletinId}/pdf`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error('Impossible d’ouvrir le PDF');
    }
  };

  const openDetail = async (row) => {
    const bulletinId = row.id || row.bulletinId;
    let notes = row.notesDetaillees || [];
    let full = row;
    if (bulletinId) {
      try {
        const b = await get(`/api/bulletins/${bulletinId}`, { silent: true });
        full = b;
        notes = b.notesDetaillees || notes;
      } catch { /* use row */ }
    }

    // Rang par matière depuis les résultats de classe si disponibles
    const peers = resultats.length ? resultats : [];
    const withRang = (notes || []).map((n) => {
      let rangMatiere = n.rangMatiere;
      if (rangMatiere == null && peers.length && n.matiereId) {
        const scores = peers
          .map((p) => {
            const m = (p.notesDetaillees || []).find((x) => x.matiereId === n.matiereId);
            return m ? { eleveId: p.eleveId, moy: Number(m.moyenne) } : null;
          })
          .filter(Boolean)
          .sort((a, b) => b.moy - a.moy);
        const idx = scores.findIndex((s) => s.eleveId === (row.eleveId || full.eleveId));
        if (idx >= 0) rangMatiere = idx + 1;
      }
      return { ...n, rangMatiere };
    });

    setDetail({
      ...full,
      ...row,
      notesDetaillees: withRang,
      elevePrenom: row.elevePrenom || full.eleve?.prenom,
      eleveNom: row.eleveNom || full.eleve?.nom,
      matricule: row.matricule || full.eleve?.matricule,
    });
  };

  const listeAffichee = useMemo(() => {
    if (resultats.length) return resultats;
    return (bulletins || []).map((b) => ({
      ...b,
      eleveId: b.eleveId,
      elevePrenom: b.eleve?.prenom,
      eleveNom: b.eleve?.nom,
      matricule: b.eleve?.matricule,
      bulletinId: b.id,
    }));
  }, [resultats, bulletins]);

  const selectStyle = {
    height: 38,
    width: 180,
    maxWidth: '100%',
    background: 'var(--surface-overlay)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 14,
    padding: '0 12px',
  };

  const isSaisieOuverte = config?.saisieNotesOuverte !== false;

  const toggleSaisieNotes = async () => {
    setTogglingLock(true);
    try {
      await put(`/api/config/${slug}`, { saisieNotesOuverte: !isSaisieOuverte });
      toast.success(isSaisieOuverte ? 'Saisie des notes verrouillée (fermée)' : 'Saisie des notes déverrouillée (ouverte)');
      if (refreshConfig) await refreshConfig();
    } catch {
      toast.error('Impossible de modifier le verrou de saisie');
    }
    setTogglingLock(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Résultats et Bulletin"
        subtitle="Vue d’ensemble des moyennes, KPI d’admission et bulletins PDF"
        actions={
          <Button
            variant={isSaisieOuverte ? 'secondary' : 'danger'}
            icon={isSaisieOuverte ? Unlock : Lock}
            onClick={toggleSaisieNotes}
            loading={togglingLock}
            title={isSaisieOuverte ? 'Cliquez pour fermer la saisie des notes aux enseignants' : 'Cliquez pour ouvrir la saisie des notes'}
          >
            Saisie enseignants : {isSaisieOuverte ? 'Ouverte' : 'Fermée (Verrouillée)'}
          </Button>
        }
      />

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
              <option value="">Tout l’établissement</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Période</label>
            <select
              style={{ ...selectStyle, width: 160 }}
              value={selectedPeriode}
              onChange={(e) => setSelectedPeriode(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              disabled={!periodes.length}
            >
              {!periodes.length && <option value="">Aucune période</option>}
              {periodes.map((p) => (
                <option key={p.id || p.index} value={p.index}>{p.libelle}</option>
              ))}
            </select>
          </div>
          {selectedClasse && (
            <Button
              icon={Calculator}
              onClick={calculerMoyennes}
              loading={calculating}
              disabled={!selectedAnnee || selectedPeriode === ''}
            >
              Calculer les moyennes
            </Button>
          )}
        </div>
        {selectedClasseObj && (
          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
            Cycle {selectedClasseObj.cycle} — périodes filtrées automatiquement
            {['prescolaire', 'primaire'].includes(selectedClasseObj.cycle)
              ? ' (compositions mensuelles)'
              : ' (trimestres)'}
          </p>
        )}
        {!selectedClasse && (
          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
            Sans classe : KPI établissement et top 5 des meilleures moyennes (bulletins déjà générés).
          </p>
        )}
      </Card>

      {stats && (
        <KpiGrid cols={5}>
          <KpiCard label="Effectif noté" value={stats.total} icon={Users} color="blue" />
          <KpiCard label="Admis" value={stats.admis} icon={UserCheck} color="green" />
          <KpiCard label="Échoués" value={stats.echec} icon={UserX} color="red" />
          <KpiCard label="% admission" value={`${stats.tauxAdmission}%`} icon={Percent} color="primary" />
          <KpiCard label="Moyenne" value={Number(stats.moyenneClasse || 0).toFixed(2)} icon={TrendingUp} color="orange" />
        </KpiGrid>
      )}

      {!selectedClasse && stats?.top5?.length > 0 && (
        <Card title="Top 5 — établissement">
          <DataTable
            columns={[
              {
                key: 'rang',
                label: 'Rang',
                render: (v) => <Badge variant={v <= 3 ? 'success' : 'neutral'}>{v}{v === 1 ? 'er' : 'e'}</Badge>,
              },
              {
                key: 'eleve',
                label: 'Élève',
                render: (_, row) => <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{eleveLabel(row)}</span>,
              },
              { key: 'classeNom', label: 'Classe' },
              {
                key: 'moyenneGenerale',
                label: 'Moyenne',
                render: (val) => <span className="font-mono font-semibold" style={{ color: 'var(--color-primary)' }}>{Number(val).toFixed(2)}</span>,
              },
            ]}
            data={stats.top5}
            emptyMessage="Aucun bulletin"
          />
        </Card>
      )}

      {selectedClasse && (
        <Card title="Résultats de la classe">
          <div className="flex flex-wrap gap-2 mb-4">
            <Button icon={FileDown} onClick={genererPDFs} loading={generating} disabled={!listeAffichee.length && !resultats.length}>
              Générer les PDFs
            </Button>
            <Button icon={CheckCircle} variant="secondary" onClick={publier}>Valider et publier</Button>
          </div>
          <DataTable
            columns={[
              {
                key: 'eleve',
                label: 'Élève',
                render: (_, row) => <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{eleveLabel(row)}</span>,
              },
              {
                key: 'moyenneGenerale',
                label: 'Moyenne',
                render: (val) => <span className="font-mono font-semibold" style={{ color: 'var(--color-primary)' }}>{Number(val ?? 0).toFixed(2)}</span>,
              },
              {
                key: 'rang',
                label: 'Rang',
                render: (val) => val != null ? <Badge variant={val <= 3 ? 'success' : 'neutral'}>{val}{val === 1 ? 'er' : 'e'}</Badge> : '—',
              },
              {
                key: 'mention',
                label: 'Mention',
                render: (val) => val ? <Badge variant={MENTION_VARIANT[val] || 'neutral'}>{MENTION_LABEL[val] || val}</Badge> : '—',
              },
              {
                key: 'valide',
                label: 'Statut',
                render: (val, row) => {
                  if (val === undefined) return null;
                  return <Badge variant={val ? 'success' : 'warning'}>{val ? 'Publié' : 'Brouillon'}</Badge>;
                },
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (_, row) => (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openDetail(row)}
                      className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]"
                      title="Détails"
                    >
                      <Eye className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openPdf(row.id || row.bulletinId)}
                      className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]"
                      title="Impression PDF"
                    >
                      <Printer className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                    </button>
                  </div>
                ),
              },
            ]}
            data={listeAffichee}
            emptyMessage="Calculez les moyennes ou générez les bulletins pour cette classe"
          />
        </Card>
      )}

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `Détail — ${eleveLabel(detail)}` : 'Détail'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDetail(null)}>Fermer</Button>
            {(detail?.id || detail?.bulletinId) && (
              <Button icon={Printer} onClick={() => openPdf(detail.id || detail.bulletinId)}>Impression</Button>
            )}
          </>
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span style={{ color: 'var(--text-muted)' }}>Matricule </span>{detail.matricule || '—'}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Moyenne </span>
                <strong style={{ color: 'var(--color-primary)' }}>{Number(detail.moyenneGenerale ?? 0).toFixed(2)}</strong>
              </div>
              <div><span style={{ color: 'var(--text-muted)' }}>Rang </span>{detail.rang ?? '—'}{detail.effectifClasse ? ` / ${detail.effectifClasse}` : ''}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Mention </span>{MENTION_LABEL[detail.mention] || detail.mention || '—'}</div>
            </div>
            <DataTable
              columns={[
                {
                  key: 'matiereNom',
                  label: 'Matière',
                  render: (v, row) => v || row.matiere?.nom || '—',
                },
                {
                  key: 'moyenne',
                  label: 'Note / moy.',
                  render: (v) => <span className="font-mono">{v != null ? Number(v).toFixed(2) : '—'}</span>,
                },
                { key: 'coefficient', label: 'Coef.' },
                {
                  key: 'rangMatiere',
                  label: 'Rang matière',
                  render: (v) => (v != null ? v : '—'),
                },
              ]}
              data={detail.notesDetaillees || []}
              emptyMessage="Aucun détail de notes"
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Bulletins;
