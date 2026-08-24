import { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { useDebounce } from '../../hooks/useDebounce';
import {
  PageHeader, DataTable, Badge, Button, Modal, Card, Input, Select,
  FormField, FilterBar, SearchInput, KpiCard, KpiGrid, SegmentedControl,
} from '../../components/ui';
import { Wallet, Plus, Printer, Mail, AlertCircle, FileDown, Users } from 'lucide-react';
import { openPdf } from '../../utils/pdf';

const MODE_PAIEMENT = ['especes', 'mobile_money', 'carte', 'cheque', 'virement'];
const MODE_LABELS = {
  especes: 'Espèces',
  'espèces': 'Espèces',
  mobile_money: 'Mobile Money',
  carte: 'Carte',
  cheque: 'Chèque',
  'chèque': 'Chèque',
  virement: 'Virement',
};

const Paiements = () => {
  const { get, post } = useAxios();
  const { formatPrice } = useTenant();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isCaissier = pathname.startsWith('/caissier');

  const [paiements, setPaiements] = useState([]);
  const [retards, setRetards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [filters, setFilters] = useState({ type: '', mode: '', dateDebut: '', dateFin: '' });
  const [encaisserOpen, setEncaisserOpen] = useState(false);
  const [inscriptions, setInscriptions] = useState([]);
  const [echeances, setEcheances] = useState([]);
  const [form, setForm] = useState({
    inscriptionId: '', echeanceId: '', montant: '', modePaiement: 'especes', reference: '', motif: '',
  });
  const [annees, setAnnees] = useState([]);
  const [yearScope, setYearScope] = useState('active');

  const anneeActive = useMemo(
    () => annees.find((a) => a.actif || a.statut === 'active'),
    [annees],
  );
  const anneePrev = useMemo(
    () => annees
      .filter((a) => a.statut === 'archivee' || (!a.actif && a.id !== anneeActive?.id))
      .sort((a, b) => new Date(b.dateFin || 0) - new Date(a.dateFin || 0))[0],
    [annees, anneeActive],
  );
  const resolvedAnneeId = yearScope === 'archive' ? anneePrev?.id : anneeActive?.id;
  const isArchiveView = yearScope === 'archive';
  const yearOptions = useMemo(() => {
    const opts = [{ value: 'active', label: anneeActive?.libelle || 'Année en cours' }];
    if (anneePrev) opts.push({ value: 'archive', label: anneePrev.libelle || 'Année précédente' });
    return opts;
  }, [anneeActive, anneePrev]);

  useEffect(() => {
    (async () => {
      try {
        const res = await get('/api/annees-scolaires', { silent: true });
        setAnnees(res?.data || res || []);
      } catch { /* silent */ }
    })();
  }, [get]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (filters.type) params.set('type', filters.type);
    if (filters.mode) params.set('modePaiement', filters.mode);
    if (filters.dateDebut) params.set('dateDebut', filters.dateDebut);
    if (filters.dateFin) params.set('dateFin', filters.dateFin);
    if (resolvedAnneeId) params.set('anneeScolaireId', resolvedAnneeId);
    params.set('limit', '200');
    return params.toString();
  }, [debouncedSearch, filters, resolvedAnneeId]);

  const fetchPaiements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get(`/api/paiements?${queryString}`);
      setPaiements(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [get, queryString]);

  const fetchRetards = useCallback(async () => {
    if (isCaissier) return;
    try {
      const qs = resolvedAnneeId ? `?anneeScolaireId=${resolvedAnneeId}` : '';
      const res = await get(`/api/paiements/echeances-retard${qs}`, { silent: true });
      setRetards(res?.data || res || []);
    } catch { /* silent */ }
  }, [get, isCaissier, resolvedAnneeId]);

  useEffect(() => { fetchPaiements(); fetchRetards(); }, [fetchPaiements, fetchRetards]);

  const openEncaisser = async () => {
    if (isCaissier) {
      navigate('/caissier/eleves');
      return;
    }
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
      // Sans échéance ciblée : cascade → reçus partagés (1 par mois / avance)
      const endpoint = form.echeanceId ? '/api/paiements' : '/api/paiements/batch';
      const res = await post(endpoint, payload);
      const recus = res?.recusPartages || (res?.id ? [{ id: res.id, numeroRecu: res.numeroRecu }] : []);
      setEncaisserOpen(false);
      setForm({ inscriptionId: '', echeanceId: '', montant: '', modePaiement: 'especes', reference: '', motif: '' });
      fetchPaiements();
      fetchRetards();
      if (recus.length > 1 && recus[0]?.id) {
        openPdf(`/api/paiements/${recus[0].id}/recu-pdf`, `recu-${recus[0].numeroRecu}.pdf`);
      } else if (recus[0]?.id) {
        openPdf(`/api/paiements/${recus[0].id}/recu-pdf`, `recu-${recus[0].numeroRecu}.pdf`);
      }
    } catch { /* silent */ }
  };

  const relancer = async (echeanceId) => {
    try {
      await post(`/api/paiements/echeances/${echeanceId}/relance`);
    } catch { /* silent */ }
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const totalPeriode = paiements.reduce((s, p) => s + Number(p.montant || 0), 0);
  const totalJour = paiements
    .filter((p) => String(p.datePaiement).slice(0, 10) === todayStr)
    .reduce((s, p) => s + Number(p.montant || 0), 0);

  const selectStyle = { height: 36, width: 160, minWidth: 130, maxWidth: 200, flexShrink: 0 };

  return (
    <div className="space-y-6">
      <PageHeader
        title={isCaissier ? 'Journal de caisse' : 'Paiements & Échéances'}
        subtitle={isCaissier
          ? 'Historique des encaissements — imprimez un reçu ou le journal du jour'
          : 'Encaissements et suivi des impayés'}
        data-testid="page-paiements"
        actions={
          <>
            <Button variant="secondary" icon={FileDown} onClick={() => openPdf(`/api/paiements/journal-pdf?${queryString}`, 'journal-caisse.pdf')}>
              Journal PDF
            </Button>
            {isArchiveView ? (
              <Badge variant="neutral">Lecture seule</Badge>
            ) : (
              <Button icon={isCaissier ? Users : Plus} onClick={openEncaisser}>
                {isCaissier ? 'Encaisser un élève' : 'Encaisser'}
              </Button>
            )}
          </>
        }
      />

      {yearOptions.length > 1 && (
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl value={yearScope} onChange={setYearScope} options={yearOptions} />
          {isArchiveView && <Badge variant="neutral">Consultation archive</Badge>}
        </div>
      )}

      <KpiGrid cols={3}>
        <KpiCard label="Encaissements (filtre)" value={formatPrice(totalPeriode)} icon={Wallet} color="green" />
        <KpiCard label="Nombre" value={String(paiements.length)} icon={Printer} color="primary" />
        <KpiCard label="Caisse du jour" value={formatPrice(totalJour)} icon={Wallet} color="blue" subtitle={new Date().toLocaleDateString('fr-FR')} />
      </KpiGrid>

      {!isCaissier && retards.length > 0 && (
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
                  {!isArchiveView && (
                    <Button size="sm" variant="secondary" icon={Mail} onClick={() => relancer(ret.id)}>Relancer</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <FilterBar>
        <div className="min-w-[200px] w-[240px] shrink-0">
          <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Élève, matricule..." />
        </div>
        <Input type="date" value={filters.dateDebut} onChange={(e) => setFilters({ ...filters, dateDebut: e.target.value })} style={selectStyle} />
        <Input type="date" value={filters.dateFin} onChange={(e) => setFilters({ ...filters, dateFin: e.target.value })} style={selectStyle} />
        <Select fullWidth={false} style={selectStyle} value={filters.mode} onChange={(e) => setFilters({ ...filters, mode: e.target.value })}>
          <option value="">Tous les modes</option>
          {MODE_PAIEMENT.map((m) => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
        </Select>
        <Select fullWidth={false} style={selectStyle} value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
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
        pageSize={15}
        columns={[
          {
            key: 'numeroRecu',
            label: 'Reçu',
            sortable: true,
            secondary: true,
            render: (val) => <span className="font-mono text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>#{val}</span>,
          },
          {
            key: 'eleve',
            label: 'Élève',
            primary: true,
            render: (_, row) => (
              <div>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {row.elevePrenom || row.eleve?.prenom} {row.eleveNom || row.eleve?.nom}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.classeNom || ''}</p>
              </div>
            ),
            mobileRender: (_, row) => `${row.elevePrenom || row.eleve?.prenom || ''} ${row.eleveNom || row.eleve?.nom || ''}`.trim(),
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
            badge: true,
            render: (val) => <Badge variant="info">{MODE_LABELS[val] || val}</Badge>,
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
            actions: true,
            render: (_, row) => (
              <button
                type="button"
                onClick={() => openPdf(`/api/paiements/${row.id}/recu-pdf`, `recu-${row.numeroRecu}.pdf`)}
                className="p-2 rounded-md hover:bg-[var(--surface-hover)] min-h-[40px] min-w-[40px] flex items-center justify-center gap-1.5 text-xs font-medium"
                title="Imprimer reçu"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Printer className="h-4 w-4" />
                <span className="md:hidden">PDF</span>
              </button>
            ),
          },
        ]}
        data={paiements}
        loading={loading}
        emptyMessage="Aucun paiement"
        emptyDescription={isCaissier
          ? 'Les encaissements de la période s’afficheront ici.'
          : 'Les encaissements apparaîtront ici. Cliquez sur Encaisser pour démarrer.'}
        emptyAction={!isCaissier && !isArchiveView && <Button icon={Plus} size="sm" onClick={openEncaisser}>Encaisser</Button>}
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
                setForm({ ...form, echeanceId: e.target.value, montant: ech ? String(ech.montantAttendu - ech.montantPaye) : form.montant });
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
                {MODE_PAIEMENT.map((m) => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
              </Select>
            </FormField>
          </div>
          <FormField label="Référence (optionnel)">
            <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Transaction MoMo, n° chèque..." />
          </FormField>
          <FormField label="Motif (optionnel)">
            <Input value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} placeholder="ex: Scolarité Octobre 2025" />
          </FormField>
        </div>
      </Modal>
    </div>
  );
};

export default Paiements;
