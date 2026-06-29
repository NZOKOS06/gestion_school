import { useEffect, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { PageHeader, KpiCard, Badge, DocumentUpload } from '../../components/ui';
import {
  FileCheck, FileText, CheckCircle, AlertTriangle, XCircle,
  Plus, X, Eye, Upload, ChevronLeft, ChevronRight,
  Search, Clock, Calendar, Euro, Receipt, Package,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Constantes ───────────────────────────────────────────────────────────────

const STATUT_RAPPROCHEMENT_CONFIG = {
  conforme:       { label: '✓ Conforme',     variant: 'success' },
  ecart_prix:     { label: 'Écart de prix',  variant: 'warning' },
  ecart_quantite: { label: 'Écart quantité', variant: 'warning' },
  litige:         { label: 'Litige',          variant: 'danger'  },
  en_attente:     { label: 'En attente',      variant: 'neutral' },
};

const STATUT_FACTURE_CONFIG = {
  recue:   { label: 'Reçue',    variant: 'info'    },
  validee: { label: 'Validée',  variant: 'success' },
  litige:  { label: 'Litige',   variant: 'danger'  },
  payee:   { label: 'Payée',    variant: 'neutral' },
};

const MODE_PAIEMENT_OPTIONS = [
  { value: 'virement',     label: 'Virement bancaire' },
  { value: 'cheque',       label: 'Chèque'            },
  { value: 'especes',      label: 'Espèces'           },
  { value: 'mobile_money', label: 'Mobile Money'      },
];

const ONGLETS = [
  { key: 'toutes',   label: 'Toutes'    },
  { key: 'recue',    label: 'Reçues'    },
  { key: 'validee',  label: 'Validées'  },
  { key: 'ecart',    label: 'Écarts'    },
  { key: 'litige',   label: 'Litiges'   },
  { key: 'payee',    label: 'Payées'    },
];

function calculerEcartDisplay(ecartMontant, formatPrice) {
  if (!ecartMontant || Math.abs(ecartMontant) < 0.01) return null;
  const prefix = ecartMontant > 0 ? '+' : '';
  return {
    texte: `${prefix}${formatPrice(ecartMontant)}`,
    couleur: ecartMontant > 0 ? '#EF4444' : '#F59E0B',
  };
}

function getStatutRetention(dateRetentionLegale) {
  const joursRestants = Math.floor(
    (new Date(dateRetentionLegale) - Date.now()) / 86400000
  );
  if (joursRestants < 0) return { label: 'Expirée', color: '#EF4444' };
  if (joursRestants < 90) return { label: `${joursRestants}j`, color: '#F59E0B' };
  const annees = Math.floor(joursRestants / 365);
  return { label: `~${annees} an(s)`, color: '#10B981' };
}

// ── Composant principal ──────────────────────────────────────────────────────

const FacturesMgmt = () => {
  const { formatPrice } = useTenant();
  const { get, post, put, loading } = useAxios();
  const [searchParams, setSearchParams] = useSearchParams();

  const [factures, setFactures] = useState([]);
  const [allFactures, setAllFactures] = useState([]);
  const [kpi, setKpi] = useState({ total: 0, conformes: 0, ecarts: 0, litiges: 0 });
  const [ongletActif, setOngletActif] = useState('toutes');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [detailFacture, setDetailFacture] = useState(null);

  const [commandesDispo, setCommandesDispo] = useState([]);
  const [rapprochementResult, setRapprochementResult] = useState(null);

  // Formulaire création
  const [form, setForm] = useState({
    commandeId: '',
    numeroFacture: '',
    dateFacture: '',
    dateEcheance: '',
    montantHT: '',
    tvaPercent: '0',
    fichier: null,
  });

  // Paiement
  const [paiement, setPaiement] = useState({
    modePaiement: 'virement',
    referencePaiement: '',
    datePaiement: new Date().toISOString().split('T')[0],
  });

  // Litige
  const [litigeNote, setLitigeNote] = useState('');

  const limit = 15;

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchKpi = useCallback(async () => {
    try {
      const res = await get('/api/factures/tableau-rapprochement?periode=365j', { silent: true });
      setKpi({
        total: res.total || 0,
        conformes: res.conformes || 0,
        ecarts: res.ecarts || 0,
        litiges: res.litiges || 0,
      });
    } catch (e) { /* silent */ }
  }, [get]);

  const fetchAllFactures = useCallback(async () => {
    try {
      const res = await get('/api/factures?limit=1000', { silent: true });
      setAllFactures(res.data || []);
    } catch (e) { /* silent */ }
  }, [get]);

  const fetchFactures = useCallback(async () => {
    let url = `/api/factures?page=${page}&limit=${limit}`;
    if (ongletActif === 'recue') url += '&statut=recue';
    else if (ongletActif === 'validee') url += '&statut=validee';
    else if (ongletActif === 'litige') url += '&statut=litige';
    else if (ongletActif === 'payee') url += '&statut=payee';
    else if (ongletActif === 'ecart') {
      // Pas de filtre statut direct — on fetch all et filtre côté client
      const res = await get(`/api/factures?limit=1000`, { silent: true });
      const filtered = (res.data || []).filter(
        f => f.statutRapprochement === 'ecart_prix' || f.statutRapprochement === 'ecart_quantite'
      );
      setFactures(filtered);
      setTotalPages(1);
      setTotalItems(filtered.length);
      return;
    }
    try {
      const res = await get(url, { silent: true });
      setFactures(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalItems(res.pagination?.total || 0);
    } catch (e) { /* silent */ }
  }, [get, page, ongletActif]);

  const fetchCommandesDispo = useCallback(async () => {
    try {
      const res = await get('/api/commandes-fournisseurs?limit=1000', { silent: true });
      const cmds = (res.data || []).filter(c => c.statut === 'recue' || c.statut === 'partielle');
      setCommandesDispo(cmds);
    } catch (e) { /* silent */ }
  }, [get]);

  useEffect(() => { fetchKpi(); fetchAllFactures(); }, [fetchKpi, fetchAllFactures]);
  useEffect(() => { fetchFactures(); }, [fetchFactures]);

  // Auto-open create modal if commandeId in URL (from CommandesF "Ajouter facture")
  useEffect(() => {
    const cmdId = searchParams.get('commandeId');
    if (cmdId) {
      fetchCommandesDispo();
      setForm({
        commandeId: cmdId,
        numeroFacture: '',
        dateFacture: '',
        dateEcheance: '',
        montantHT: '',
        tvaPercent: '0',
        fichier: null,
      });
      setRapprochementResult(null);
      setShowCreate(true);
      // Clean URL
      setSearchParams({});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Compteurs par onglet ───────────────────────────────────────────────────

  const counts = useMemo(() => {
    const c = { toutes: 0, recue: 0, validee: 0, ecart: 0, litige: 0, payee: 0 };
    c.toutes = allFactures.length;
    allFactures.forEach(f => {
      if (f.statut === 'recue') c.recue++;
      if (f.statut === 'validee') c.validee++;
      if (f.statut === 'litige') c.litige++;
      if (f.statut === 'payee') c.payee++;
      if (f.statutRapprochement === 'ecart_prix' || f.statutRapprochement === 'ecart_quantite') c.ecart++;
    });
    return c;
  }, [allFactures]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

  const montantTTCcalc = useMemo(() => {
    const ht = parseFloat(form.montantHT) || 0;
    const tva = parseFloat(form.tvaPercent) || 0;
    return ht * (1 + tva / 100);
  }, [form.montantHT, form.tvaPercent]);

  // ── Modals ─────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setForm({
      commandeId: '',
      numeroFacture: '',
      dateFacture: '',
      dateEcheance: '',
      montantHT: '',
      tvaPercent: '0',
      fichier: null,
    });
    setRapprochementResult(null);
    fetchCommandesDispo();
    setShowCreate(true);
  };

  const openCreateWithCommande = (commandeId) => {
    setForm({
      commandeId,
      numeroFacture: '',
      dateFacture: '',
      dateEcheance: '',
      montantHT: '',
      tvaPercent: '0',
      fichier: null,
    });
    setRapprochementResult(null);
    fetchCommandesDispo();
    setShowCreate(true);
  };

  const closeCreate = () => {
    setShowCreate(false);
    setRapprochementResult(null);
  };

  const openDetail = async (facture) => {
    try {
      const res = await get(`/api/factures/${facture.id}`, { silent: true });
      setDetailFacture(res);
      setShowDetail(true);
      setLitigeNote('');
      setPaiement({
        modePaiement: 'virement',
        referencePaiement: '',
        datePaiement: new Date().toISOString().split('T')[0],
      });
    } catch (e) { /* silent */ }
  };

  const closeDetail = () => {
    setShowDetail(false);
    setDetailFacture(null);
    setLitigeNote('');
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const submitFacture = async () => {
    if (!form.commandeId) { toast.error('Sélectionnez une commande'); return; }
    if (!form.numeroFacture) { toast.error('Numéro de facture requis'); return; }
    if (!form.dateFacture) { toast.error('Date de facture requise'); return; }
    if (!form.montantHT || parseFloat(form.montantHT) <= 0) { toast.error('Montant HT requis'); return; }

    const payload = {
      commandeId: form.commandeId,
      numeroFacture: form.numeroFacture,
      dateFacture: form.dateFacture,
      dateEcheance: form.dateEcheance || undefined,
      montantHT: parseFloat(form.montantHT),
      montantTVA: montantTTCcalc - parseFloat(form.montantHT),
      montantTTC: montantTTCcalc,
    };

    try {
      const res = await post('/api/factures', payload);
      setRapprochementResult(res);

      // Upload PDF si fourni
      if (form.fichier && res.id) {
        const fd = new FormData();
        fd.append('fichier', form.fichier);
        try {
          await put(`/api/factures/${res.id}/document`, fd, {
            headers: { 'Content-Type': undefined },
          });
          toast.success('Facture créée avec document PDF');
        } catch (e) {
          toast.error('Facture créée mais upload PDF échoué');
        }
      } else {
        toast.success('Facture créée');
      }

      fetchKpi(); fetchAllFactures(); fetchFactures();
    } catch (e) { /* error toast handled by useAxios */ }
  };

  const validerFacture = async (id) => {
    try {
      await put(`/api/factures/${id}/statut`, { statut: 'validee' });
      toast.success('Facture validée');
      fetchKpi(); fetchAllFactures(); fetchFactures();
      closeDetail();
    } catch (e) { /* silent */ }
  };

  const signalerLitige = async (id) => {
    if (!litigeNote.trim()) { toast.error('Veuillez saisir un motif de litige'); return; }
    try {
      await put(`/api/factures/${id}/statut`, { statut: 'litige', noteRapprochement: litigeNote });
      toast.success('Litige signalé');
      fetchKpi(); fetchAllFactures(); fetchFactures();
      closeDetail();
    } catch (e) { /* silent */ }
  };

  const confirmerPaiement = async (id) => {
    try {
      await put(`/api/factures/${id}/statut`, {
        statut: 'payee',
        modePaiement: paiement.modePaiement,
        referencePaiement: paiement.referencePaiement || undefined,
        datePaiement: paiement.datePaiement,
      });
      toast.success('Paiement enregistré');
      fetchKpi(); fetchAllFactures(); fetchFactures();
      closeDetail();
    } catch (e) { /* silent */ }
  };

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Fichier trop volumineux (10 Mo max)'); return; }
    if (file.type !== 'application/pdf') { toast.error('Format PDF uniquement'); return; }
    setForm(prev => ({ ...prev, fichier: file }));
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderEcart = (ecartMontant) => {
    const ecart = calculerEcartDisplay(ecartMontant, formatPrice);
    if (!ecart) return <span className="text-[var(--text-muted)]">—</span>;
    return <span className="font-medium" style={{ color: ecart.couleur }}>{ecart.texte}</span>;
  };

  const renderRapprochementBadge = (statut) => {
    const cfg = STATUT_RAPPROCHEMENT_CONFIG[statut] || STATUT_RAPPROCHEMENT_CONFIG.en_attente;
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  const renderStatutBadge = (statut) => {
    const cfg = STATUT_FACTURE_CONFIG[statut] || STATUT_FACTURE_CONFIG.recue;
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  // ── Colonnes DataTable ─────────────────────────────────────────────────────

  const columns = [
    { key: 'numeroFacture', label: 'N° Facture', render: (_, row) => (
      <span className="font-mono font-medium text-[var(--text-primary)]">{row.numeroFacture}</span>
    )},
    { key: 'fournisseur', label: 'Fournisseur', render: (_, row) => (
      <span className="text-[var(--text-secondary)]">{row.fournisseur?.nom || '—'}</span>
    )},
    { key: 'commande', label: 'N° Commande', render: (_, row) => (
      <span className="font-mono text-sm text-[var(--text-secondary)]">{row.commande?.numeroCommande || '—'}</span>
    )},
    { key: 'dateFacture', label: 'Date facture', render: (_, row) => (
      <span className="text-[var(--text-secondary)] whitespace-nowrap">{formatDate(row.dateFacture)}</span>
    )},
    { key: 'montantBC', label: 'Montant BC', render: (_, row) => (
      <span className="text-[var(--text-secondary)]">{formatPrice(row.commande?.montantTotal || 0)}</span>
    )},
    { key: 'montantTTC', label: 'Montant Facture', render: (_, row) => (
      <span className="font-medium text-[var(--text-primary)]">{formatPrice(row.montantTTC)}</span>
    )},
    { key: 'ecartMontant', label: 'Écart', render: (_, row) => renderEcart(row.ecartMontant) },
    { key: 'statutRapprochement', label: 'Rapprochement', render: (_, row) => renderRapprochementBadge(row.statutRapprochement) },
    { key: 'statut', label: 'Statut', render: (_, row) => renderStatutBadge(row.statut) },
    { key: 'retention', label: 'Conservation', render: (_, row) => {
      if (!row.dateRetentionLegale) return <span className="text-[var(--text-muted)]">—</span>;
      const r = getStatutRetention(row.dateRetentionLegale);
      const dateStr = formatDate(row.dateRetentionLegale);
      return (
        <span className="font-medium text-xs whitespace-nowrap" style={{ color: r.color }}
          title={`Conformité légale : document à conserver jusqu'au ${dateStr} (obligation légale 3 ans, Congo-Brazzaville)`}>
          {r.label}
        </span>
      );
    }},
    { key: 'actions', label: 'Actions', render: (_, row) => (
      <button onClick={(e) => { e.stopPropagation(); openDetail(row); }}
        className="p-2 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] rounded-lg" title="Voir détail">
        <Eye className="h-4 w-4" />
      </button>
    )},
  ];

  // ── Render: Modal création ─────────────────────────────────────────────────

  const renderCreateModal = () => {
    if (!showCreate) return null;
    const cmd = commandesDispo.find(c => c.id === form.commandeId);

    return createPortal(
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4" onClick={closeCreate}>
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative bg-[var(--surface-raised)] rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mt-10 mb-4" onClick={(e) => e.stopPropagation()}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Ajouter une facture</h2>
              <button onClick={closeCreate} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            {!rapprochementResult ? (
              <div className="space-y-4">
                {/* Commande liée */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Commande liée *</label>
                  <select value={form.commandeId} onChange={e => setForm(prev => ({ ...prev, commandeId: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] bg-[var(--surface-raised)]">
                    <option value="">Sélectionner une commande reçue</option>
                    {commandesDispo.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.numeroCommande} — {c.fournisseur?.nom || '—'} — {formatPrice(c.montantTotal)}
                      </option>
                    ))}
                  </select>
                </div>

                {cmd && (
                  <div className="bg-[var(--surface-hover)] rounded-lg p-3 text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-[var(--text-muted)]">Fournisseur</span>
                      <span className="font-medium text-[var(--text-primary)]">{cmd.fournisseur?.nom}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Montant bon de commande</span>
                      <span className="font-medium" style={{ color: 'var(--color-primary)' }}>{formatPrice(cmd.montantTotal)}</span>
                    </div>
                  </div>
                )}

                {/* Numéro facture */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Numéro de facture *</label>
                  <input type="text" value={form.numeroFacture} onChange={e => setForm(prev => ({ ...prev, numeroFacture: e.target.value }))}
                    placeholder="Ex: FAC-2026-001"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] bg-[var(--surface-raised)]" />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Date de la facture *</label>
                    <input type="date" value={form.dateFacture} onChange={e => setForm(prev => ({ ...prev, dateFacture: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Date d'échéance</label>
                    <input type="date" value={form.dateEcheance} onChange={e => setForm(prev => ({ ...prev, dateEcheance: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]" />
                  </div>
                </div>

                {/* Montants */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Montant HT *</label>
                    <input type="number" min="0" step="0.01" value={form.montantHT} onChange={e => setForm(prev => ({ ...prev, montantHT: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">TVA %</label>
                    <input type="number" min="0" step="0.1" value={form.tvaPercent} onChange={e => setForm(prev => ({ ...prev, tvaPercent: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Montant TTC</label>
                    <div className="px-3 py-2 border rounded-lg bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)] font-medium" style={{ color: 'var(--color-primary)' }}>
                      {formatPrice(montantTTCcalc)}
                    </div>
                  </div>
                </div>

                {/* Upload PDF */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">PDF facture (10 Mo max)</label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
                    onClick={() => document.getElementById('facture-pdf-input').click()}>
                    {form.fichier ? (
                      <div className="flex items-center justify-center gap-2 text-sm">
                        <FileText className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
                        <span className="font-medium text-[var(--text-primary)]">{form.fichier.name}</span>
                        <button onClick={(e) => { e.stopPropagation(); setForm(prev => ({ ...prev, fichier: null })); }}
                          className="ml-2 text-[#EF4444] hover:underline text-xs">Retirer</button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
                        <Upload className="h-8 w-8" strokeWidth={1.5} />
                        <span className="text-sm">Cliquez pour sélectionner un PDF</span>
                      </div>
                    )}
                    <input id="facture-pdf-input" type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end space-x-3 pt-4">
                  <button onClick={closeCreate} className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-lg font-medium">Annuler</button>
                  <button onClick={submitFacture} disabled={loading}
                    className="px-4 py-2 text-white rounded-lg font-medium disabled:opacity-50 flex items-center"
                    style={{ backgroundColor: 'var(--color-primary)' }}>
                    <Plus className="h-4 w-4 mr-2" /> Créer la facture
                  </button>
                </div>
              </div>
            ) : (
              /* ── Résultat du rapprochement ── */
              <div className="space-y-5">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-full mb-3"
                    style={{ background: `color-mix(in srgb, ${rapprochementResult.statutRapprochement === 'conforme' ? '#10B981' : rapprochementResult.statutRapprochement === 'litige' ? '#EF4444' : '#F59E0B'} 12%, transparent)` }}>
                    {rapprochementResult.statutRapprochement === 'conforme' ? (
                      <CheckCircle className="h-6 w-6" style={{ color: '#10B981' }} />
                    ) : (
                      <AlertTriangle className="h-6 w-6" style={{ color: rapprochementResult.statutRapprochement === 'litige' ? '#EF4444' : '#F59E0B' }} />
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">Résultat du rapprochement</h3>
                </div>

                <div className="bg-[var(--surface-hover)] rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Bon de commande</span>
                    <span className="font-medium text-[var(--text-primary)]">{formatPrice(rapprochementResult.commande?.montantTotal || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Quantité reçue</span>
                    <span className="font-medium text-[var(--text-primary)]">
                      {rapprochementResult.ecartQuantite === 0 ? '100% (conforme)' : `${rapprochementResult.ecartQuantite > 0 ? '+' : ''}${rapprochementResult.ecartQuantite} écart`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Facture</span>
                    <span className="font-medium text-[var(--text-primary)]">{formatPrice(rapprochementResult.montantTTC)}</span>
                  </div>
                  <div className="border-t pt-2 mt-2 flex justify-between">
                    <span className="text-[var(--text-muted)] font-medium">Écart de prix</span>
                    {renderEcart(rapprochementResult.ecartMontant)}
                  </div>
                </div>

                <div className="flex justify-center">
                  {renderRapprochementBadge(rapprochementResult.statutRapprochement)}
                </div>

                <div className="flex items-center justify-center space-x-3 pt-2">
                  {rapprochementResult.statutRapprochement === 'conforme' && (
                    <button onClick={() => validerFacture(rapprochementResult.id)}
                      className="px-4 py-2 text-white rounded-lg font-medium flex items-center"
                      style={{ backgroundColor: '#10B981' }}>
                      <CheckCircle className="h-4 w-4 mr-2" /> Valider la facture
                    </button>
                  )}
                  {rapprochementResult.statutRapprochement !== 'conforme' && (
                    <button onClick={() => signalerLitige(rapprochementResult.id)}
                      className="px-4 py-2 text-white rounded-lg font-medium flex items-center"
                      style={{ backgroundColor: '#EF4444' }}>
                      <XCircle className="h-4 w-4 mr-2" /> Signaler litige
                    </button>
                  )}
                  <button onClick={closeCreate}
                    className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-lg font-medium">
                    Fermer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body
    );
  };

  // ── Render: Modal détail ───────────────────────────────────────────────────

  const renderDetailModal = () => {
    if (!showDetail || !detailFacture) return null;
    const f = detailFacture;
    const cmd = f.commande;
    const isConforme = f.statutRapprochement === 'conforme';
    const isRecue = f.statut === 'recue';
    const isValidee = f.statut === 'validee';
    const hasEcart = f.statutRapprochement === 'ecart_prix' || f.statutRapprochement === 'ecart_quantite';

    return createPortal(
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4" onClick={closeDetail}>
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative bg-[var(--surface-raised)] rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto mt-10 mb-4" onClick={(e) => e.stopPropagation()}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Facture {f.numeroFacture}</h2>
                <p className="text-sm text-[var(--text-muted)] mt-0.5">{f.fournisseur?.nom}</p>
              </div>
              <button onClick={closeDetail} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 3 colonnes */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              {/* Colonne 1 — Bon de commande */}
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-[var(--text-secondary)] flex items-center">
                  <FileText className="h-4 w-4 mr-1.5" /> Bon de commande
                </h3>
                <div className="text-sm space-y-1.5">
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">N° commande</span><span className="font-mono font-medium">{cmd?.numeroCommande || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">Date</span><span>{formatDate(cmd?.dateCommande)}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">Fournisseur</span><span>{f.fournisseur?.nom}</span></div>
                </div>
                {cmd?.lignes && cmd.lignes.length > 0 && (
                  <div className="border-t pt-2">
                    <table className="w-full text-xs">
                      <thead><tr><th className="text-left py-1 text-[var(--text-muted)]">Médicament</th><th className="text-right py-1 text-[var(--text-muted)]">Qté</th><th className="text-right py-1 text-[var(--text-muted)]">Prix/u</th></tr></thead>
                      <tbody>
                        {cmd.lignes.map((l, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            <td className="py-1 text-[var(--text-primary)]">{l.medicament?.dci || '—'}</td>
                            <td className="py-1 text-right">{l.quantiteDemandee ?? l.quantite}</td>
                            <td className="py-1 text-right">{formatPrice(l.prixUnitaire)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between text-sm font-semibold">
                  <span>Total BC</span>
                  <span style={{ color: 'var(--color-primary)' }}>{formatPrice(cmd?.montantTotal || 0)}</span>
                </div>
                {cmd?.urlBonCommande && (
                  <a href={cmd.urlBonCommande} target="_blank" rel="noopener noreferrer"
                    className="flex items-center text-xs hover:underline" style={{ color: 'var(--color-primary)' }}>
                    <FileText className="h-3.5 w-3.5 mr-1" /> Voir PDF bon de commande
                  </a>
                )}
              </div>

              {/* Colonne 2 — Bon de livraison */}
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-[var(--text-secondary)] flex items-center">
                  <Package className="h-4 w-4 mr-1.5" /> Bon de livraison
                </h3>
                <div className="text-sm space-y-1.5">
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">N° BL</span><span className="font-mono">{cmd?.numeroBL || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">Date réception</span><span>{formatDate(cmd?.dateBL || cmd?.dateReception)}</span></div>
                </div>
                {cmd?.lignes && cmd.lignes.length > 0 && (
                  <div className="border-t pt-2">
                    <table className="w-full text-xs">
                      <thead><tr><th className="text-left py-1 text-[var(--text-muted)]">Médicament</th><th className="text-center py-1 text-[var(--text-muted)]">Reçue</th><th className="text-center py-1 text-[var(--text-muted)]">Commandée</th></tr></thead>
                      <tbody>
                        {cmd.lignes.map((l, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            <td className="py-1 text-[var(--text-primary)]">{l.medicament?.dci || '—'}</td>
                            <td className="py-1 text-center font-medium" style={{ color: l.quantiteRecue < (l.quantiteDemandee ?? l.quantite) ? '#F59E0B' : 'var(--text-primary)' }}>{l.quantiteRecue ?? 0}</td>
                            <td className="py-1 text-center text-[var(--text-muted)]">{l.quantiteDemandee ?? l.quantite}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {cmd?.noteReception && (
                  <div className="bg-[color-mix(in_srgb,#F59E0B_8%,transparent)] rounded p-2 text-xs text-[var(--text-secondary)]">
                    <strong>Note réception :</strong> {cmd.noteReception}
                  </div>
                )}
                {cmd?.urlBonLivraison && (
                  <a href={cmd.urlBonLivraison} target="_blank" rel="noopener noreferrer"
                    className="flex items-center text-xs hover:underline" style={{ color: 'var(--color-primary)' }}>
                    <FileText className="h-3.5 w-3.5 mr-1" /> Voir PDF bon de livraison
                  </a>
                )}
              </div>

              {/* Colonne 3 — Facture */}
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-[var(--text-secondary)] flex items-center">
                  <Receipt className="h-4 w-4 mr-1.5" /> Facture
                </h3>
                <div className="text-sm space-y-1.5">
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">N° facture</span><span className="font-mono font-medium">{f.numeroFacture}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">Date</span><span>{formatDate(f.dateFacture)}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">Échéance</span><span>{formatDate(f.dateEcheance)}</span></div>
                </div>
                <div className="border-t pt-2 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">Montant HT</span><span>{formatPrice(f.montantHT)}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">TVA</span><span>{formatPrice(f.montantTVA)}</span></div>
                  <div className="flex justify-between font-semibold"><span>TTC</span><span style={{ color: 'var(--color-primary)' }}>{formatPrice(f.montantTTC)}</span></div>
                </div>
                <DocumentUpload
                  label="PDF facture"
                  currentUrl={f.documentUrl || null}
                  endpoint={`/api/factures/${f.id}/document`}
                  acceptedTypes=".pdf"
                  onUpload={(res) => {
                    setDetailFacture(prev => prev ? { ...prev, documentUrl: res?.data?.documentUrl || res?.url || prev.documentUrl } : prev);
                    fetchFactures(); fetchAllFactures();
                  }}
                />
                {f.noteRapprochement && (
                  <div className="bg-[color-mix(in_srgb,#EF4444_8%,transparent)] rounded p-2 text-xs text-[var(--text-secondary)]">
                    <strong>Note litige :</strong> {f.noteRapprochement}
                  </div>
                )}
              </div>
            </div>

            {/* Footer — badge rapprochement + actions */}
            <div className="border-t pt-4 space-y-4">
              <div className="flex justify-center">
                <div className="text-center">
                  <p className="text-xs text-[var(--text-muted)] mb-1.5">Rapprochement 3 voies</p>
                  <div className="text-lg">
                    {renderRapprochementBadge(f.statutRapprochement)}
                  </div>
                </div>
              </div>

              {/* Actions selon contexte */}
              {isConforme && isRecue && (
                <div className="flex justify-center">
                  <button onClick={() => validerFacture(f.id)}
                    className="px-5 py-2.5 text-white rounded-lg font-medium flex items-center"
                    style={{ backgroundColor: '#10B981' }}>
                    <CheckCircle className="h-4 w-4 mr-2" /> Valider la facture
                  </button>
                </div>
              )}

              {hasEcart && f.statut !== 'litige' && f.statut !== 'payee' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Motif du litige</label>
                    <textarea value={litigeNote} onChange={e => setLitigeNote(e.target.value)} rows={2}
                      placeholder="Décrivez l'écart constaté..."
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] resize-none" />
                  </div>
                  <div className="flex justify-center space-x-3">
                    <button onClick={() => validerFacture(f.id)}
                      className="px-4 py-2 border rounded-lg font-medium hover:bg-[var(--surface-hover)]"
                      style={{ color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}>
                      Valider quand même
                    </button>
                    <button onClick={() => signalerLitige(f.id)}
                      className="px-4 py-2 text-white rounded-lg font-medium flex items-center"
                      style={{ backgroundColor: '#EF4444' }}>
                      <XCircle className="h-4 w-4 mr-2" /> Signaler un litige
                    </button>
                  </div>
                </div>
              )}

              {isValidee && (
                <div className="space-y-3 border-t pt-4">
                  <h4 className="text-sm font-semibold text-[var(--text-secondary)] flex items-center">
                    <Euro className="h-4 w-4 mr-1.5" /> Enregistrer le paiement
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Mode paiement</label>
                      <select value={paiement.modePaiement} onChange={e => setPaiement(prev => ({ ...prev, modePaiement: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm bg-[var(--surface-raised)]">
                        {MODE_PAIEMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Référence</label>
                      <input type="text" value={paiement.referencePaiement} onChange={e => setPaiement(prev => ({ ...prev, referencePaiement: e.target.value }))}
                        placeholder="N° chèque, virement..."
                        className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Date paiement</label>
                      <input type="date" value={paiement.datePaiement} onChange={e => setPaiement(prev => ({ ...prev, datePaiement: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <button onClick={() => confirmerPaiement(f.id)}
                      className="px-5 py-2.5 text-white rounded-lg font-medium flex items-center"
                      style={{ backgroundColor: 'var(--color-primary)' }}>
                      <CheckCircle className="h-4 w-4 mr-2" /> Confirmer le paiement
                    </button>
                  </div>
                </div>
              )}

              {f.statut === 'payee' && (
                <div className="flex justify-center">
                  <div className="bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)] rounded-lg px-4 py-2 text-sm">
                    <CheckCircle className="h-4 w-4 inline mr-2" style={{ color: 'var(--color-primary)' }} />
                    <span className="font-medium">Payée le {formatDate(f.datePaiement)}</span>
                    {f.modePaiement && <span className="text-[var(--text-muted)] ml-2">— {MODE_PAIEMENT_OPTIONS.find(o => o.value === f.modePaiement)?.label || f.modePaiement}</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  // ── Render principal ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Factures & Rapprochement"
        subtitle="Contrôle BC = BL = Facture"
        actions={
          <button onClick={openCreate}
            className="flex items-center justify-center px-4 py-2 rounded-lg text-white font-medium"
            style={{ backgroundColor: 'var(--color-primary)' }}>
            <Plus className="h-5 w-5 mr-2" /> Ajouter une facture
          </button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total factures" value={kpi.total} icon={FileText} color="blue" delay={0} />
        <KpiCard label="Conformes" value={kpi.conformes} icon={CheckCircle} color="green" delay={50} />
        <KpiCard label="Écarts détectés" value={kpi.ecarts} icon={AlertTriangle} color="orange" delay={100} />
        <KpiCard label="Litiges" value={kpi.litiges} icon={XCircle} color="red" delay={150} />
      </div>

      {/* Onglets */}
      <div className="flex flex-wrap gap-2">
        {ONGLETS.map(o => (
          <button key={o.key} onClick={() => { setOngletActif(o.key); setPage(1); }}
            className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${ongletActif === o.key ? 'text-white' : 'bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border'}`}
            style={ongletActif === o.key ? { backgroundColor: 'var(--color-primary)' } : {}}>
            {o.label}
            {counts[o.key] > 0 && (
              <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${ongletActif === o.key ? 'bg-[var(--surface-raised)] text-[var(--color-primary)]' : 'bg-[var(--surface-hover)] text-[var(--text-secondary)]'}`}>
                {counts[o.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[var(--surface-raised)] rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--surface-hover)]">
              <tr>
                {columns.map(col => (
                  <th key={col.key} className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {factures.length === 0 ? (
                <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-[var(--text-muted)]">Aucune facture</td></tr>
              ) : (
                factures.map(row => (
                  <tr key={row.id} className="hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => openDetail(row)}>
                    {columns.map(col => (
                      <td key={col.key} className="px-4 py-3 text-sm whitespace-nowrap">
                        {col.render ? col.render(row[col.key], row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-[var(--surface-raised)] rounded-xl shadow-sm px-4 py-3">
          <p className="text-sm text-[var(--text-muted)]">{totalItems} résultat{totalItems > 1 ? 's' : ''}</p>
          <div className="flex items-center space-x-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-2 rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50">
              <ChevronLeft className="h-5 w-5" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)}
                className={`px-3 py-1 rounded-lg text-sm font-medium ${page === p ? 'text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'}`}
                style={page === p ? { backgroundColor: 'var(--color-primary)' } : {}}>
                {p}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-2 rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {renderCreateModal()}
      {renderDetailModal()}
    </div>
  );
};

export default FacturesMgmt;
