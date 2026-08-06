import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { PageHeader, Button, Modal, Badge } from '../../components/ui';
import { CalendarDays, Plus, AlertCircle } from 'lucide-react';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
const HEURES = Array.from({ length: 12 }, (_, i) => i + 7); // 7h → 18h

const EmploiDuTemps = () => {
  const { get, post, delete: del } = useAxios();
  const [classes, setClasses] = useState([]);
  const [selectedClasse, setSelectedClasse] = useState('');
  const [creneaux, setCreneaux] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [matieres, setMatieres] = useState([]);
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({ jourSemaine: 1, heureDebut: '08:00', heureFin: '10:00', matiereId: '', enseignantId: '', salle: '' });
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await get('/api/classes', { silent: true });
        const data = res?.data || res || [];
        setClasses(data);
        if (data.length > 0) setSelectedClasse(data[0].id);
      } catch { /* silent */ }
    })();
  }, []);

  const fetchCreneaux = useCallback(async () => {
    if (!selectedClasse) return;
    setLoading(true);
    try {
      const res = await get(`/api/emplois-du-temps?classeId=${selectedClasse}`);
      setCreneaux(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [selectedClasse]);

  useEffect(() => { fetchCreneaux(); }, [fetchCreneaux]);

  const openCreate = async () => {
    try {
      const [m, s] = await Promise.all([
        get('/api/matieres', { silent: true }),
        get('/api/staff?role=enseignant', { silent: true }),
      ]);
      setMatieres(m?.data || m || []);
      setStaff(s?.data || s || []);
    } catch { /* silent */ }
    setCreateOpen(true);
  };

  const checkConflict = (jour, hd, hf, enseignantId) => {
    return creneaux.some((c) =>
      c.jourSemaine === jour &&
      c.enseignantId === enseignantId &&
      !(hf <= c.heureDebut || hd >= c.heureFin)
    );
  };

  const handleCreate = async () => {
    const jour = parseInt(form.jourSemaine);
    const hasConflict = checkConflict(jour, form.heureDebut, form.heureFin, form.enseignantId);
    setConflict(hasConflict);
    if (hasConflict) return;
    try {
      await post('/api/emplois-du-temps', { ...form, classeId: selectedClasse, jourSemaine: jour });
      setCreateOpen(false);
      setForm({ jourSemaine: 1, heureDebut: '08:00', heureFin: '10:00', matiereId: '', enseignantId: '', salle: '' });
      fetchCreneaux();
    } catch { /* silent */ }
  };

  const handleDelete = async (creneauId) => {
    try {
      await del(`/api/emplois-du-temps/${creneauId}`);
      fetchCreneaux();
    } catch { /* silent */ }
  };

  const getCreneau = (jour, heure) => {
    return creneaux.find((c) => {
      if (c.jourSemaine !== jour) return false;
      const cDebut = parseInt(c.heureDebut.split(':')[0]);
      const cFin = parseInt(c.heureFin.split(':')[0]);
      return heure >= cDebut && heure < cFin;
    });
  };

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

  const cellStyle = {
    borderBottom: '1px solid var(--border-subtle)',
    borderRight: '1px solid var(--border-subtle)',
    minHeight: 48,
    padding: 4,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Emploi du temps"
        subtitle="Grille hebdomadaire interactive"
        actions={
          <div className="flex items-center gap-2">
            <select style={{ ...inputStyle, width: 200 }} value={selectedClasse} onChange={(e) => setSelectedClasse(e.target.value)}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
            <Button icon={Plus} onClick={openCreate} disabled={!selectedClasse}>Ajouter créneau</Button>
          </div>
        }
      />

      <div className="overflow-x-auto rounded-lg" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-subtle)' }}>
              <th className="text-left py-3 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', width: 60 }}>Heure</th>
              {JOURS.map((jour, i) => (
                <th key={jour} className="text-center py-3 px-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', ...i < JOURS.length - 1 && { borderRight: '1px solid var(--border-subtle)' } }}>
                  {jour}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HEURES.map((heure) => (
              <tr key={heure}>
                <td className="text-center text-xs font-medium py-2" style={{ color: 'var(--text-muted)', ...cellStyle }}>
                  {heure.toString().padStart(2, '0')}:00
                </td>
                {JOURS.map((_, jourIndex) => {
                  const jourNum = jourIndex + 1;
                  const creneau = getCreneau(jourNum, heure);
                  const isStart = creneau && parseInt(creneau.heureDebut.split(':')[0]) === heure;
                  return (
                    <td key={jourIndex} style={cellStyle}>
                      {creneau && isStart ? (
                        <div
                          className="rounded-lg p-2 text-xs cursor-pointer group"
                          style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)' }}
                          onClick={() => handleDelete(creneau.id)}
                        >
                          <p className="font-semibold" style={{ color: 'var(--color-primary)' }}>{creneau.matiereNom}</p>
                          <p style={{ color: 'var(--text-secondary)' }}>{creneau.enseignantNom}</p>
                          {creneau.salle && <p style={{ color: 'var(--text-muted)' }}>Salle {creneau.salle}</p>}
                          <p className="text-[10px] mt-1 opacity-0 group-hover:opacity-100" style={{ color: 'var(--color-danger)' }}>Cliquer pour supprimer</p>
                        </div>
                      ) : creneau ? (
                        <div style={{ background: 'color-mix(in srgb, var(--color-primary) 6%, transparent)', height: '100%', minHeight: 44 }} />
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setConflict(false); }}
        title="Ajouter un créneau"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setCreateOpen(false); setConflict(false); }}>Annuler</Button>
            <Button onClick={handleCreate}>Ajouter</Button>
          </>
        }
      >
        <div className="space-y-4">
          {conflict && (
            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)' }}>
              <AlertCircle className="h-4 w-4" style={{ color: 'var(--color-danger)' }} />
              <span className="text-sm" style={{ color: 'var(--color-danger)' }}>Conflit détecté : cet enseignant a déjà un cours à ce créneau</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Jour</label>
              <select style={inputStyle} value={form.jourSemaine} onChange={(e) => setForm({ ...form, jourSemaine: e.target.value })}>
                {JOURS.map((j, i) => <option key={i} value={i + 1}>{j}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Salle</label>
              <input style={inputStyle} value={form.salle} onChange={(e) => setForm({ ...form, salle: e.target.value })} placeholder="ex: A12" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Heure début</label>
              <input type="time" style={inputStyle} value={form.heureDebut} onChange={(e) => setForm({ ...form, heureDebut: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Heure fin</label>
              <input type="time" style={inputStyle} value={form.heureFin} onChange={(e) => setForm({ ...form, heureFin: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Matière</label>
            <select style={inputStyle} value={form.matiereId} onChange={(e) => setForm({ ...form, matiereId: e.target.value })}>
              <option value="">Sélectionner</option>
              {matieres.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Enseignant</label>
            <select style={inputStyle} value={form.enseignantId} onChange={(e) => setForm({ ...form, enseignantId: e.target.value })}>
              <option value="">Sélectionner</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.prenom} {s.nom}</option>)}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default EmploiDuTemps;
