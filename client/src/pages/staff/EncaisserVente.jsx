import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Banknote,
  Smartphone,
  CreditCard,
  Clock,
  CheckCircle,
  Printer,
  ArrowLeft,
  ShoppingCart,
  Loader2,
} from 'lucide-react';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import { Badge, Button } from '../../components/ui';

const PAYMENT_MODES = {
  especes: { label: 'Espèces', icon: Banknote, hint: null },
  mobile_money: { label: 'Mobile Money', icon: Smartphone, hint: 'Confirmer le paiement avant validation' },
  carte: { label: 'Carte bancaire', icon: CreditCard, hint: null },
  credit: { label: 'Crédit client', icon: Clock, hint: 'Le montant sera porté au compte du client' },
};

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];

function getChangeStatus(received, total) {
  if (received === 0) return { type: 'idle', message: 'Saisissez le montant reçu' };
  if (received >= total) return { type: 'ok', message: `Monnaie : ${received - total}` };
  return { type: 'error', message: `Insuffisant : -${total - received}` };
}

function formatNumeroVente(numero) {
  return `V-${String(numero).padStart(6, '0')}`;
}

function formatDateTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statutBadge(statut) {
  switch (statut) {
    case 'finalisee':
      return { variant: 'success', label: 'Finalisée' };
    case 'annulee':
      return { variant: 'danger', label: 'Annulée' };
    default:
      return { variant: 'warning', label: 'En attente', dot: true };
  }
}

function formatModeLabel(mode) {
  return PAYMENT_MODES[mode]?.label || mode;
}

const EncaisserVente = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { formatPrice, config } = useTenant();
  const { user } = useAuth();
  const { get, post, loading: apiLoading } = useAxios();

  const [vente, setVente] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [modePaiement, setModePaiement] = useState('especes');
  const [montantRecu, setMontantRecu] = useState(0);
  const [montantRecuInput, setMontantRecuInput] = useState('');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  const tauxTVA = parseFloat(config?.tauxTVA || 0);
  const devise = config?.devise || 'FCFA';

  const fetchVente = useCallback(async () => {
    setFetching(true);
    try {
      const data = await get(`/api/ventes/${id}`, { silent: true });
      setVente(data);
      if (data.statut === 'finalisee') {
        setSuccess({
          vente: data,
          monnaie: parseFloat(data.monnaie || 0),
          modePaiement: data.modePaiement,
        });
      }
    } catch (error) {
      console.error('Error fetching vente:', error);
      toast.error('Vente introuvable');
      setVente(null);
    } finally {
      setFetching(false);
    }
  }, [get, id]);

  useEffect(() => {
    fetchVente();
  }, [fetchVente]);

  const sousTotalProduits = useMemo(() => {
    if (!vente?.lignes) return 0;
    return vente.lignes.reduce((sum, l) => sum + parseFloat(l.sousTotal), 0);
  }, [vente]);

  const montantTVA = useMemo(() => {
    if (tauxTVA <= 0) return 0;
    return Math.round(sousTotalProduits * (tauxTVA / 100));
  }, [sousTotalProduits, tauxTVA]);

  const totalAPayer = useMemo(() => {
    if (!vente) return 0;
    const fromVente = parseFloat(vente.montantTotal);
    if (tauxTVA > 0) return sousTotalProduits + montantTVA;
    return fromVente || sousTotalProduits;
  }, [vente, sousTotalProduits, montantTVA, tauxTVA]);

  const changeStatus = useMemo(
    () => getChangeStatus(montantRecu, totalAPayer),
    [montantRecu, totalAPayer]
  );

  const canSubmit = useMemo(() => {
    if (submitting || !vente || vente.statut !== 'en_cours') return false;
    if (modePaiement === 'especes') return montantRecu >= totalAPayer;
    return true;
  }, [submitting, vente, modePaiement, montantRecu, totalAPayer]);

  const handleMontantInput = (value) => {
    setMontantRecuInput(value);
    const parsed = parseFloat(value.replace(/\s/g, '')) || 0;
    setMontantRecu(parsed);
  };

  const setExactAmount = () => {
    setMontantRecu(totalAPayer);
    setMontantRecuInput(String(totalAPayer));
  };

  const addQuickAmount = (amount) => {
    const next = montantRecu + amount;
    setMontantRecu(next);
    setMontantRecuInput(String(next));
  };

  const handleEncaisser = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const recu = modePaiement === 'especes' ? montantRecu : totalAPayer;
      const body = {
        modePaiement,
        montantRecu: recu,
        monnaie: recu - totalAPayer,
        encaisseePar: user?.id,
        ...(modePaiement === 'mobile_money' && reference ? { reference } : {}),
      };

      const result = await post(`/api/ventes/${id}/encaisser`, body, { silent: true });
      const venteResult = result?.vente || result;
      const monnaie = parseFloat(venteResult?.monnaie ?? recu - totalAPayer);

      // Enrichir venteResult avec les lignes déjà chargées (contiennent medicament)
      const venteAvecLignes = { ...venteResult, lignes: vente?.lignes || venteResult.lignes };

      setSuccess({
        vente: venteAvecLignes,
        monnaie,
        modePaiement,
        montantRecu: recu,
      });
      setVente(venteAvecLignes);
      toast.success(result?.message || 'Vente encaissée avec succès');
    } catch (error) {
      const msg = error.response?.data?.error || 'Erreur lors de l\'encaissement';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: 'var(--color-primary)' }} />
      </div>
    );
  }

  if (!vente) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p style={{ color: 'var(--text-secondary)' }}>Vente introuvable</p>
        <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/staff/caisse')}>
          Retour caisse
        </Button>
      </div>
    );
  }

  const badge = statutBadge(vente.statut);
  const receiptVente = success?.vente || vente;
  const receiptMonnaie = success?.monnaie ?? 0;
  const receiptMode = success?.modePaiement || modePaiement;

  const vendeurNom = receiptVente.staff
    ? `${receiptVente.staff.prenom || ''} ${receiptVente.staff.nom || ''}`.trim()
    : user ? `${user.prenom || ''} ${user.nom || ''}`.trim() : '';

  const receiptPortal = success && createPortal(
    <>
      <style>{`
        @media print {
          body > *:not(#receipt) { display: none !important; }
          #receipt { display: block !important; position: static !important; }
        }
        #receipt { display: none; }
      `}</style>
      <div
        id="receipt"
        style={{
          maxWidth: 300,
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: 12,
          lineHeight: 1.6,
          padding: '16px 12px',
          color: '#000',
          background: '#fff',
        }}
      >
        {/* En-tête pharmacie */}
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: 1 }}>
            {config?.nomApp || 'GestPharma'}
          </div>
          {config?.numeroAutorisation && (
            <div style={{ fontSize: 10 }}>N° AUT {config.numeroAutorisation}</div>
          )}
          {config?.adresse && <div style={{ fontSize: 10 }}>{config.adresse}</div>}
          {config?.telephone && <div style={{ fontSize: 10 }}>Tél : {config.telephone}</div>}
          {config?.email && <div style={{ fontSize: 10 }}>{config.email}</div>}
        </div>

        {/* Infos vente */}
        <div style={{ borderTop: '1px dashed #555', borderBottom: '1px dashed #555', padding: '6px 0', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span>{formatDateTime(receiptVente.updatedAt || receiptVente.createdAt)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700 }}>{formatNumeroVente(receiptVente.numeroVente)}</span>
            {vendeurNom && <span style={{ fontSize: 10 }}>{vendeurNom}</span>}
          </div>
          {receiptVente.nomClient && (
            <div style={{ fontSize: 11 }}>Client : {receiptVente.nomClient}</div>
          )}
          {receiptVente.telephoneClient && (
            <div style={{ fontSize: 11 }}>Tél : {receiptVente.telephoneClient}</div>
          )}
        </div>

        {/* Lignes articles */}
        {receiptVente.lignes?.length > 0 ? (
          <div style={{ marginBottom: 8 }}>
            {receiptVente.lignes.map((l, i) => {
              const dci = l.medicament?.dci || l.medicament?.nomCommercial || '—';
              const nomCommercial = l.medicament?.nomCommercial && l.medicament.nomCommercial !== l.medicament.dci
                ? l.medicament.nomCommercial : null;
              const remise = parseFloat(l.remise || 0);
              const sousTotal = parseFloat(l.sousTotal);
              return (
                <div key={i} style={{ marginBottom: 6, paddingBottom: 5, borderBottom: i < receiptVente.lignes.length - 1 ? '1px dotted #ccc' : 'none' }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{dci}</div>
                  {nomCommercial && (
                    <div style={{ fontSize: 10, color: '#444', fontStyle: 'italic' }}>{nomCommercial}</div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span>{l.quantite} × {formatPrice(l.prixUnitaire)}</span>
                    {remise > 0 && (
                      <span style={{ color: '#666' }}>-{remise}%</span>
                    )}
                    <span style={{ fontWeight: 600 }}>{formatPrice(sousTotal)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: '#666', marginBottom: 8, textAlign: 'center' }}>
            (aucun article)
          </div>
        )}

        {/* Totaux */}
        <div style={{ borderTop: '1px dashed #555', paddingTop: 8 }}>
          {tauxTVA > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span>Sous-total HT</span>
                <span>{formatPrice(sousTotalProduits)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span>TVA ({tauxTVA}%)</span>
                <span>{formatPrice(montantTVA)}</span>
              </div>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14, marginTop: 4 }}>
            <span>TOTAL</span>
            <span>{formatPrice(receiptVente.montantTotal)}</span>
          </div>
        </div>

        {/* Paiement */}
        <div style={{ borderTop: '1px dashed #555', marginTop: 8, paddingTop: 8, fontSize: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Mode de paiement</span>
            <span style={{ fontWeight: 600 }}>{formatModeLabel(receiptMode)}</span>
          </div>
          {(receiptMode === 'especes' || success?.montantRecu > 0) && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Montant reçu</span>
              <span>{formatPrice(success?.montantRecu ?? parseFloat(receiptVente.montantRecu ?? receiptVente.montantTotal))}</span>
            </div>
          )}
          {receiptMode === 'especes' && receiptMonnaie > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>Monnaie rendue</span>
              <span>{formatPrice(receiptMonnaie)}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 10, borderTop: '1px dashed #555', paddingTop: 8 }}>
          {config?.messageAccueil
            ? <div>{config.messageAccueil}</div>
            : <div>Merci de votre visite !</div>
          }
          <div style={{ marginTop: 4, color: '#666' }}>Conservez ce reçu</div>
        </div>
      </div>
    </>,
    document.body
  );

  if (success) {
    return (
      <>
        {receiptPortal}
        <div data-testid="succes-encaissement" className="flex flex-col items-center justify-center min-h-[480px] text-center px-4">
          <div
            className="mb-6"
            style={{
              animation: 'receiptSuccess 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
              transform: 'scale(0)',
            }}
          >
            <CheckCircle
              className="h-16 w-16"
              style={{ color: 'var(--color-primary)' }}
              strokeWidth={1.5}
            />
          </div>
          <h1
            className="text-2xl font-bold mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            Vente encaissée !
          </h1>
          <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
            {formatNumeroVente(success.vente.numeroVente)}
          </p>
          {success.modePaiement === 'especes' && success.monnaie > 0 && (
            <p
              className="mono text-xl font-bold mb-8"
              style={{ color: 'var(--color-success)' }}
            >
              Monnaie rendue : {formatPrice(success.monnaie)}
            </p>
          )}
          {success.modePaiement !== 'especes' && <div className="mb-8" />}
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
            <Button
              data-testid="btn-imprimer-recu"
              variant="primary"
              icon={Printer}
              onClick={handlePrint}
              className="flex-1"
            >
              Imprimer le reçu
            </Button>
            <Button
              variant="secondary"
              icon={ShoppingCart}
              onClick={() => navigate('/staff/vente')}
              className="flex-1"
            >
              Nouvelle vente
            </Button>
            <Button
              variant="ghost"
              icon={ArrowLeft}
              onClick={() => navigate('/staff/caisse')}
              className="flex-1"
            >
              Retour caisse
            </Button>
          </div>
        </div>
        <style>{`
          @keyframes receiptSuccess {
            from { transform: scale(0); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </>
    );
  }

  return (
    <>
      {receiptPortal}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
        {/* Colonne gauche — Ticket (60%) */}
        <div className="lg:col-span-3 space-y-4">
          <div
            className="rounded-xl p-6"
            style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div>
                <h1
                  className="text-xl font-bold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Vente #{vente.numeroVente}
                </h1>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {formatDateTime(vente.createdAt)}
                </p>
              </div>
              <Badge variant={badge.variant} dot={badge.dot}>
                {badge.label}
              </Badge>
            </div>

            <div className="space-y-3">
              {vente.lignes?.map((ligne) => (
                <div
                  key={ligne.id}
                  className="flex items-start justify-between gap-4 py-3"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {ligne.medicament?.dci}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {ligne.medicament?.nomCommercial}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {ligne.quantite} × <span className="mono">{formatPrice(ligne.prixUnitaire)}</span>
                    </p>
                    <p className="mono font-medium" style={{ color: 'var(--text-primary)' }}>
                      {formatPrice(ligne.sousTotal)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div
              className="mt-6 pt-4 space-y-2"
              style={{ borderTop: '2px solid var(--border-default)' }}
            >
              <div className="flex justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span>Sous-total produits</span>
                <span className="mono">{formatPrice(sousTotalProduits)}</span>
              </div>
              {tauxTVA > 0 && (
                <div className="flex justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>TVA ({tauxTVA} %)</span>
                  <span className="mono">{formatPrice(montantTVA)}</span>
                </div>
              )}
              <div
                className="flex justify-between items-center pt-3"
                style={{ borderTop: '1px solid var(--border-subtle)' }}
              >
                <span className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                  TOTAL À PAYER
                </span>
                <span
                  data-testid="total-vente"
                  className="mono font-bold text-2xl"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {formatPrice(totalAPayer)}
                </span>
              </div>
            </div>

            {(vente.nomClient || vente.telephoneClient) && (
              <div
                className="mt-6 p-4 rounded-lg"
                style={{ background: 'var(--surface-overlay)' }}
              >
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                  Client
                </p>
                {vente.nomClient && (
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{vente.nomClient}</p>
                )}
                {vente.telephoneClient && (
                  <p className="text-sm mono" style={{ color: 'var(--text-secondary)' }}>{vente.telephoneClient}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Colonne droite — Paiement (40%) */}
        <div className="lg:col-span-2">
          <div
            className="rounded-xl p-6 sticky top-6"
            style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <h2
              className="text-lg font-semibold mb-5"
              style={{ color: 'var(--text-primary)' }}
            >
              Mode de paiement
            </h2>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {Object.entries(PAYMENT_MODES).map(([key, mode]) => {
                const Icon = mode.icon;
                const selected = modePaiement === key;
                return (
                  <button
                    key={key}
                    data-testid={`mode-${key}`}
                    type="button"
                    onClick={() => setModePaiement(key)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all text-center"
                    style={{
                      border: selected ? '2px solid var(--color-primary)' : '1px solid var(--border-subtle)',
                      background: selected
                        ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                        : 'var(--surface-overlay)',
                    }}
                  >
                    <Icon
                      className="h-6 w-6"
                      style={{ color: selected ? 'var(--color-primary)' : 'var(--text-muted)' }}
                    />
                    <span
                      className="text-xs font-medium leading-tight"
                      style={{ color: selected ? 'var(--color-primary)' : 'var(--text-secondary)' }}
                    >
                      {mode.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {PAYMENT_MODES[modePaiement]?.hint && (
              <p
                className="text-xs mb-4 px-3 py-2 rounded-lg"
                style={{
                  background: 'color-mix(in srgb, var(--color-info) 10%, transparent)',
                  color: 'var(--color-info)',
                }}
              >
                {PAYMENT_MODES[modePaiement].hint}
              </p>
            )}

            {modePaiement === 'especes' && (
              <div className="space-y-4 mb-6">
                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Montant reçu
                  </label>
                  <div className="relative">
                    <input
                      data-testid="montant-recu"
                      type="number"
                      min="0"
                      step="1"
                      value={montantRecuInput}
                      onChange={(e) => handleMontantInput(e.target.value)}
                      className="w-full h-16 pl-4 pr-20 rounded-xl text-2xl font-mono"
                      style={{
                        background: 'var(--surface-overlay)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-mono)',
                      }}
                      placeholder="0"
                    />
                    <span
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {devise}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={setExactAmount}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    style={{
                      background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Exact
                  </button>
                  {QUICK_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => addQuickAmount(amount)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors mono"
                      style={{
                        background: 'var(--surface-overlay)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      +{amount.toLocaleString('fr-FR')}
                    </button>
                  ))}
                </div>

                <div
                  className="rounded-xl p-4 text-center transition-colors"
                  style={{
                    background:
                      changeStatus.type === 'ok'
                        ? 'color-mix(in srgb, var(--color-success) 12%, transparent)'
                        : changeStatus.type === 'error'
                          ? 'color-mix(in srgb, var(--color-danger) 12%, transparent)'
                          : 'var(--surface-overlay)',
                  }}
                >
                  <p
                    className="mono text-xl font-bold"
                    style={{
                      color:
                        changeStatus.type === 'ok'
                          ? 'var(--color-success)'
                          : changeStatus.type === 'error'
                            ? 'var(--color-danger)'
                            : 'var(--text-muted)',
                    }}
                  >
                    {changeStatus.type === 'idle'
                      ? changeStatus.message
                      : changeStatus.type === 'ok'
                        ? <span data-testid="monnaie-rendue">{`Monnaie : ${formatPrice(montantRecu - totalAPayer)}`}</span>
                        : `Insuffisant : -${formatPrice(totalAPayer - montantRecu)}`}
                  </p>
                </div>
              </div>
            )}

            {modePaiement === 'mobile_money' && (
              <div className="space-y-3 mb-6">
                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Référence transaction
                    <span className="font-normal" style={{ color: 'var(--text-muted)' }}> (optionnel)</span>
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Ex: MTN-123456789"
                    className="w-full h-10 px-3 rounded-lg text-sm"
                    style={{
                      background: 'var(--surface-overlay)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Confirmer le paiement MTN/Airtel avant validation
                </p>
              </div>
            )}

            <button
              data-testid="btn-valider-encaissement"
              type="button"
              onClick={handleEncaisser}
              disabled={!canSubmit}
              className="w-full h-14 rounded-xl text-lg font-semibold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--color-primary)' }}
            >
              {submitting || apiLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Valider l\'encaissement'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default EncaisserVente;
