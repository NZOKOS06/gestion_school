import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { PageHeader, DataTable, Badge, Button, Modal, Card } from '../../components/ui';
import { Award, Plus, Eye, FileDown } from 'lucide-react';

const TYPE_LABEL = {
  scolarite: 'Certificat de scolarité',
  inscription: 'Certificat d\'inscription',
  fin_etudes: 'Certificat de fin d\'études',
  autre: 'Autre',
};

const Certificats = () => {
  const { get, post } = useAxios();
  const [certificats, setCertificats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [eleves, setEleves] = useState([]);
  const [annees, setAnnees] = useState([]);
  const [form, setForm] = useState({ eleveId: '', type: 'scolarite', anneeScolaireId: '' });
  const [preview, setPreview] = useState(null);

  const fetchCertificats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get('/api/certificats');
      setCertificats(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCertificats(); }, [fetchCertificats]);

  const openCreate = async () => {
    try {
      const [el, an] = await Promise.all([
        get('/api/eleves', { silent: true }),
        get('/api/annees-scolaires', { silent: true }),
      ]);
      setEleves(el?.data || el || []);
      setAnnees(an?.data || an || []);
      const active = (an?.data || an || []).find((a) => a.actif);
      if (active) setForm((f) => ({ ...f, anneeScolaireId: active.id }));
    } catch { /* silent */ }
    setCreateOpen(true);
  };

  const handlePreview = async () => {
    try {
      const res = await get(`/api/certificats/preview?eleveId=${form.eleveId}&type=${form.type}&anneeScolaireId=${form.anneeScolaireId}`, { silent: true });
      setPreview(res);
    } catch { /* silent */ }
  };

  const handleGenerate = async () => {
    try {
      await post('/api/certificats', form);
      setCreateOpen(false);
      setForm({ eleveId: '', type: 'scolarite', anneeScolaireId: '' });
      setPreview(null);
      fetchCertificats();
    } catch { /* silent */ }
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificats"
        subtitle="Génération de certificats officiels"
        actions={<Button icon={Plus} onClick={openCreate}>Générer un certificat</Button>}
      />

      <DataTable
        columns={[
          {
            key: 'numeroSerie',
            label: 'N° Série',
            render: (v) => <span className="font-mono text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>{v}</span>,
          },
          {
            key: 'eleve',
            label: 'Élève',
            render: (_, row) => (
              <div>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {row.elevePrenom || row.eleve?.prenom} {row.eleveNom || row.eleve?.nom}
                </p>
                <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{row.eleveMatricule || row.eleve?.matricule}</p>
              </div>
            ),
          },
          {
            key: 'type',
            label: 'Type',
            render: (v) => <Badge variant="info">{TYPE_LABEL[v] || v}</Badge>,
          },
          {
            key: 'dateDelivrance',
            label: 'Date',
            render: (v) => <span style={{ color: 'var(--text-muted)' }}>{new Date(v).toLocaleDateString('fr-FR')}</span>,
          },
          {
            key: 'actions',
            label: 'PDF',
            render: (_, row) => row.pdfUrl ? (
              <a href={row.pdfUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md hover:bg-[var(--surface-hover)] inline-flex">
                <FileDown className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
              </a>
            ) : <span style={{ color: 'var(--text-muted)' }}>—</span>,
          },
        ]}
        data={certificats}
        loading={loading}
        emptyMessage="Aucun certificat délivré"
      />

      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setPreview(null); }}
        title="Générer un certificat"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setCreateOpen(false); setPreview(null); }}>Annuler</Button>
            <Button icon={Eye} variant="secondary" onClick={handlePreview} disabled={!form.eleveId}>Prévisualiser</Button>
            <Button icon={Award} onClick={handleGenerate} disabled={!form.eleveId}>Générer PDF</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Élève</label>
            <select style={inputStyle} value={form.eleveId} onChange={(e) => setForm({ ...form, eleveId: e.target.value })}>
              <option value="">Sélectionner</option>
              {eleves.map((el) => <option key={el.id} value={el.id}>{el.prenom} {el.nom} ({el.matricule})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Type de certificat</label>
            <select style={inputStyle} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Année scolaire</label>
            <select style={inputStyle} value={form.anneeScolaireId} onChange={(e) => setForm({ ...form, anneeScolaireId: e.target.value })}>
              <option value="">Sélectionner</option>
              {annees.map((a) => <option key={a.id} value={a.id}>{a.libelle}{a.actif ? ' (active)' : ''}</option>)}
            </select>
          </div>
          {preview && (
            <Card title="Aperçu">
              <div className="space-y-2 text-sm">
                <p style={{ color: 'var(--text-primary)' }}><strong>{preview.titre}</strong></p>
                <p style={{ color: 'var(--text-secondary)' }}>Élève: {preview.eleveNom}</p>
                <p style={{ color: 'var(--text-secondary)' }}>Matricule: {preview.eleveMatricule}</p>
                <p style={{ color: 'var(--text-secondary)' }}>N° Série: {preview.numeroSerie}</p>
                <p style={{ color: 'var(--text-muted)' }}>{preview.contenu}</p>
              </div>
            </Card>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Certificats;
