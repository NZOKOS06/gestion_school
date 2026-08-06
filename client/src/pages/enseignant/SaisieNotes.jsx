import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { PageHeader, Card, Button, Badge, DataTable, Modal } from '../../components/ui';
import { ClipboardEdit, Save } from 'lucide-react';

const SaisieNotes = () => {
  const { get, post } = useAxios();
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEval, setSelectedEval] = useState(null);
  const [eleves, setEleves] = useState([]);
  const [notes, setNotes] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchEvaluations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get('/api/enseignant/evaluations');
      setEvaluations(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchEvaluations(); }, [fetchEvaluations]);

  const openSaisie = async (evaluation) => {
    setSelectedEval(evaluation);
    try {
      const res = await get(`/api/evaluations/${evaluation.id}/notes`, { silent: true });
      const notesData = res?.data || res || [];
      const notesMap = {};
      notesData.forEach((n) => { notesMap[n.eleveId] = n.valeur?.toString() || ''; });
      setNotes(notesMap);
      setEleves(notesData);
    } catch { setEleves([]); }
  };

  const handleNoteChange = (eleveId, value) => {
    setNotes({ ...notes, [eleveId]: value });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = Object.entries(notes)
        .filter(([_, v]) => v !== '')
        .map(([eleveId, valeur]) => ({ eleveId, valeur: parseFloat(valeur) }));
      await post(`/api/evaluations/${selectedEval.id}/notes`, { notes: payload });
      setSelectedEval(null);
      fetchEvaluations();
    } catch { /* silent */ }
    setSaving(false);
  };

  const inputStyle = {
    width: 80,
    height: 36,
    background: 'var(--surface-overlay)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 14,
    padding: '0 8px',
    textAlign: 'center',
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Saisie des notes" subtitle="Évaluations et saisie des notes par classe" />

      <DataTable
        columns={[
          { key: 'nom', label: 'Évaluation', render: (v) => <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{v}</span> },
          { key: 'matiereNom', label: 'Matière', render: (v) => <Badge variant="info">{v}</Badge> },
          { key: 'classeNom', label: 'Classe', render: (v) => <span style={{ color: 'var(--text-secondary)' }}>{v}</span> },
          { key: 'dateEvaluation', label: 'Date', render: (v) => <span style={{ color: 'var(--text-muted)' }}>{new Date(v).toLocaleDateString('fr-FR')}</span> },
          { key: 'noteMaximale', label: 'Barème', render: (v) => <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>/{v}</span> },
          { key: 'statut', label: 'Statut', render: (v) => <Badge variant={v === 'saisie_terminee' ? 'success' : 'warning'}>{v === 'saisie_terminee' ? 'Terminée' : 'En attente'}</Badge> },
          {
            key: 'actions',
            label: 'Actions',
            render: (_, row) => row.statut !== 'saisie_terminee' ? (
              <Button size="sm" icon={ClipboardEdit} onClick={() => openSaisie(row)}>Saisir</Button>
            ) : <Button size="sm" variant="secondary" onClick={() => openSaisie(row)}>Voir</Button>,
          },
        ]}
        data={evaluations}
        loading={loading}
        emptyMessage="Aucune évaluation"
      />

      <Modal
        open={!!selectedEval}
        onClose={() => setSelectedEval(null)}
        title={selectedEval?.nom || 'Saisie des notes'}
        subtitle={`${selectedEval?.classeNom} · ${selectedEval?.matiereNom} · /${selectedEval?.noteMaximale}`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelectedEval(null)}>Annuler</Button>
            <Button icon={Save} onClick={handleSave} loading={saving}>Enregistrer</Button>
          </>
        }
      >
        <div className="space-y-2">
          {eleves.map((eleve) => (
            <div key={eleve.eleveId} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--surface-overlay)' }}>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}>
                  {eleve.elevePrenom?.[0]}{eleve.eleveNom?.[0]}
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {eleve.elevePrenom} {eleve.eleveNom}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  max={selectedEval?.noteMaximale || 20}
                  style={inputStyle}
                  value={notes[eleve.eleveId] || ''}
                  onChange={(e) => handleNoteChange(eleve.eleveId, e.target.value)}
                  placeholder="—"
                />
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>/{selectedEval?.noteMaximale || 20}</span>
              </div>
            </div>
          ))}
          {eleves.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Aucun élève</p>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default SaisieNotes;
