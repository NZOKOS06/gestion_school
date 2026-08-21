import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, Card, Badge, Button, Modal } from '../../components/ui';
import { CalendarRange, Plus, Save, Trash2, Copy, AlertTriangle, CheckCircle2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUT_LABEL = { brouillon: 'Brouillon', active: 'Active', archivee: 'Archivée' };
const STATUT_VARIANT = { brouillon: 'warning', active: 'success', archivee: 'neutral' };

const getAnneeStatut = (a) => {
  if (!a) return null;
  if (a.statut) return a.statut;
  return a.actif ? 'active' : 'archivee';
};

const CYCLES_OPTS = [
  { value: 'prescolaire', label: 'Préscolaire' },
  { value: 'primaire', label: 'Primaire' },
  { value: 'college', label: 'Collège' },
  { value: 'lycee', label: 'Lycée' },
];

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const emptyPeriode = (index) => ({
  index,
  libelle: index === 1 ? '1er trimestre' : index < 10 ? `${index}e trimestre` : `Composition ${index}`,
  dateDebut: '',
  dateFin: '',
  dateEvaluationDebut: '',
  dateEvaluationFin: '',
  poids: 1,
  concerneCycles: [],
});

const sliceDate = (v) => {
  if (!v) return '';
  if (typeof v === 'string') return v.slice(0, 10);
  return new Date(v).toISOString().slice(0, 10);
};

const parseLocal = (s) => (s ? new Date(`${s}T12:00:00`) : null);

const AnneesScolaires = () => {
  const { get, post, put, delete: del } = useAxios();
  const { hasRole } = useAuth();
  const canWrite = hasRole('directeur', 'directeur_etudes');
  const isDirecteur = hasRole('directeur');

  const [annees, setAnnees] = useState([]);
  const [versions, setVersions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [periodes, setPeriodes] = useState([]);
  const [alertes, setAlertes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editDatesOpen, setEditDatesOpen] = useState(false);
  const [editDatesForm, setEditDatesForm] = useState({ libelle: '', dateDebut: '', dateFin: '' });
  const [form, setForm] = useState({ libelle: '', dateDebut: '', dateFin: '', referentielVersionId: '' });

  const selectedStatut = getAnneeStatut(selected);
  const isArchivee = selectedStatut === 'archivee';
  const canEditContent = canWrite && !isArchivee;
  const canEditDates = isDirecteur || (canWrite && !isArchivee);

  const inputStyle = {
    width: '100%',
    height: 38,
    background: 'var(--surface-overlay)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 14,
    padding: '0 12px',
  };

  const mapPeriodes = (list) => (list?.length
    ? list.map((p) => ({
      ...p,
      dateDebut: sliceDate(p.dateDebut),
      dateFin: sliceDate(p.dateFin),
      dateEvaluationDebut: sliceDate(p.dateEvaluationDebut),
      dateEvaluationFin: sliceDate(p.dateEvaluationFin),
      concerneCycles: Array.isArray(p.concerneCycles) ? p.concerneCycles : [],
    }))
    : [emptyPeriode(1), emptyPeriode(2), emptyPeriode(3)]);

  const fetchAnnees = useCallback(async () => {
    setLoading(true);
    try {
      const [an, ver] = await Promise.all([
        get('/api/annees-scolaires', { silent: true }),
        get('/api/referentiel/versions', { silent: true }),
      ]);
      const list = an?.data || an || [];
      setAnnees(list);
      setVersions(ver?.data || ver || []);
      const active = list.find((a) => getAnneeStatut(a) === 'active' || a.actif) || list[0];
      if (active) {
        setSelected(active);
        setPeriodes(mapPeriodes(active.periodes));
      }
    } catch {
      toast.error('Impossible de charger les années');
    }
    setLoading(false);
  }, [get]);

  useEffect(() => { fetchAnnees(); }, [fetchAnnees]);

  useEffect(() => {
    (async () => {
      try {
        const res = await get('/api/calendrier/alertes?jours=14', { silent: true });
        setAlertes(res?.data || []);
      } catch {
        setAlertes([]);
      }
    })();
  }, [get]);

  const selectAnnee = (annee) => {
    setSelected(annee);
    setPeriodes(mapPeriodes(annee.periodes));
  };

  const coherence = useMemo(() => {
    const issues = [];
    if (!selected) return issues;
    const anneeDebut = sliceDate(selected.dateDebut);
    const anneeFin = sliceDate(selected.dateFin);
    const filled = periodes.filter((p) => p.dateDebut && p.dateFin && p.libelle);

    for (const p of filled) {
      if (p.dateDebut >= p.dateFin) {
        issues.push(`« ${p.libelle} » : début ≥ fin`);
      }
      if (anneeDebut && (p.dateDebut < anneeDebut || p.dateFin > anneeFin)) {
        issues.push(`« ${p.libelle} » hors de l'année (${anneeDebut} → ${anneeFin})`);
      }
      if (p.dateEvaluationDebut && (p.dateEvaluationDebut < p.dateDebut || p.dateEvaluationDebut > p.dateFin)) {
        issues.push(`« ${p.libelle} » : éval. début hors période`);
      }
      if (p.dateEvaluationFin && (p.dateEvaluationFin < p.dateDebut || p.dateEvaluationFin > p.dateFin)) {
        issues.push(`« ${p.libelle} » : éval. fin hors période`);
      }
      if (p.dateEvaluationDebut && p.dateEvaluationFin && p.dateEvaluationDebut > p.dateEvaluationFin) {
        issues.push(`« ${p.libelle} » : fenêtre d'évaluation incohérente`);
      }
    }

    const sorted = [...filled].sort((a, b) => a.dateDebut.localeCompare(b.dateDebut));
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i].dateDebut <= sorted[i - 1].dateFin) {
        issues.push(`Chevauchement : « ${sorted[i - 1].libelle} » et « ${sorted[i].libelle} »`);
      } else {
        const prevEnd = parseLocal(sorted[i - 1].dateFin);
        const nextStart = parseLocal(sorted[i].dateDebut);
        const gapDays = Math.round((nextStart - prevEnd) / (24 * 60 * 60 * 1000));
        if (gapDays > 1) {
          issues.push(`Trou de ${gapDays - 1} j entre « ${sorted[i - 1].libelle} » et « ${sorted[i].libelle} »`);
        }
      }
    }
    return issues;
  }, [periodes, selected]);

  const etatAnnee = useMemo(() => {
    if (!selected) return null;
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const filled = periodes.filter((p) => p.dateDebut && p.dateFin);
    let ecoulees = 0;
    let enCours = 0;
    let aVenir = 0;
    for (const p of filled) {
      const d = parseLocal(p.dateDebut);
      const f = parseLocal(p.dateFin);
      if (f < today) ecoulees += 1;
      else if (d <= today && f >= today) enCours += 1;
      else aVenir += 1;
    }
    const manques = [];
    if (!filled.length) manques.push('Aucune période datée');
    if (filled.some((p) => !p.dateEvaluationDebut)) manques.push('Dates d\'évaluation manquantes');
    return {
      effectif: selected._count?.inscriptions ?? 0,
      classes: selected._count?.classes ?? 0,
      ecoulees,
      enCours,
      aVenir,
      manques,
    };
  }, [selected, periodes]);

  const friseItems = useMemo(() => {
    if (!selected) return [];
    const anneeDebut = parseLocal(sliceDate(selected.dateDebut));
    const anneeFin = parseLocal(sliceDate(selected.dateFin));
    if (!anneeDebut || !anneeFin || anneeFin <= anneeDebut) return [];
    const span = anneeFin - anneeDebut;
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    return periodes
      .filter((p) => p.dateDebut && p.dateFin)
      .map((p) => {
        const d = parseLocal(p.dateDebut);
        const f = parseLocal(p.dateFin);
        const left = Math.max(0, ((d - anneeDebut) / span) * 100);
        const width = Math.max(2, ((f - d) / span) * 100);
        const enCours = d <= today && f >= today;
        return { ...p, left, width, enCours };
      });
  }, [periodes, selected]);

  const savePeriodes = async () => {
    if (!selected || !canEditContent) return;
    if (coherence.some((i) => !i.startsWith('Trou'))) {
      toast.error('Corrigez les incohérences avant d\'enregistrer');
      return;
    }
    setSaving(true);
    try {
      const payload = periodes
        .filter((p) => p.dateDebut && p.dateFin && p.libelle)
        .map((p) => ({
          id: p.id,
          index: p.index,
          libelle: p.libelle,
          dateDebut: p.dateDebut,
          dateFin: p.dateFin,
          dateEvaluationDebut: p.dateEvaluationDebut || null,
          dateEvaluationFin: p.dateEvaluationFin || null,
          poids: p.poids,
          concerneCycles: Array.isArray(p.concerneCycles) && p.concerneCycles.length ? p.concerneCycles : null,
        }));
      await post('/api/referentiel/periodes/batch', {
        anneeScolaireId: selected.id,
        periodes: payload,
      });
      toast.success('Périodes enregistrées');
      fetchAnnees();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  const toggleCycle = (idx, cycle) => {
    const next = [...periodes];
    const p = next[idx];
    const set = new Set(p.concerneCycles || []);
    if (set.has(cycle)) set.delete(cycle);
    else set.add(cycle);
    next[idx] = { ...p, concerneCycles: [...set] };
    setPeriodes(next);
  };

  const addPeriode = () => {
    const maxIdx = periodes.reduce((m, p) => Math.max(m, Number(p.index) || 0), 0);
    setPeriodes([...periodes, emptyPeriode(maxIdx + 1)]);
  };

  const removePeriode = async (idx) => {
    const p = periodes[idx];
    if (p.id) {
      try {
        await del(`/api/referentiel/periodes/${p.id}`);
        toast.success('Période supprimée');
      } catch (err) {
        toast.error(err.response?.data?.error || 'Suppression impossible');
        return;
      }
    }
    setPeriodes(periodes.filter((_, i) => i !== idx));
  };

  const genererMensuelles = () => {
    if (!selected) return;
    const debut = parseLocal(sliceDate(selected.dateDebut));
    const fin = parseLocal(sliceDate(selected.dateFin));
    if (!debut || !fin) return;

    const generated = [];
    let idx = 10;
    const cursor = new Date(debut.getFullYear(), debut.getMonth(), 1);
    while (cursor <= fin) {
      const monthStart = new Date(Math.max(cursor.getTime(), debut.getTime()));
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const end = new Date(Math.min(monthEnd.getTime(), fin.getTime()));
      if (monthStart <= end) {
        const evalDebut = new Date(end);
        evalDebut.setDate(Math.max(1, end.getDate() - 5));
        generated.push({
          index: idx,
          libelle: `Composition ${MONTH_NAMES[cursor.getMonth()]}`,
          dateDebut: sliceDate(monthStart.toISOString()),
          dateFin: sliceDate(end.toISOString()),
          dateEvaluationDebut: sliceDate(evalDebut.toISOString()),
          dateEvaluationFin: sliceDate(end.toISOString()),
          poids: 1,
          concerneCycles: ['prescolaire', 'primaire'],
        });
        idx += 1;
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const keep = periodes.filter((p) => Number(p.index) < 10 && p.dateDebut);
    setPeriodes([...keep, ...generated]);
    toast.success(`${generated.length} compositions mensuelles générées`);
  };

  const handleCreate = async () => {
    try {
      await post('/api/annees-scolaires', form);
      setCreateOpen(false);
      setForm({ libelle: '', dateDebut: '', dateFin: '', referentielVersionId: '' });
      toast.success('Année créée');
      fetchAnnees();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Création impossible');
    }
  };

  const activate = async (id) => {
    const ok = window.confirm(
      'Activer cette année ? L\'année actuellement active sera archivée.'
    );
    if (!ok) return;
    try {
      await put(`/api/annees-scolaires/${id}/activate`, {});
      toast.success('Année activée');
      fetchAnnees();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Activation impossible');
    }
  };

  const dupliquer = async (id) => {
    try {
      const res = await post(`/api/annees-scolaires/${id}/dupliquer`, {});
      const annee = res?.annee || res;
      const stats = res?.stats;
      const libelle = annee?.libelle || '';
      if (stats) {
        toast.success(
          `${libelle} créée — ${stats.classes || 0} classe(s), ${stats.affectations || 0} affectation(s), ${stats.creneaux || 0} créneau(x). Pensez à l'activer.`,
          { duration: 6000 }
        );
      } else {
        toast.success(`Année ${libelle} créée — pensez à l'activer`);
      }
      fetchAnnees();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Duplication impossible');
    }
  };

  const openEditDates = () => {
    if (!selected) return;
    setEditDatesForm({
      libelle: selected.libelle || '',
      dateDebut: sliceDate(selected.dateDebut),
      dateFin: sliceDate(selected.dateFin),
    });
    setEditDatesOpen(true);
  };

  const handleEditDates = async () => {
    if (!selected) return;
    try {
      await put(`/api/annees-scolaires/${selected.id}`, {
        libelle: editDatesForm.libelle,
        dateDebut: editDatesForm.dateDebut,
        dateFin: editDatesForm.dateFin,
      });
      toast.success('Dates mises à jour');
      setEditDatesOpen(false);
      fetchAnnees();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Modification impossible');
    }
  };

  const blockingIssues = coherence.filter((i) => !i.startsWith('Trou'));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Années scolaires & périodes"
        subtitle="Cadre temporel de l'établissement — trimestres, compositions et frise de l'année"
        actions={canWrite ? <Button icon={Plus} onClick={() => setCreateOpen(true)}>Nouvelle année</Button> : null}
      />

      {alertes.length > 0 && (
        <div
          className="rounded-lg px-4 py-3 space-y-1"
          style={{ background: 'color-mix(in srgb, var(--color-warning) 12%, transparent)', border: '1px solid var(--color-warning)' }}
        >
          {alertes.map((a) => (
            <div key={a.id} className="flex items-start gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
              <span style={{ color: 'var(--text-primary)' }}>{a.message}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1 p-4 space-y-2">
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Années</h3>
          {loading ? <p style={{ color: 'var(--text-muted)' }}>Chargement…</p> : annees.map((a) => (
            <div key={a.id} className="space-y-1">
              <button
                type="button"
                onClick={() => selectAnnee(a)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm"
                style={{
                  background: selected?.id === a.id ? 'var(--color-primary)' : 'var(--surface-overlay)',
                  color: selected?.id === a.id ? '#fff' : 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span>{a.libelle}</span>
                  {(() => {
                    const st = getAnneeStatut(a);
                    return (
                      <Badge variant={STATUT_VARIANT[st] || 'neutral'}>
                        {STATUT_LABEL[st] || st}
                      </Badge>
                    );
                  })()}
                </div>
                {a.referentielVersion && (
                  <p className="text-xs opacity-80 mt-0.5">{a.referentielVersion.libelle}</p>
                )}
                <p className="text-xs opacity-70 mt-0.5">
                  {new Date(a.dateDebut).toLocaleDateString('fr-FR')} → {new Date(a.dateFin).toLocaleDateString('fr-FR')}
                </p>
              </button>
              {canWrite && selected?.id === a.id && (
                <div className="flex gap-1 px-1">
                  <Button size="sm" variant="secondary" icon={Copy} onClick={() => dupliquer(a.id)}>
                    Dupliquer
                  </Button>
                </div>
              )}
            </div>
          ))}
        </Card>

        <Card className="lg:col-span-2 p-4 space-y-4">
          {!selected ? (
            <p style={{ color: 'var(--text-muted)' }}>Sélectionnez une année</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                    <CalendarRange className="inline h-4 w-4 mr-1" />
                    Périodes — {selected.libelle}
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Trimestres (collège/lycée) et compositions mensuelles (préscolaire/primaire)
                  </p>
                </div>
                {canWrite && (
                  <div className="flex gap-2 flex-wrap">
                    {canEditDates && (
                      <Button variant="secondary" icon={Pencil} onClick={() => openEditDates(selected)}>
                        Modifier dates
                      </Button>
                    )}
                    {canEditContent && selectedStatut !== 'active' && (
                      <Button variant="secondary" onClick={() => activate(selected.id)}>Activer</Button>
                    )}
                    {canEditContent && (
                      <>
                        <Button variant="secondary" onClick={genererMensuelles}>Compositions mensuelles</Button>
                        <Button icon={Plus} variant="secondary" onClick={addPeriode}>Ajouter</Button>
                        <Button icon={Save} onClick={savePeriodes} disabled={saving || blockingIssues.length > 0}>
                          Enregistrer
                        </Button>
                      </>
                    )}
                  </div>
                )}
                {isArchivee && !isDirecteur && (
                  <p className="text-xs w-full" style={{ color: 'var(--text-muted)' }}>
                    Année archivée — modification réservée au directeur.
                  </p>
                )}
              </div>

              {etatAnnee && (
                <div
                  className="rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm"
                  style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}
                >
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Inscrits</p>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{etatAnnee.effectif}</p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Périodes</p>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {etatAnnee.ecoulees} écoulée(s) · {etatAnnee.enCours} en cours · {etatAnnee.aVenir} à venir
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>À configurer</p>
                    {etatAnnee.manques.length === 0 ? (
                      <p className="flex items-center gap-1 text-sm" style={{ color: 'var(--color-success)' }}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Complet
                      </p>
                    ) : (
                      <p className="text-sm" style={{ color: 'var(--color-warning)' }}>{etatAnnee.manques.join(' · ')}</p>
                    )}
                  </div>
                </div>
              )}

              {friseItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Frise de l'année</p>
                  <div className="relative h-10 rounded-md overflow-hidden" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}>
                    {friseItems.map((item) => (
                      <div
                        key={item.id || item.index}
                        title={`${item.libelle} (${item.dateDebut} → ${item.dateFin})`}
                        className="absolute top-1 bottom-1 rounded text-[10px] px-1 overflow-hidden whitespace-nowrap"
                        style={{
                          left: `${item.left}%`,
                          width: `${item.width}%`,
                          background: item.enCours ? 'var(--color-primary)' : 'var(--color-success)',
                          color: '#fff',
                          opacity: item.enCours ? 1 : 0.75,
                        }}
                      >
                        {item.libelle}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {coherence.length > 0 && (
                <div className="rounded-lg px-3 py-2 space-y-1" style={{ border: '1px solid var(--color-warning)' }}>
                  {coherence.map((msg) => (
                    <p key={msg} className="text-xs flex items-start gap-1.5" style={{ color: 'var(--text-primary)' }}>
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
                      {msg}
                    </p>
                  ))}
                </div>
              )}

              {periodes.map((p, idx) => (
                <div key={p.id || `new-${p.index}-${idx}`} className="rounded-lg p-3 space-y-2" style={{ border: '1px solid var(--border-subtle)' }}>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Libellé</label>
                      <input
                        style={inputStyle}
                        value={p.libelle}
                        disabled={!canEditContent}
                        onChange={(e) => {
                          const next = [...periodes];
                          next[idx] = { ...p, libelle: e.target.value };
                          setPeriodes(next);
                        }}
                      />
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Index</label>
                        <input
                          style={inputStyle}
                          type="number"
                          value={p.index}
                          disabled={!canEditContent || !!p.id}
                          onChange={(e) => {
                            const next = [...periodes];
                            next[idx] = { ...p, index: parseInt(e.target.value, 10) || p.index };
                            setPeriodes(next);
                          }}
                        />
                      </div>
                      {canEditContent && (
                        <button
                          type="button"
                          onClick={() => removePeriode(idx)}
                          className="p-2 rounded-md hover:bg-[var(--surface-hover)]"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" style={{ color: 'var(--color-danger)' }} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      ['dateDebut', 'Début'],
                      ['dateFin', 'Fin'],
                      ['dateEvaluationDebut', 'Éval. début'],
                      ['dateEvaluationFin', 'Éval. fin'],
                    ].map(([key, label]) => (
                      <div key={key}>
                        <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                        <input
                          type="date"
                          style={inputStyle}
                          min={sliceDate(selected.dateDebut)}
                          max={sliceDate(selected.dateFin)}
                          value={p[key] || ''}
                          disabled={!canEditContent}
                          onChange={(e) => {
                            const next = [...periodes];
                            next[idx] = { ...p, [key]: e.target.value };
                            setPeriodes(next);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                      Cycles concernés <span style={{ color: 'var(--text-muted)' }}>(vide = tous)</span>
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {CYCLES_OPTS.map((c) => (
                        <label key={c.value} className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                          <input
                            type="checkbox"
                            disabled={!canEditContent}
                            checked={(p.concerneCycles || []).includes(c.value)}
                            onChange={() => toggleCycle(idx, c.value)}
                          />
                          {c.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </Card>
      </div>

      <Modal
        open={editDatesOpen}
        onClose={() => setEditDatesOpen(false)}
        title="Modifier les dates"
        subtitle={selected?.libelle}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditDatesOpen(false)}>Annuler</Button>
            <Button
              onClick={handleEditDates}
              disabled={!editDatesForm.libelle || !editDatesForm.dateDebut || !editDatesForm.dateFin}
            >
              Enregistrer
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Libellé</label>
            <input
              style={inputStyle}
              value={editDatesForm.libelle}
              onChange={(e) => setEditDatesForm({ ...editDatesForm, libelle: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Début</label>
              <input
                type="date"
                style={inputStyle}
                value={editDatesForm.dateDebut}
                onChange={(e) => setEditDatesForm({ ...editDatesForm, dateDebut: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Fin</label>
              <input
                type="date"
                style={inputStyle}
                value={editDatesForm.dateFin}
                onChange={(e) => setEditDatesForm({ ...editDatesForm, dateFin: e.target.value })}
              />
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nouvelle année scolaire"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={!form.libelle || !form.dateDebut || !form.dateFin}>Créer</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Libellé</label>
            <input style={inputStyle} placeholder="2026-2027" value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Début (rentrée)</label>
              <input type="date" style={inputStyle} value={form.dateDebut} onChange={(e) => setForm({ ...form, dateDebut: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Fin</label>
              <input type="date" style={inputStyle} value={form.dateFin} onChange={(e) => setForm({ ...form, dateFin: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Version du référentiel</label>
            <select
              style={{ ...inputStyle, appearance: 'auto' }}
              value={form.referentielVersionId}
              onChange={(e) => setForm({ ...form, referentielVersionId: e.target.value })}
            >
              <option value="">Version active par défaut</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.libelle} ({v.code}){v.actif ? ' — actif' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AnneesScolaires;
