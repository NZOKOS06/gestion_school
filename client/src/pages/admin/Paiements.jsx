import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { PageHeader, DataTable, Badge, Button, Modal, Card, Input, Select, FormField, FilterBar } from '../../components/ui';
import { Wallet, Plus, Printer, Mail, AlertCircle } from 'lucide-react';

const MODE_PAIEMENT = ['espèces', 'mobile_money', 'carte', 'chèque', 'virement'];

const Paiements = () => {
  const { get, post } = useAxios();
  const { formatPrice } = useTenant();
  const [paiements, setPaiements] = useState([]);
  const [retards, setRetards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ type: '', classe: '' });
  const [encaisserOpen, setEncaisserOpen] = useState(false);
  const [inscriptions, setInscriptions] = useState([]);
  const [echeances, setEcheances] = useState([]);
  const [form, setForm] = useState({ inscriptionId: '', echeanceId: '', montant: '', modePaiement: 'espèces', reference: '', motif: '' });

  const fetchPaiements = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.type) params.set('type', filters.type);
      const res = await get(`/api/paiements?${params.toString()}`);
      setPaiements(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [filters]);

  const fetchRetards = useCallback(async () => {
    try {
      const res = await get('/api/paiements/echeances-retard', { silent: true });
      setRetards(res?.data || res || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchPaiements(); fetchRetards(); }, [fetchPaiements, fetchRetards]);

  const openEncaisser = async () => {
    try {
      const res = await get('/api/inscriptions', { silent: true });
      setInscriptions(res?.data || res || []);
    } catch { /* silent */ }
    setEncaisserOpen(true);
  };

  const onInscriptionChange = async (inscriptionId) => {
    setForm({ ...form, inscriptionId, echeanceId: '', montant: '' });
    if (!inscriptionId) { setEcheances([]); return; }
    try {
      const res = await get(`/api/paiements/echeances?inscriptionId=${inscriptionId}`, { silent: true });
      setEcheances(res?.data || res || []);
    } catch { setEcheances([]); }
  };

  const handleEncaisser = async () => {
    try {
      const payload = {
        inscriptionId: form.inscriptionId,
        echeanceId: form.echeanceId || undefined,
        montant: parseFloat(form.montant) || 0,
        modePaiement: form.modePaiement,
        reference: form.reference || undefined,
        motif: form.motif || undefined,
      };
      await post('/api/paiements', payload);
      setEncaisserOpen(false);
      setForm({ inscriptionId: '', echeanceId: '', montant: '', modePaiement: 'espèces', reference: '', motif: '' });
      fetchPaiements();
      fetchRetards();
    } catch { /* silent */ }
  };

  const relancer = async (echeanceId) => {
    try {
      await post(`/api/paiements/echeances/${echeanceId}/relance`);
    } catch { /* silent */ }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paiements & Échéances"
        subtitle="Encaissements et suivi des impayés"
        actions={<Button icon={Plus} onClick={openEncaisser}>Encaisser</Button>}
      />

      {retards.length > 0 && (
        <Card title="Échéances en retard" icon={AlertCircle}>
          <div className="space-y-2">
            {retards.slice(0, 5).map((ret) => (
              <div key={ret.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--surface-overlay)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {ret.elevePrenom} {ret.eleveNom}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {ret.libelle} · échéance {new Date(ret.dateEcheance).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold" style={{ color: 'var(--color-danger)' }}>
                    {formatPrice(ret.montantAttendu - ret.montantPaye)}
                  </span>
                  <Button size="sm" variant="secondary" icon={Mail} onClick={() => relancer(ret.id)}>Relancer</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <FilterBar>
        <Select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} style={{ minWidth: 180 }}>
          <option value="">Tous les types</option>
          <option value="inscription">Inscription</option>
          <option value="scolarite">Scolarité</option>
          <option value="mensualite">Mensualité</option>
          <option value="examen_officiel">Examen</option>
          <option value="cantine">Cantine</option>
          <option value="transport">Transport</option>
        </Select>
      </FilterBar>

      <DataTable
        sortable
        pagination
        pageSize={12}
        columns={[
          {
            key: 'numeroRecu',
            label: 'Reçu',
            sortable: true,
            render: (val) => <span className="font-mono text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>#{val}</span>,
          },
          {
            key: 'eleve',
            label: 'Élève',
            render: (_, row) => (
              <div>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {row.elevePrenom || row.eleve?.prenom} {row.eleveNom || row.eleve?.nom}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.classeNom || ''}</p>
              </div>
            ),
          },
          {
            key: 'montant',
            label: 'Montant',
            sortable: true,
            render: (val) => <span className="font-semibold" style={{ color: 'var(--color-success)' }}>{formatPrice(val)}</span>,
          },
          {
            key: 'modePaiement',
            label: 'Mode',
            render: (val) => <Badge variant="info">{val}</Badge>,
          },
          {
            key: 'datePaiement',
            label: 'Date',
            sortable: true,
            render: (val) => <span style={{ color: 'var(--text-muted)' }}>{new Date(val).toLocaleDateString('fr-FR')}</span>,
          },
          {
            key: 'actions',
            label: 'Reçu',
            render: (_, row) => (
              <button type="button" onClick={() => window.open(`/api/paiements/${row.id}/recu-pdf`, '_blank')} className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title="Imprimer reçu">
                <Printer className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
              </button>
            ),
          },
        ]}
        data={paiements}
        loading={loading}
        emptyMessage="Aucun paiement"
        emptyDescription="Les encaissements apparaîtront ici. Cliquez sur Encaisser pour démarrer."
        emptyAction={<Button icon={Plus} size="sm" onClick={openEncaisser}>Encaisser</Button>}
      />

      <Modal
        open={encaisserOpen}
        onClose={() => setEncaisserOpen(false)}
        title="Encaisser un paiement"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEncaisserOpen(false)}>Annuler</Button>
            <Button icon={Wallet} onClick={handleEncaisser} disabled={!form.inscriptionId || !form.montant}>Encaisser</Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Inscription (élève)" required>
            <Select value={form.inscriptionId} onChange={(e) => onInscriptionChange(e.target.value)}>
              <option value="">Sélectionner</option>
              {inscriptions.map((insc) => (
                <option key={insc.id} value={insc.id}>
                  {insc.elevePrenom || insc.eleve?.prenom} {insc.eleveNom || insc.eleve?.nom} — {insc.classeNom || insc.classe?.nom}
                </option>
              ))}
            </Select>
          </FormField>
          {echeances.length > 0 && (
            <FormField label="Échéance (optionnel)">
              <Select value={form.echeanceId} onChange={(e) => {
                const ech = echeances.find((ec) => ec.id === e.target.value);
                setForm({ ...form, echeanceId: e.target.value, montant: ech ? (ech.montantAttendu - ech.montantPaye).toString() : form.montant });
              }}>
                <option value="">Pas d'échéance spécifique</option>
                {echeances.map((ech) => (
                  <option key={ech.id} value={ech.id}>
                    {ech.libelle} — {formatPrice(ech.montantAttendu - ech.montantPaye)} restant
                  </option>
                ))}
              </Select>
            </FormField>
          )}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Montant" required>
              <Input type="number" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} placeholder="0" />
            </FormField>
            <FormField label="Mode de paiement">
              <Select value={form.modePaiement} onChange={(e) => setForm({ ...form, modePaiement: e.target.value })}>
                {MODE_PAIEMENT.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            </FormField>
          </div>
          <FormField label="Référence (optionnel)">
            <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Transaction MoMo, n° chèque..." />
          </FormField>
          <FormField label="Motif (optionnel)">
            <Input value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} placeholder="ex: Scolarité Tranche 1" />
          </FormField>
        </div>
      </Modal>
    </div>
  );
};

export default Paiements;
