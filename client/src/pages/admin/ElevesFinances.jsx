import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import {
  PageHeader, DataTable, Badge, Button, SearchInput,
  Modal, Input, Select, FormField, FilterBar, Spinner, Card,
} from '../../components/ui';
import { Eye, Wallet, CheckCircle, AlertCircle, Clock, Printer, FileDown } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { openPdf } from '../../utils/pdf';

const MODE_PAIEMENT = ['especes', 'mobile_money', 'carte', 'cheque', 'virement'];
const MODE_LABELS = { especes: 'Espèces', mobile_money: 'Mobile Money', carte: 'Carte', cheque: 'Chèque', virement: 'Virement' };

/* ─── Calcul de la cascade avance ─────────────────────────── */
function computeCascade(echeances, montantSaisi) {
  let remaining = parseFloat(montantSaisi) || 0;
  const lastUnpaidIdx = (() => {
    let idx = -1;
    echeances.forEach((ech, i) => {
      const reste = Math.max(0, ech.montantAttendu - ech.montantPaye);
      if (ech.statut !== 'payee' && reste > 0.01) idx = i;
    });
    return idx >= 0 ? idx : echeances.length - 1;
  })();

  return echeances.map((ech, i) => {
    const reste = Math.max(0, ech.montantAttendu - ech.montantPaye);
    const alreadyPaid = ech.statut === 'payee' || reste <= 0.01;
    if (alreadyPaid && remaining <= 0.01) {
      return {
        ...ech, toPay: 0, avance: 0, newStatut: 'payee',
        surpaye: Number(ech.montantPaye) > Number(ech.montantAttendu) + 0.01,
      };
    }
    if (alreadyPaid) {
      return { ...ech, toPay: 0, avance: 0, newStatut: 'payee', surpaye: false };
    }
    const toPay = Math.min(remaining, reste);
    remaining = Math.max(0, remaining - reste);
    const fullyPaid = toPay >= reste - 0.01;
    const isLast = i === lastUnpaidIdx;
    const avance = fullyPaid && remaining > 0.01 && isLast ? remaining : (!fullyPaid && toPay > 0 ? toPay : 0);
    if (fullyPaid && remaining > 0.01 && isLast) remaining = 0;
    return {
      ...ech,
      toPay,
      avance: avance > 0.01 ? avance : 0,
      newStatut: fullyPaid ? 'payee' : (toPay > 0 ? 'en_attente' : ech.statut),
      surpaye: fullyPaid && avance > 0.01,
    };
  });
}

/* ─── Badge statut échéance ───────────────────────────────── */
const StatutBadge = ({ statut, surpaye }) => {
  if (surpaye) return <Badge variant="info" dot>Surpayé</Badge>;
  if (statut === 'payee') return <Badge variant="success" dot>Payée</Badge>;
  if (statut === 'en_retard') return <Badge variant="danger">En retard</Badge>;
  return <Badge variant="warning">En attente</Badge>;
};

/* ─── Composant ligne échéance ────────────────────────────── */
const EcheanceLine = ({ ech, formatPrice }) => {
  const reste = Math.max(0, ech.montantAttendu - ech.montantPaye);
  const isPaid = ech.statut === 'payee' || reste <= 0.01;
  const willBePaid = !isPaid && ech.toPay > 0;

  return (
    <div
      className="grid items-center gap-3 px-4 py-3 rounded-xl transition-all"
      style={{
        gridTemplateColumns: '1fr 1fr 1fr 1fr auto',
        background: isPaid
          ? 'color-mix(in srgb, var(--color-success) 8%, transparent)'
          : willBePaid
            ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)'
            : 'var(--surface-overlay)',
        border: willBePaid
          ? '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)'
          : isPaid
            ? '1px solid color-mix(in srgb, var(--color-success) 25%, transparent)'
            : '1px solid var(--border-subtle)',
        marginBottom: 6,
      }}
    >
      {/* Mois / libellé */}
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{ech.libelle}</p>
        {!/^(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)/i.test(ech.libelle) && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {new Date(ech.dateEcheance).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </p>
        )}
      </div>

      {/* Frais */}
      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {formatPrice(ech.montantAttendu)}
      </div>

      {/* Reste */}
      <div>
        <p className="text-sm font-semibold" style={{ color: isPaid ? 'var(--color-success)' : reste > 0 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
          {isPaid ? '0' : formatPrice(reste)}
        </p>
        {ech.montantPaye > 0 && !isPaid && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>payé: {formatPrice(ech.montantPaye)}</p>
        )}
      </div>

      {/* Avance / cascade preview */}
      <div>
        {willBePaid && ech.avance > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}>
            Avance {formatPrice(ech.avance)}
          </span>
        )}
        {willBePaid && ech.toPay > 0 && !(ech.avance > 0) && (
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}>
            − {formatPrice(ech.toPay)}
          </span>
        )}
        {isPaid && !willBePaid && (
          <span className="text-xs" style={{ color: 'var(--color-success)' }}>✓ soldée</span>
        )}
      </div>

      {/* Statut */}
      <StatutBadge
        statut={willBePaid && ech.toPay >= reste - 0.01 ? 'payee' : ech.statut}
        surpaye={ech.surpaye}
      />
    </div>
  );
};

/* ─── Modale détail élève avec échéancier ─────────────────── */
const EleveDetailModal = ({ open, onClose, eleve, detail, loadingDetail, onPaid, formatPrice }) => {
  const { post } = useAxios();
  const [montantSaisi, setMontantSaisi] = useState('');
  const [modePaiement, setModePaiement] = useState('especes');
  const [motif, setMotif] = useState('');
  const [paying, setPaying] = useState(false);
  const [activeTab, setActiveTab] = useState('echeances');

  // Réinitialiser quand on change d'élève
  useEffect(() => {
    if (open) { setMontantSaisi(''); setModePaiement('especes'); setMotif(''); setActiveTab('echeances'); }
  }, [open, eleve?.id]);

  const echeances = detail?.inscriptions?.[0]?.echeances || [];
  const inscriptionActuelle = detail?.inscriptions?.find((i) => i.anneeScolaire?.actif) || detail?.inscriptions?.[0];
  const solde = Number(inscriptionActuelle?.soldeScolarite || 0);
  const totalDu = echeances.reduce((s, e) => s + Math.max(0, e.montantAttendu - e.montantPaye), 0);

  // Preview cascade en temps réel
  const cascadePreview = montantSaisi ? computeCascade(echeances, montantSaisi) : echeances.map((e) => ({ ...e, toPay: 0, avance: 0 }));

  const soldeComplet = solde <= 0.01 && totalDu <= 0.01;
  const montantDemande = parseFloat(montantSaisi) || 0;
  const depassement = montantDemande > totalDu + 0.01;

  const handlePay = async () => {
    const amount = parseFloat(montantSaisi);
    if (!amount || amount <= 0) { toast.error('Entrez un montant valide'); return; }
    if (!inscriptionActuelle?.id) { toast.error('Aucune inscription active trouvée'); return; }
    if (soldeComplet) { toast.error('La scolarité est entièrement soldée'); return; }
    if (amount > totalDu + 0.01) {
      toast.error(`Veuillez saisir le montant restant : ${formatPrice(totalDu)}`);
      return;
    }
    setPaying(true);
    try {
      await post('/api/paiements/batch', {
        inscriptionId: inscriptionActuelle.id,
        montant: amount,
        modePaiement,
        motif: motif || undefined,
      });
      toast.success(`${formatPrice(amount)} enregistré avec succès !`);
      setMontantSaisi('');
      setMotif('');
      onPaid();
    } catch { /* toast via useAxios */ }
    setPaying(false);
  };

  // Remplissage automatique du montant avec le total restant
  const fillTotal = () => setMontantSaisi(totalDu.toFixed(0));

  if (!eleve) return null;

  const tabStyle = (tab) => ({
    padding: '6px 16px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    background: activeTab === tab ? 'var(--color-primary)' : 'transparent',
    color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
    transition: 'all 0.15s',
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${eleve.prenom} ${eleve.nom}`}
      subtitle={eleve.matricule}
      size="xl"
      footer={inscriptionActuelle?.id ? (
        <Button
          variant="secondary"
          icon={FileDown}
          onClick={() => openPdf(`/api/paiements/situation-pdf?inscriptionId=${inscriptionActuelle.id}`, `situation-${eleve.matricule}.pdf`)}
        >
          Situation PDF
        </Button>
      ) : null}
    >
      {loadingDetail ? (
        <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div>
      ) : !detail ? (
        <div className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>Erreur de chargement</div>
      ) : (
        <div className="space-y-5">
          {/* Résumé financier */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Classe', value: inscriptionActuelle?.classe?.nom || '—' },
              { label: 'Solde restant', value: formatPrice(solde), danger: solde > 0 },
              { label: 'Total dû', value: formatPrice(totalDu) },
              { label: 'Parent', value: detail.parent ? `${detail.parent.prenom} ${detail.parent.nom}` : '—' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl p-3"
                style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                <p className="text-sm font-bold" style={{ color: item.danger ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 p-1 rounded-xl" style={{ background: 'var(--surface-overlay)' }}>
            <button style={tabStyle('echeances')} onClick={() => setActiveTab('echeances')}>📅 Échéancier</button>
            <button style={tabStyle('paiements')} onClick={() => setActiveTab('paiements')}>💳 Historique paiements</button>
          </div>

          {activeTab === 'echeances' && (
            <>
              {/* Scolarité soldée : la saisie n'a plus lieu d'être */}
              {inscriptionActuelle && echeances.length > 0 && soldeComplet && (
                <div className="rounded-xl p-4 flex items-start gap-3"
                  style={{ background: 'color-mix(in srgb, var(--color-success) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-success) 30%, transparent)' }}>
                  <CheckCircle className="h-5 w-5 shrink-0" style={{ color: 'var(--color-success)' }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-success)' }}>
                      Scolarité entièrement soldée
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      Le solde restant et le total dû sont à zéro : aucun nouveau paiement ne peut être enregistré pour cet élève.
                    </p>
                  </div>
                </div>
              )}

              {/* Zone de saisie du montant */}
              {inscriptionActuelle && echeances.length > 0 && !soldeComplet && (
                <div className="rounded-xl p-4 space-y-3"
                  style={{ background: 'color-mix(in srgb, var(--color-primary) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)' }}>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    💰 Entrer un paiement
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <FormField label="Montant reçu (FCFA)">
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={montantSaisi}
                          onChange={(e) => setMontantSaisi(e.target.value)}
                          placeholder="Ex: 50 000"
                          min={0}
                        />
                        {totalDu > 0 && (
                          <button
                            onClick={fillTotal}
                            className="px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap"
                            style={{ background: 'var(--surface-overlay)', color: 'var(--color-primary)', border: '1px solid var(--border-subtle)' }}
                            title="Remplir avec le total restant"
                          >
                            Tout régler
                          </button>
                        )}
                      </div>
                    </FormField>
                    <FormField label="Mode de paiement">
                      <Select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)}>
                        {MODE_PAIEMENT.map((m) => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
                      </Select>
                    </FormField>
                    <FormField label="Motif (optionnel)">
                      <Input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Scolarité..." />
                    </FormField>
                  </div>

                  {/* Montant supérieur au reste dû */}
                  {depassement && (
                    <div className="flex items-start gap-2 p-3 rounded-lg"
                      style={{ background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)' }}>
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--color-danger)' }} />
                      <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
                        Veuillez saisir le montant restant : <strong>{formatPrice(totalDu)}</strong>
                      </p>
                    </div>
                  )}

                  {/* Preview cascade */}
                  {montantSaisi && parseFloat(montantSaisi) > 0 && !depassement && (() => {
                    const cascade = computeCascade(echeances, montantSaisi);
                    const nbPaid = cascade.filter((e) => e.toPay >= (e.montantAttendu - e.montantPaye) - 0.01 && e.statut !== 'payee').length;
                    const avanceGlobale = parseFloat(montantSaisi) - echeances.reduce((s, e) => s + Math.max(0, e.montantAttendu - e.montantPaye), 0);
                    return (
                      <div className="flex flex-wrap gap-3 items-center pt-1">
                        {nbPaid > 0 && (
                          <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                            style={{ background: 'color-mix(in srgb, var(--color-success) 15%, transparent)', color: 'var(--color-success)' }}>
                            <CheckCircle className="h-3.5 w-3.5" /> {nbPaid} mois soldé{nbPaid > 1 ? 's' : ''}
                          </span>
                        )}
                        {avanceGlobale > 0.01 && (
                          <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                            style={{ background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}>
                            Avance: {formatPrice(avanceGlobale)}
                          </span>
                        )}
                        <Button
                          icon={Wallet}
                          onClick={handlePay}
                          disabled={paying}
                          size="sm"
                        >
                          {paying ? 'Enregistrement...' : `Valider ${formatPrice(parseFloat(montantSaisi))}`}
                        </Button>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Tableau échéancier */}
              {echeances.length === 0 ? (
                <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>Aucune échéance définie pour cette inscription</p>
                </div>
              ) : (
                <div>
                  {/* En-tête */}
                  <div className="grid px-4 pb-2 text-xs font-semibold uppercase tracking-wider"
                    style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr auto', color: 'var(--text-muted)' }}>
                    <span>Mois</span>
                    <span>Frais</span>
                    <span>Reste</span>
                    <span>Avance</span>
                    <span>Statut</span>
                  </div>
                  {cascadePreview.map((ech) => (
                    <EcheanceLine key={ech.id} ech={ech} formatPrice={formatPrice} />
                  ))}
                  {/* Résumé bas */}
                  <div className="flex justify-between items-center mt-3 pt-3 px-2"
                    style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {echeances.filter((e) => e.statut === 'payee').length}/{echeances.length} mois soldés
                    </span>
                    <span className="text-sm font-bold" style={{ color: totalDu > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                      Total restant : {formatPrice(totalDu)}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'paiements' && (() => {
            const paiements = inscriptionActuelle?.paiements || [];
            return paiements.length === 0 ? (
              <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                <Wallet className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>Aucun paiement enregistré</p>
              </div>
            ) : (
              <div className="space-y-2">
                {paiements.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-xl"
                    style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Reçu n°{p.numeroRecu} — {p.motif || p.typePaiement}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {new Date(p.datePaiement).toLocaleDateString('fr-FR')} · {MODE_LABELS[p.modePaiement] || p.modePaiement}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold" style={{ color: 'var(--color-success)' }}>
                        {formatPrice(p.montant)}
                      </span>
                      <button
                        onClick={() => openPdf(`/api/paiements/${p.id}/recu-pdf`, `recu-${p.numeroRecu}.pdf`)}
                        className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]"
                        title="Imprimer reçu"
                      >
                        <Printer className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </Modal>
  );
};

/* ─── Page principale ─────────────────────────────────────── */
const ElevesFinances = () => {
  const { get } = useAxios();
  const { formatPrice } = useTenant();
  const [searchParams] = useSearchParams();
  const [eleves, setEleves] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebounce(search, 300);
  const [filters, setFilters] = useState({ classe: '', statut_paiement: '' });
  const [selected, setSelected] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchEleves = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filters.classe) params.set('classe', filters.classe);
      params.set('inscription', 'validee');
      params.set('limit', '200');
      const res = await get(`/api/eleves?${params.toString()}`);
      setEleves(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [debouncedSearch, filters, get]);

  useEffect(() => { fetchEleves(); }, [fetchEleves]);

  useEffect(() => {
    (async () => {
      try {
        const res = await get('/api/classes?limit=200', { silent: true });
        setClasses(res?.data || res || []);
      } catch { /* silent */ }
    })();
  }, [get]);

  const openDetail = async (eleve) => {
    setSelected(eleve);
    setDetailOpen(true);
    setDetail(null);
    setLoadingDetail(true);
    try {
      // On récupère le détail enrichi avec écheances et paiements
      const res = await get(`/api/eleves/${eleve.id}`);
      // Enrichir les inscriptions avec les écheances et paiements
      const inscriptions = res?.inscriptions || [];
      for (const insc of inscriptions) {
        try {
          const echRes = await get(`/api/paiements/echeances?inscriptionId=${insc.id}`, { silent: true });
          insc.echeances = echRes?.data || echRes || [];
          const pRes = await get(`/api/paiements?inscriptionId=${insc.id}&limit=50`, { silent: true });
          insc.paiements = pRes?.data || pRes || [];
        } catch { insc.echeances = []; insc.paiements = []; }
      }
      setDetail({ ...res, inscriptions });
    } catch { /* silent */ }
    setLoadingDetail(false);
  };

  const onPaid = () => {
    fetchEleves();
    if (selected) openDetail(selected);
  };

  // Filtre côté client pour statut paiement
  const displayedEleves = eleves.filter((row) => {
    const insc = row.inscriptions?.[0];
    const solde = Number(insc?.soldeScolarite || 0);
    if (filters.statut_paiement === 'a_jour') return solde <= 0;
    if (filters.statut_paiement === 'en_retard') return solde > 0;
    return true;
  });

  const getStatutFinancier = (row) => {
    const insc = row.inscriptions?.[0];
    if (!insc) return { label: 'Non inscrit', variant: 'neutral', icon: null };
    const solde = Number(insc.soldeScolarite || 0);
    if (solde <= 0) return { label: 'À jour', variant: 'success', icon: CheckCircle };
    if (solde > 0) return { label: 'Impayé', variant: 'danger', icon: AlertCircle };
    return { label: '—', variant: 'neutral', icon: null };
  };

  const selectStyle = { height: 36, width: 160, minWidth: 130, maxWidth: 200, flexShrink: 0 };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Élèves & Finances"
        subtitle="Suivi financier des élèves — cliquez sur un élève pour gérer son échéancier"
      />

      <FilterBar>
        <div className="min-w-[200px] w-[240px] shrink-0">
          <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, prénom, matricule..." />
        </div>
        <Select fullWidth={false} style={selectStyle} value={filters.classe} onChange={(e) => setFilters({ ...filters, classe: e.target.value })}>
          <option value="">Toutes les classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </Select>
        <Select fullWidth={false} style={selectStyle} value={filters.statut_paiement} onChange={(e) => setFilters({ ...filters, statut_paiement: e.target.value })}>
          <option value="">Tous les statuts</option>
          <option value="a_jour">À jour</option>
          <option value="en_retard">Impayés</option>
        </Select>
      </FilterBar>

      <DataTable
        columns={[
          {
            key: 'nom',
            label: 'Élève',
            render: (_, row) => (
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}>
                  {row.prenom?.[0]}{row.nom?.[0]}
                </div>
                <div>
                  <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{row.prenom} {row.nom}</p>
                  <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{row.matricule}</p>
                </div>
              </div>
            ),
          },
          {
            key: 'classe',
            label: 'Classe',
            render: (_, row) => {
              const insc = row.inscriptions?.[0];
              return insc?.classe?.nom
                ? <span style={{ color: 'var(--text-secondary)' }}>{insc.classe.nom}</span>
                : <span style={{ color: 'var(--text-muted)' }}>—</span>;
            },
          },
          {
            key: 'solde',
            label: 'Solde restant',
            render: (_, row) => {
              const insc = row.inscriptions?.[0];
              const solde = Number(insc?.soldeScolarite || 0);
              return (
                <span className="font-semibold" style={{ color: solde > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                  {solde > 0 ? formatPrice(solde) : '✓ soldé'}
                </span>
              );
            },
          },
          {
            key: 'statut_financier',
            label: 'Statut',
            render: (_, row) => {
              const s = getStatutFinancier(row);
              return <Badge variant={s.variant}>{s.label}</Badge>;
            },
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (_, row) => (
              <button
                onClick={(e) => { e.stopPropagation(); openDetail(row); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                style={{ background: 'var(--color-primary)', color: '#fff' }}
                title="Gérer l'échéancier"
              >
                <Eye className="h-3.5 w-3.5" /> Gérer
              </button>
            ),
          },
        ]}
        data={displayedEleves}
        loading={loading}
        emptyMessage="Aucun élève trouvé"
        emptyDescription="Ajustez vos filtres ou inscrivez un élève."
        onRowClick={openDetail}
        sortable
        pagination
        pageSize={20}
      />

      <EleveDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        eleve={selected}
        detail={detail}
        loadingDetail={loadingDetail}
        onPaid={onPaid}
        formatPrice={formatPrice}
      />
    </div>
  );
};

export default ElevesFinances;
