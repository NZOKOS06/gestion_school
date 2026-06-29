import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import {
  Plus, Search, Eye, Send, Package, CheckCircle, XCircle, AlertTriangle,
  ChevronLeft, ChevronRight, Trash2, ArrowRight, ArrowLeft, Calendar,
  Clock, FileText, ClipboardList
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { DocumentUpload } from '../../components/ui';

const STATUTS = [
  { key: 'toutes', label: 'Toutes' },
  { key: 'brouillon', label: 'Brouillon' },
  { key: 'envoyee', label: 'Envoyées' },
  { key: 'recue', label: 'Reçues' },
  { key: 'partielle', label: 'Partielles' },
  { key: 'annulee', label: 'Annulées' }
];

const getStatutStyle = (statut) => {
  switch (statut) {
    case 'brouillon': return { label: 'Brouillon', className: 'bg-[var(--surface-hover)] text-[var(--text-secondary)]' };
    case 'envoyee': return { label: 'Envoyée', className: 'bg-[color-mix(in_srgb,#3B82F6_12%,transparent)] text-[#3B82F6]' };
    case 'recue': return { label: 'Reçue', className: 'bg-[color-mix(in_srgb,#10B981_12%,transparent)] text-[#10B981]' };
    case 'partielle': return { label: 'Partielle', className: 'bg-[color-mix(in_srgb,#F59E0B_12%,transparent)] text-[#F59E0B]' };
    case 'annulee': return { label: 'Annulée', className: 'bg-[color-mix(in_srgb,#EF4444_12%,transparent)] text-[#EF4444]' };
    default: return { label: statut, className: 'bg-[var(--surface-hover)] text-[var(--text-secondary)]' };
  }
};

const CommandesF = () => {
  const { formatPrice } = useTenant();
  const { get, post, put, loading } = useAxios();
  const [searchParams, setSearchParams] = useSearchParams();

  const [commandes, setCommandes] = useState([]);
  const [allCommandes, setAllCommandes] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [statutFilter, setStatutFilter] = useState(searchParams.get('statut') || 'toutes');
  const [fournisseurFilter, setFournisseurFilter] = useState(searchParams.get('fournisseurId') || '');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const navigate = useNavigate();

  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [editingCommande, setEditingCommande] = useState(null);
  const [wizardData, setWizardData] = useState({
    fournisseurId: '', dateLivraisonEstimee: '', note: '', lignes: []
  });

  const [medSearch, setMedSearch] = useState('');
  const [medResults, setMedResults] = useState([]);
  const [selMed, setSelMed] = useState(null);
  const [ligneQty, setLigneQty] = useState('');
  const [lignePrix, setLignePrix] = useState('');

  const [showReception, setShowReception] = useState(false);
  const [recCommande, setRecCommande] = useState(null);
  const [recLignes, setRecLignes] = useState([]);
  const [recBL, setRecBL] = useState({ numeroBL: '', dateBL: '', noteReception: '' });

  const [showDetail, setShowDetail] = useState(false);
  const [detailCmd, setDetailCmd] = useState(null);

  const limit = 15;

  useEffect(() => { fetchFournisseurs(); fetchAllCommandes(); }, []);
  useEffect(() => { fetchCommandes(); }, [page, statutFilter, fournisseurFilter]);

  useEffect(() => {
    if (medSearch.length >= 2) { searchMeds(); }
    else { setMedResults([]); }
  }, [medSearch]);

  const fetchFournisseurs = async () => {
    try { const res = await get('/api/fournisseurs?limit=1000'); setFournisseurs(res.data || res.fournisseurs || []); }
    catch (e) { console.error(e); }
  };

  const fetchAllCommandes = async () => {
    try { const res = await get('/api/commandes-fournisseurs?limit=1000'); setAllCommandes(res.data || res.commandes || []); }
    catch (e) { console.error(e); }
  };

  const fetchCommandes = async () => {
    try {
      let url = `/api/commandes-fournisseurs?page=${page}&limit=${limit}`;
      if (statutFilter !== 'toutes') url += `&statut=${statutFilter}`;
      if (fournisseurFilter) url += `&fournisseurId=${fournisseurFilter}`;
      const res = await get(url);
      setCommandes(res.data || res.commandes || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalItems(res.pagination?.total || res.data?.length || 0);
    } catch (e) { console.error(e); }
  };

  const searchMeds = async () => {
    try { const res = await get(`/api/medicaments?search=${encodeURIComponent(medSearch)}&limit=10`); setMedResults(res.data || []); }
    catch (e) { console.error(e); }
  };

  const counts = useMemo(() => {
    const c = {}; STATUTS.forEach(s => c[s.key] = 0);
    c.toutes = allCommandes.length;
    allCommandes.forEach(cmd => { if (c[cmd.statut] !== undefined) c[cmd.statut]++; });
    return c;
  }, [allCommandes]);

  const changeStatutFilter = (key) => {
    setStatutFilter(key); setPage(1);
    const sp = {};
    if (fournisseurFilter) sp.fournisseurId = fournisseurFilter;
    if (key !== 'toutes') sp.statut = key;
    setSearchParams(sp);
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

  const openWizard = (cmd = null) => {
    setEditingCommande(cmd);
    if (cmd) {
      setWizardData({
        fournisseurId: cmd.fournisseur?.id || '',
        dateLivraisonEstimee: cmd.dateLivraisonEstimee ? cmd.dateLivraisonEstimee.split('T')[0] : '',
        note: cmd.note || '',
        lignes: cmd.lignes?.map(l => ({
          medicamentId: l.medicament?.id || l.medicamentId,
          dci: l.medicament?.dci || l.dci,
          nomCommercial: l.medicament?.nomCommercial || l.nomCommercial,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire
        })) || []
      });
    } else {
      setWizardData({ fournisseurId: fournisseurFilter || '', dateLivraisonEstimee: '', note: '', lignes: [] });
    }
    setWizardStep(1); setMedSearch(''); setMedResults([]); setSelMed(null);
    setLigneQty(''); setLignePrix(''); setShowWizard(true);
  };

  const closeWizard = () => { setShowWizard(false); setEditingCommande(null); setWizardStep(1); };

  const wizardTotal = useMemo(() =>
    wizardData.lignes.reduce((sum, l) => sum + (Number(l.quantite) * Number(l.prixUnitaire)), 0),
  [wizardData.lignes]);

  const addLigne = () => {
    if (!selMed || !ligneQty || Number(ligneQty) <= 0 || !lignePrix || Number(lignePrix) < 0) {
      toast.error('Veuillez remplir médicament, quantité et prix unitaire'); return;
    }
    setWizardData(prev => ({
      ...prev,
      lignes: [...prev.lignes, {
        medicamentId: selMed.id, dci: selMed.dci, nomCommercial: selMed.nomCommercial,
        quantite: Number(ligneQty), prixUnitaire: Number(lignePrix)
      }]
    }));
    setSelMed(null); setMedSearch(''); setMedResults([]); setLigneQty(''); setLignePrix('');
  };

  const removeLigne = (idx) => {
    setWizardData(prev => ({ ...prev, lignes: prev.lignes.filter((_, i) => i !== idx) }));
  };

  const saveCommande = async (envoyer = false) => {
    if (!wizardData.fournisseurId) { toast.error('Veuillez sélectionner un fournisseur'); return; }
    if (wizardData.lignes.length === 0) { toast.error('Ajoutez au moins une ligne'); return; }
    const payload = {
      fournisseurId: wizardData.fournisseurId,
      dateLivraisonEstimee: wizardData.dateLivraisonEstimee || undefined,
      note: wizardData.note,
      lignes: wizardData.lignes.map(l => ({
        medicamentId: l.medicamentId, quantite: l.quantite, prixUnitaire: l.prixUnitaire
      }))
    };
    try {
      if (editingCommande) {
        toast.error('Modification non supportée pour les brouillons existants'); return;
      }
      const res = await post('/api/commandes-fournisseurs', payload);
      if (envoyer && res.id) {
        await put(`/api/commandes-fournisseurs/${res.id}/statut`, { statut: 'envoyee' });
        toast.success('Commande créée et envoyée');
      } else { toast.success('Commande enregistrée en brouillon'); }
      closeWizard(); fetchCommandes(); fetchAllCommandes();
    } catch (e) { console.error(e); }
  };

  const handleEnvoyer = async (cmd) => {
    try { await put(`/api/commandes-fournisseurs/${cmd.id}/statut`, { statut: 'envoyee' }); toast.success('Commande marquée comme envoyée'); fetchCommandes(); fetchAllCommandes(); }
    catch (e) { console.error(e); }
  };

  const handleAnnuler = async (cmd) => {
    if (!window.confirm(`Annuler la commande ${cmd.reference} ?`)) return;
    try { await put(`/api/commandes-fournisseurs/${cmd.id}/statut`, { statut: 'annulee' }); toast.success('Commande annulée'); fetchCommandes(); fetchAllCommandes(); }
    catch (e) { console.error(e); }
  };

  const openReception = (cmd) => {
    setRecCommande(cmd);
    setRecLignes(cmd.lignes?.map(l => ({
      ligneId: l.id, medicament: l.medicament, quantiteCommandee: l.quantiteDemandee ?? l.quantite,
      quantiteRecue: l.quantiteDemandee ?? l.quantite, numeroLot: '', datePeremption: '', prixAchatLot: ''
    })) || []);
    setRecBL({ numeroBL: '', dateBL: '', noteReception: '' });
    setShowReception(true);
  };

  const closeReception = () => { setShowReception(false); setRecCommande(null); setRecLignes([]); setRecBL({ numeroBL: '', dateBL: '', noteReception: '' }); };

  const submitReception = async () => {
    if (!recCommande) return;
    const lignes = recLignes.filter(r => Number(r.quantiteRecue) > 0).map(r => ({
      ligneId: r.ligneId, quantiteRecue: Number(r.quantiteRecue),
      numeroLot: r.numeroLot, datePeremption: r.datePeremption,
      prixAchatLot: Number(r.prixAchatLot) || 0
    }));
    if (lignes.length === 0) { toast.error('Aucune ligne à réceptionner'); return; }
    try {
      const payload = { lignes };
      if (recBL.numeroBL) payload.numeroBL = recBL.numeroBL;
      if (recBL.dateBL) payload.dateBL = recBL.dateBL;
      if (recBL.noteReception) payload.noteReception = recBL.noteReception;
      await post(`/api/commandes-fournisseurs/${recCommande.id}/reception`, payload);
      toast.success('Réception enregistrée — lots créés automatiquement');
      closeReception(); fetchCommandes(); fetchAllCommandes();
    } catch (e) { console.error(e); }
  };

  const openDetail = (cmd) => { setDetailCmd(cmd); setShowDetail(true); };
  const closeDetail = () => { setShowDetail(false); setDetailCmd(null); };

  const handleDocUploaded = (responseData) => {
    if (responseData?.data) {
      setDetailCmd(prev => prev ? { ...prev, ...responseData.data } : prev);
    }
    fetchCommandes(); fetchAllCommandes();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Commandes fournisseurs</h1>
          {fournisseurFilter && (
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Filtre fournisseur :
              <span className="font-medium ml-1">{fournisseurs.find(f => f.id === fournisseurFilter)?.nom || fournisseurFilter}</span>
              <button onClick={() => { setFournisseurFilter(''); setPage(1); setSearchParams(statutFilter !== 'toutes' ? { statut: statutFilter } : {}); }} className="ml-2 text-[#3B82F6] hover:underline text-xs">Retirer</button>
            </p>
          )}
        </div>
        <button onClick={() => openWizard()} className="flex items-center justify-center px-4 py-2 rounded-lg text-white font-medium" style={{ backgroundColor: 'var(--color-primary)' }}>
          <Plus className="h-5 w-5 mr-2" /> Nouvelle commande
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUTS.map(s => (
          <button key={s.key} onClick={() => changeStatutFilter(s.key)}
            className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statutFilter === s.key ? 'text-white' : 'bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border'}`}
            style={statutFilter === s.key ? { backgroundColor: 'var(--color-primary)' } : {}}>
            {s.label}
            {counts[s.key] > 0 && (
              <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${statutFilter === s.key ? 'bg-[var(--surface-raised)] text-[#10B981]' : 'bg-[var(--surface-hover)] text-[var(--text-secondary)]'}`}>{counts[s.key]}</span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-[var(--surface-raised)] rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--surface-hover)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Référence</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Fournisseur</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Livraison estimée</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase">Montant</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-[var(--text-muted)] uppercase">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {commandes.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-[var(--text-muted)]">Aucune commande</td></tr>
              ) : (commandes.map(cmd => {
                const badge = getStatutStyle(cmd.statut);
                return (
                  <tr key={cmd.id} className="hover:bg-[var(--surface-hover)]">
                    <td className="px-4 py-3 text-sm font-mono font-medium text-[var(--text-primary)]">{cmd.reference}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{cmd.fournisseur?.nom || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)] whitespace-nowrap">{formatDate(cmd.dateCommande)}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)] whitespace-nowrap">{formatDate(cmd.dateLivraisonEstimee)}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-[var(--text-primary)]">{formatPrice(cmd.montantTotal)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>{badge.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button onClick={() => openDetail(cmd)} className="p-2 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] rounded-lg" title="Voir détail"><Eye className="h-4 w-4" /></button>
                        {cmd.statut === 'brouillon' && (
                          <>
                            <button onClick={() => handleEnvoyer(cmd)} className="p-2 text-[#3B82F6] hover:bg-[color-mix(in_srgb,#3B82F6_12%,transparent)] rounded-lg" title="Marquer envoyée"><Send className="h-4 w-4" /></button>
                            <button onClick={() => handleAnnuler(cmd)} className="p-2 text-[#EF4444] hover:bg-[color-mix(in_srgb,#EF4444_12%,transparent)] rounded-lg" title="Annuler"><XCircle className="h-4 w-4" /></button>
                          </>
                        )}
                        {(cmd.statut === 'envoyee' || cmd.statut === 'partielle') && (
                          <button onClick={() => openReception(cmd)} className="p-2 text-[#10B981] hover:bg-[color-mix(in_srgb,#10B981_12%,transparent)] rounded-lg" title="Réceptionner"><Package className="h-4 w-4" /></button>
                        )}
                        {(cmd.statut === 'recue' || cmd.statut === 'partielle') && (
                          <button onClick={() => navigate(`/admin/factures?commandeId=${cmd.id}`)} className="p-2 text-[#3B82F6] hover:bg-[color-mix(in_srgb,#3B82F6_12%,transparent)] rounded-lg" title="Ajouter une facture"><FileText className="h-4 w-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-[var(--surface-raised)] rounded-xl shadow-sm px-4 py-3">
          <p className="text-sm text-[var(--text-muted)]">{totalItems} résultat{totalItems > 1 ? 's' : ''}</p>
          <div className="flex items-center space-x-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50"><ChevronLeft className="h-5 w-5" /></button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)} className={`px-3 py-1 rounded-lg text-sm font-medium ${page === p ? 'text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'}`} style={page === p ? { backgroundColor: 'var(--color-primary)' } : {}}>{p}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50"><ChevronRight className="h-5 w-5" /></button>
          </div>
        </div>
      )}

      {/* Wizard Modal */}
      {showWizard && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4" onClick={closeWizard}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-[var(--surface-raised)] rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mt-10 mb-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">{editingCommande ? 'Modifier la commande' : 'Nouvelle commande'}</h2>
                <div className="flex items-center space-x-2 text-sm text-[var(--text-muted)]">
                  <span className={`font-medium ${wizardStep === 1 ? 'text-[var(--text-primary)]' : ''}`}>Étape 1</span>
                  <ArrowRight className="h-4 w-4" />
                  <span className={`font-medium ${wizardStep === 2 ? 'text-[var(--text-primary)]' : ''}`}>Étape 2</span>
                </div>
              </div>

              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Fournisseur *</label>
                    <select value={wizardData.fournisseurId} onChange={e => setWizardData(prev => ({ ...prev, fournisseurId: e.target.value }))} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] bg-[var(--surface-raised)]">
                      <option value="">Sélectionner un fournisseur</option>
                      {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Date livraison estimée</label>
                    <input type="date" value={wizardData.dateLivraisonEstimee} onChange={e => setWizardData(prev => ({ ...prev, dateLivraisonEstimee: e.target.value }))} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Note</label>
                    <textarea value={wizardData.note} onChange={e => setWizardData(prev => ({ ...prev, note: e.target.value }))} rows={3} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] resize-none" />
                  </div>
                  <div className="flex items-center justify-end space-x-3 pt-4">
                    <button onClick={closeWizard} className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-lg font-medium">Annuler</button>
                    <button onClick={() => setWizardStep(2)} disabled={!wizardData.fournisseurId} className="px-4 py-2 text-white rounded-lg font-medium disabled:opacity-50 flex items-center" style={{ backgroundColor: 'var(--color-primary)' }}>
                      Suivant <ArrowRight className="h-4 w-4 ml-2" />
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="bg-[var(--surface-hover)] rounded-lg p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-[var(--text-secondary)] flex items-center"><Search className="h-4 w-4 mr-1.5" /> Ajouter un médicament</h3>
                    <div className="relative">
                      <input type="text" value={medSearch} onChange={e => setMedSearch(e.target.value)} placeholder="Rechercher par DCI ou nom commercial..." className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] bg-[var(--surface-raised)]" />
                      {medResults.length > 0 && (
                        <div className="absolute z-10 w-full bg-[var(--surface-raised)] border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                          {medResults.map(med => (
                            <button key={med.id} onClick={() => { setSelMed(med); setMedSearch(`${med.dci} — ${med.nomCommercial}`); setMedResults([]); }} className="w-full text-left px-3 py-2 hover:bg-[var(--surface-hover)] border-b last:border-0 text-sm">
                              <span className="font-medium text-[var(--text-primary)]">{med.dci}</span>
                              <span className="text-[var(--text-muted)] ml-1">— {med.nomCommercial}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {selMed && (
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Quantité</label>
                          <input type="number" min="1" value={ligneQty} onChange={e => setLigneQty(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Prix achat unitaire</label>
                          <input type="number" min="0" step="0.01" value={lignePrix} onChange={e => setLignePrix(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                        </div>
                        <div className="flex items-end">
                          <button onClick={addLigne} className="w-full px-3 py-2 border rounded-lg text-sm font-medium hover:bg-[var(--surface-hover)] flex items-center justify-center" style={{ color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}>
                            <Plus className="h-4 w-4 mr-1" /> Ajouter ligne
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {wizardData.lignes.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-[var(--surface-hover)]">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-[var(--text-muted)]">Médicament</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted)]">Qté</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted)]">Prix/u</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted)]">Total</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-[var(--text-muted)]"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {wizardData.lignes.map((l, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-2 text-[var(--text-primary)]">{l.dci} <span className="text-[var(--text-muted)] text-xs">{l.nomCommercial}</span></td>
                              <td className="px-3 py-2 text-right">{l.quantite}</td>
                              <td className="px-3 py-2 text-right">{formatPrice(l.prixUnitaire)}</td>
                              <td className="px-3 py-2 text-right font-medium">{formatPrice(l.quantite * l.prixUnitaire)}</td>
                              <td className="px-3 py-2 text-center">
                                <button onClick={() => removeLigne(idx)} className="p-1 text-[#EF4444] hover:bg-[color-mix(in_srgb,#EF4444_12%,transparent)] rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="px-3 py-2 bg-[var(--surface-hover)] text-right text-sm font-semibold text-[var(--text-primary)]">
                        Total : <span style={{ color: 'var(--color-primary)' }}>{formatPrice(wizardTotal)}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4">
                    <button onClick={() => setWizardStep(1)} className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-lg font-medium flex items-center"><ArrowLeft className="h-4 w-4 mr-2" /> Précédent</button>
                    <div className="flex items-center space-x-3">
                      <button onClick={closeWizard} className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-lg font-medium">Annuler</button>
                      <button onClick={() => saveCommande(false)} disabled={loading || wizardData.lignes.length === 0} className="px-4 py-2 border rounded-lg font-medium hover:bg-[var(--surface-hover)] disabled:opacity-50" style={{ color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}>Enregistrer en brouillon</button>
                      <button onClick={() => saveCommande(true)} disabled={loading || wizardData.lignes.length === 0} className="px-4 py-2 text-white rounded-lg font-medium disabled:opacity-50 flex items-center" style={{ backgroundColor: 'var(--color-primary)' }}><Send className="h-4 w-4 mr-2" /> Envoyer directement</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Reception Modal */}
      {showReception && recCommande && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4" onClick={closeReception}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-[var(--surface-raised)] rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto mt-10 mb-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Réception — {recCommande.reference}</h2>
                <button onClick={closeReception} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-lg"><XCircle className="h-5 w-5" /></button>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mb-4">Fournisseur : <span className="font-medium">{recCommande.fournisseur?.nom}</span></p>

              <div className="space-y-4">
                {recLignes.map((rl, idx) => (
                  <div key={rl.ligneId} className="border rounded-lg p-4 bg-[var(--surface-hover)]">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{rl.medicament?.dci || '—'}</p>
                        <p className="text-xs text-[var(--text-muted)]">{rl.medicament?.nomCommercial || ''}</p>
                      </div>
                      <span className="text-xs bg-gray-200 text-[var(--text-secondary)] px-2 py-1 rounded">Commandé : {rl.quantiteCommandee}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Qté reçue *</label>
                        <input type="number" min="0" value={rl.quantiteRecue} onChange={e => { const v = e.target.value; setRecLignes(prev => prev.map((r, i) => i === idx ? { ...r, quantiteRecue: v } : r)); }} className="w-full px-3 py-2 border rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">N° lot</label>
                        <input type="text" value={rl.numeroLot} onChange={e => setRecLignes(prev => prev.map((r, i) => i === idx ? { ...r, numeroLot: e.target.value } : r))} className="w-full px-3 py-2 border rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Date péremption</label>
                        <input type="date" value={rl.datePeremption} onChange={e => setRecLignes(prev => prev.map((r, i) => i === idx ? { ...r, datePeremption: e.target.value } : r))} className="w-full px-3 py-2 border rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Prix achat lot</label>
                        <input type="number" min="0" step="0.01" value={rl.prixAchatLot} onChange={e => setRecLignes(prev => prev.map((r, i) => i === idx ? { ...r, prixAchatLot: e.target.value } : r))} className="w-full px-3 py-2 border rounded-lg text-sm" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Champs Bon de Livraison */}
              <div className="mt-4 border rounded-lg p-4 bg-[var(--surface-raised)]">
                <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Bon de livraison (optionnel)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">N° bon de livraison</label>
                    <input type="text" value={recBL.numeroBL} onChange={e => setRecBL(prev => ({ ...prev, numeroBL: e.target.value }))} placeholder="Ex: BL-2026-001" className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Date du bon de livraison</label>
                    <input type="date" value={recBL.dateBL} onChange={e => setRecBL(prev => ({ ...prev, dateBL: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Note de réception / Anomalie</label>
                    <textarea value={recBL.noteReception} onChange={e => setRecBL(prev => ({ ...prev, noteReception: e.target.value }))} rows={2} placeholder="Ex: Colis endommagé, produit manquant..." className="w-full px-3 py-2 border rounded-lg text-sm resize-none" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-6">
                <button onClick={closeReception} className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-lg font-medium">Annuler</button>
                <button onClick={submitReception} disabled={loading} className="px-4 py-2 text-white rounded-lg font-medium disabled:opacity-50 flex items-center" style={{ backgroundColor: 'var(--color-primary)' }}>
                  <CheckCircle className="h-4 w-4 mr-2" /> Valider la réception
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Detail Modal */}
      {showDetail && detailCmd && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4" onClick={closeDetail}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-[var(--surface-raised)] rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mt-10 mb-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Détail — {detailCmd.reference}</h2>
                <button onClick={closeDetail} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-lg"><XCircle className="h-5 w-5" /></button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                <div><span className="text-[var(--text-muted)]">Fournisseur</span><p className="font-medium text-[var(--text-primary)]">{detailCmd.fournisseur?.nom || '—'}</p></div>
                <div><span className="text-[var(--text-muted)]">Statut</span><p><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatutStyle(detailCmd.statut).className}`}>{getStatutStyle(detailCmd.statut).label}</span></p></div>
                <div><span className="text-[var(--text-muted)]">Date commande</span><p className="font-medium text-[var(--text-primary)]">{formatDate(detailCmd.dateCommande)}</p></div>
                <div><span className="text-[var(--text-muted)]">Livraison estimée</span><p className="font-medium text-[var(--text-primary)]">{formatDate(detailCmd.dateLivraisonEstimee)}</p></div>
                <div className="col-span-2"><span className="text-[var(--text-muted)]">Note</span><p className="text-[var(--text-secondary)]">{detailCmd.note || '—'}</p></div>
              </div>

              <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">Lignes</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--surface-hover)]">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-[var(--text-muted)]">Médicament</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted)]">Qté</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted)]">Prix/u</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted)]">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {detailCmd.lignes?.map((l, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 text-[var(--text-primary)]">{l.medicament?.dci || l.dci} <span className="text-[var(--text-muted)] text-xs">{l.medicament?.nomCommercial || l.nomCommercial}</span></td>
                        <td className="px-3 py-2 text-right">{l.quantite}</td>
                        <td className="px-3 py-2 text-right">{formatPrice(l.prixUnitaire)}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatPrice(l.quantite * l.prixUnitaire)}</td>
                      </tr>
                    )) || <tr><td colSpan={4} className="px-3 py-4 text-center text-[var(--text-muted)]">Aucune ligne</td></tr>}
                  </tbody>
                </table>
                <div className="px-3 py-2 bg-[var(--surface-hover)] text-right text-sm font-semibold text-[var(--text-primary)]">
                  Total : <span style={{ color: 'var(--color-primary)' }}>{formatPrice(detailCmd.montantTotal)}</span>
                </div>
              </div>

              {(detailCmd.statut === 'recue' || detailCmd.statut === 'partielle') && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 flex items-center">
                    <FileText className="h-4 w-4 mr-1.5" /> Documents d'approvisionnement
                  </h3>
                  <div className="space-y-3">
                    <DocumentUpload
                      label="Bon de commande (BC)"
                      currentUrl={detailCmd.urlBonCommande}
                      endpoint={`/api/commandes-fournisseurs/${detailCmd.id}/document/bon-commande`}
                      acceptedTypes=".pdf,.jpg,.png"
                      onUpload={handleDocUploaded}
                    />
                    <DocumentUpload
                      label="Bon de livraison (BL)"
                      currentUrl={detailCmd.urlBonLivraison}
                      endpoint={`/api/commandes-fournisseurs/${detailCmd.id}/document/bon-livraison`}
                      acceptedTypes=".pdf,.jpg,.png"
                      onUpload={handleDocUploaded}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <button onClick={closeDetail} className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-lg font-medium">Fermer</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CommandesF;

