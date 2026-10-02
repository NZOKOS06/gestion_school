import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';
import { useAxios } from '../../hooks/useAxios';
import { DataTable, Button, Badge } from '../../components/ui';

const ROLE_LABELS = {
  directeur: 'Directeur',
  directeur_etudes: 'Directeur des études',
  secretaire: 'Secrétaire',
  comptable: 'Gestionnaire',
  surveillant: 'Surveillant',
};

const toHHMM = (val) => (val ? new Date(val).toTimeString().slice(0, 5) : '');
const toMin = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/**
 * Pointage journalier du personnel hors enseignement (secrétariat, caisse, surveillance…).
 * Horaires attendus : ceux de l'agent, sinon ceux de l'école. Sert aux retenues de paie.
 */
export default function PointageJournalier({ date, inputStyle }) {
  const { get, put } = useAxios();
  const [rows, setRows] = useState([]);
  const [tolerance, setTolerance] = useState(15);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get(`/api/pointage/journalier?date=${date}`, { silent: true });
      setTolerance(res?.toleranceMinutes ?? 15);
      setRows((res?.data || []).map((s) => ({
        ...s,
        saisie: {
          statut: s.pointage?.statut || 'present',
          heureArrivee: toHHMM(s.pointage?.heureArrivee),
          heureDepart: toHHMM(s.pointage?.heureDepart),
          justifie: Boolean(s.pointage?.justifie),
          motif: s.pointage?.motif || '',
        },
        enregistre: Boolean(s.pointage),
      })));
    } catch {
      setRows([]);
    }
    setLoading(false);
  }, [date, get]);

  useEffect(() => { charger(); }, [charger]);

  const maj = (id, patch) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, saisie: { ...r.saisie, ...patch } } : r)));

  const enregistrer = async (row) => {
    setSaving(row.id);
    try {
      await put('/api/pointage/journalier', { staffId: row.id, date, ...row.saisie });
      toast.success(`Pointage de ${row.prenom} ${row.nom} enregistré`);
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, enregistre: true } : r)));
    } catch { /* toast via useAxios */ }
    setSaving(null);
  };

  const retard = (row) => {
    const arrivee = toMin(row.saisie.heureArrivee);
    const prevu = toMin(row.heureArriveePrevue);
    if (row.saisie.statut !== 'present' || arrivee === null || prevu === null) return 0;
    const diff = arrivee - prevu;
    return diff > tolerance ? diff : 0;
  };

  return (
    <DataTable
      loading={loading}
      data={rows}
      emptyMessage="Aucun membre du personnel administratif"
      columns={[
        {
          key: 'agent',
          label: 'Agent',
          render: (_, r) => (
            <div>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{r.prenom} {r.nom}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {ROLE_LABELS[r.role] || r.role} · prévu {r.heureArriveePrevue} – {r.heureDepartPrevue}
              </p>
            </div>
          ),
        },
        {
          key: 'statut',
          label: 'Statut',
          render: (_, r) => (
            <select style={{ ...inputStyle, width: 120 }} value={r.saisie.statut} onChange={(e) => maj(r.id, { statut: e.target.value })}>
              <option value="present">Présent</option>
              <option value="absent">Absent</option>
              <option value="conge">Congé</option>
            </select>
          ),
        },
        {
          key: 'heures',
          label: 'Arrivée / Départ',
          render: (_, r) => (r.saisie.statut === 'present' ? (
            <div className="flex items-center gap-1">
              <input type="time" style={{ ...inputStyle, width: 110 }} value={r.saisie.heureArrivee} onChange={(e) => maj(r.id, { heureArrivee: e.target.value })} />
              <span>→</span>
              <input type="time" style={{ ...inputStyle, width: 110 }} value={r.saisie.heureDepart} onChange={(e) => maj(r.id, { heureDepart: e.target.value })} />
              {retard(r) > 0 && <Badge variant="warning">{retard(r)} min de retard</Badge>}
            </div>
          ) : <span style={{ color: 'var(--text-muted)' }}>—</span>),
        },
        {
          key: 'justif',
          label: 'Justification',
          render: (_, r) => (r.saisie.statut === 'absent' || retard(r) > 0 ? (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs cursor-pointer">
                <input type="checkbox" checked={r.saisie.justifie} onChange={(e) => maj(r.id, { justifie: e.target.checked })} />
                Justifié
              </label>
              <input style={{ ...inputStyle, width: 160 }} placeholder="Motif" value={r.saisie.motif} onChange={(e) => maj(r.id, { motif: e.target.value })} />
            </div>
          ) : <span style={{ color: 'var(--text-muted)' }}>—</span>),
        },
        {
          key: 'actions',
          label: '',
          render: (_, r) => (
            <div className="flex items-center gap-2 justify-end">
              {r.enregistre && <Badge variant="success">Enregistré</Badge>}
              <Button size="sm" icon={Save} loading={saving === r.id} onClick={() => enregistrer(r)}>Enregistrer</Button>
            </div>
          ),
        },
      ]}
    />
  );
}
