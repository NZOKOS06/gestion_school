import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAxios } from '../../hooks/useAxios';
import {
  CheckCircle, XCircle, ClipboardCheck, Pill, Calendar, Phone,
  User, Image as ImageIcon, X, ChevronLeft, ChevronRight, AlertCircle,
  Stethoscope, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'en_attente', label: 'En attente' },
  { key: 'validee', label: 'Validées' },
  { key: 'dispensee', label: 'Dispensées' },
  { key: 'refusee', label: 'Refusées' }
];

const getStatutStyle = (statut) => {
  switch (statut) {
    case 'en_attente': return { label: 'En attente', className: 'bg-[color-mix(in_srgb,#F59E0B_12%,transparent)] text-[#F59E0B]' };
    case 'validee': return { label: 'Validée', className: 'bg-[color-mix(in_srgb,#10B981_12%,transparent)] text-[#10B981]' };
    case 'dispensee': return { label: 'Dispensée', className: 'bg-[color-mix(in_srgb,#3B82F6_12%,transparent)] text-[#3B82F6]' };
    case 'refusee': return { label: 'Refusée', className: 'bg-[color-mix(in_srgb,#EF4444_12%,transparent)] text-[#EF4444]' };
    default: return { label: statut, className: 'bg-[var(--surface-hover)] text-[var(--text-secondary)]' };
  }
};

const OrdonnancesMgmt = () => {
  const { get, put, loading } = useAxios();
  const [ordonnances, setOrdonnances] = useState([]);
  const [allOrdonnances, setAllOrdonnances] = useState([]);
  const [statutFilter, setStatutFilter] = useState('en_attente');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [lightboxImage, setLightboxImage] = useState(null);
  const [showValider, setShowValider] = useState(false);
  const [showRefuser, setShowRefuser] = useState(false);
  const [selectedOrd, setSelectedOrd] = useState(null);
  const [note, setNote] = useState('');

  const limit = 12;

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { fetchOrdonnances(); }, [page, statutFilter]);

  const fetchAll = async () => {
    try {
      const res = await get('/api/ordonnances?limit=1000');
      setAllOrdonnances(res.data || []);
    } catch (e) { console.error(e); }
  };

  const fetchOrdonnances = async () => {
    try {
      let url = `/api/ordonnances?page=${page}&limit=${limit}`;
      if (statutFilter !== 'toutes') url += `&statut=${statutFilter}`;
      const res = await get(url);
      setOrdonnances(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalItems(res.pagination?.total || 0);
    } catch (e) { console.error(e); }
  };

  const counts = useMemo(() => {
    const c = { en_attente: 0, validee: 0, dispensee: 0, refusee: 0, toutes: 0 };
    c.toutes = allOrdonnances.length;
    allOrdonnances.forEach(o => { if (c[o.statut] !== undefined) c[o.statut]++; });
    return c;
  }, [allOrdonnances]);

  const enAttenteUrgent = counts.en_attente > 5;

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
  const formatDateTime = (d) => d
    ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';

  const openValider = (ord) => { setSelectedOrd(ord); setNote(''); setShowValider(true); };
  const openRefuser = (ord) => { setSelectedOrd(ord); setNote(''); setShowRefuser(true); };

  const handleValider = async () => {
    if (!selectedOrd) return;
    try {
      await put(`/api/ordonnances/${selectedOrd.id}/valider`, { note });
      toast.success('Ordonnance validée');
      setShowValider(false); setSelectedOrd(null); setNote('');
      fetchOrdonnances(); fetchAll();
    } catch (e) { console.error(e); }
  };

  const handleRefuser = async () => {
    if (!selectedOrd) return;
    if (!note.trim()) { toast.error('Veuillez indiquer un motif de refus'); return; }
    try {
      await put(`/api/ordonnances/${selectedOrd.id}/refuser`, { motif: note });
      toast.success('Ordonnance refusée');
      setShowRefuser(false); setSelectedOrd(null); setNote('');
      fetchOrdonnances(); fetchAll();
    } catch (e) { console.error(e); }
  };

  const handleDispenser = async (ord) => {
    try {
      await put(`/api/ordonnances/${ord.id}/dispenser`, {});
      toast.success('Ordonnance marquée comme dispensée');
      fetchOrdonnances(); fetchAll();
    } catch (e) { console.error(e); }
  };

  const getImageUrl = (url) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${import.meta.env.VITE_API_URL || ''}${url}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Ordonnances</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {counts.en_attente > 0 ? (
              <span className="flex items-center">
                <AlertCircle className={`h-4 w-4 mr-1 ${enAttenteUrgent ? 'text-[#EF4444]' : 'text-yellow-500'}`} />
                <span className={enAttenteUrgent ? 'text-[#EF4444] font-semibold' : ''}>
                  {counts.en_attente} ordonnance{counts.en_attente > 1 ? 's' : ''} en attente
                </span>
                {enAttenteUrgent && (
                  <span className="ml-2 inline-flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[color-mix(in_srgb,#EF4444_12%,transparent)]0"></span>
                  </span>
                )}
              </span>
            ) : 'Aucune ordonnance en attente'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab, tabIdx) => (
          <button
            key={tab.key}
            data-testid={tab.key === 'en_attente' ? 'tab-en-attente' : undefined}
            onClick={() => { setStatutFilter(tab.key); setPage(1); }}
            className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statutFilter === tab.key ? 'text-white' : 'bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border'
            }`}
            style={statutFilter === tab.key ? { backgroundColor: 'var(--color-primary)' } : {}}
          >
            {tab.label}
            {counts[tab.key] > 0 && (
              <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                statutFilter === tab.key ? 'bg-[var(--surface-raised)] text-[#10B981]' : 'bg-[var(--surface-hover)] text-[var(--text-secondary)]'
              }`}>
                {counts[tab.key]}
              </span>
            )}
            {tab.key === 'en_attente' && enAttenteUrgent && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[color-mix(in_srgb,#EF4444_12%,transparent)]0"></span>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Cards Grid */}
      {ordonnances.length === 0 ? (
        <div className="bg-[var(--surface-raised)] rounded-xl shadow-sm p-12 text-center text-[var(--text-muted)]">
          Aucune ordonnance dans ce statut
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ordonnances.map((ord, ordIdx) => {
            const badge = getStatutStyle(ord.statut);
            return (
              <div key={ord.id} data-testid={ordIdx === 0 ? 'ordonnance-card' : undefined} className="bg-[var(--surface-raised)] rounded-xl shadow-sm border border-[var(--border-subtle)] overflow-hidden flex flex-col">
                {/* Image */}
                {ord.imageUrl ? (
                  <div
                    className="h-40 bg-[var(--surface-hover)] cursor-pointer relative group overflow-hidden"
                    onClick={() => setLightboxImage(getImageUrl(ord.imageUrl))}
                  >
                    <img
                      src={getImageUrl(ord.imageUrl)}
                      alt="Ordonnance"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ) : (
                  <div className="h-40 bg-[var(--surface-hover)] flex items-center justify-center text-gray-300">
                    <ImageIcon className="h-10 w-10" />
                  </div>
                )}

                {/* Body */}
                <div className="p-4 flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatDateTime(ord.createdAt)}
                    </span>
                  </div>

                  <div className="space-y-2 mb-3">
                    <div className="flex items-center text-sm text-[var(--text-secondary)]">
                      <User className="h-4 w-4 mr-2 text-[var(--text-muted)]" />
                      <span className="font-medium">{ord.user?.nom || '—'} {ord.user?.prenom || ''}</span>
                    </div>
                    <div className="flex items-center text-sm text-[var(--text-secondary)]">
                      <Phone className="h-4 w-4 mr-2 text-[var(--text-muted)]" />
                      {ord.user?.telephone || '—'}
                    </div>
                    <div className="flex items-center text-sm text-[var(--text-secondary)]">
                      <Stethoscope className="h-4 w-4 mr-2 text-[var(--text-muted)]" />
                      Dr. {ord.nomMedecin || '—'}
                    </div>
                    <div className="flex items-center text-sm text-[var(--text-secondary)]">
                      <Calendar className="h-4 w-4 mr-2 text-[var(--text-muted)]" />
                      {formatDate(ord.dateOrdonnance)}
                    </div>
                  </div>

                  <div className="border-t pt-3">
                    <p className="text-xs font-medium text-[var(--text-muted)] mb-2 flex items-center">
                      <Pill className="h-3.5 w-3.5 mr-1" /> Médicaments prescrits
                    </p>
                    <div className="space-y-1">
                      {ord.lignes?.length > 0 ? ord.lignes.map((l, i) => (
                        <div key={i} className="text-sm text-[var(--text-secondary)] flex items-center justify-between">
                          <span className="truncate mr-2">{l.medicament?.dci || l.medicament?.nomCommercial || 'Inconnu'}</span>
                          <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">x{l.quantitePrescrite || 1}</span>
                        </div>
                      )) : (
                        <span className="text-sm text-[var(--text-muted)]">Aucune ligne</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="px-4 pb-4">
                  {ord.statut === 'en_attente' && (
                    <div className="flex gap-2">
                      <button
                        data-testid={ordIdx === 0 ? 'btn-valider-ordonnance' : undefined}
                        onClick={() => openValider(ord)}
                        className="flex-1 flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors"
                      >
                        <CheckCircle className="h-4 w-4 mr-1.5" /> Valider
                      </button>
                      <button
                        onClick={() => openRefuser(ord)}
                        className="flex-1 flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium text-[#EF4444] bg-[color-mix(in_srgb,#EF4444_12%,transparent)] hover:bg-[color-mix(in_srgb,#EF4444_12%,transparent)] transition-colors"
                      >
                        <XCircle className="h-4 w-4 mr-1.5" /> Refuser
                      </button>
                    </div>
                  )}
                  {ord.statut === 'validee' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDispenser(ord)}
                        className="flex-1 flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                      >
                        <ClipboardCheck className="h-4 w-4 mr-1.5" /> Dispenser
                      </button>
                      <button
                        onClick={() => openRefuser(ord)}
                        className="flex-1 flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium text-[#EF4444] bg-[color-mix(in_srgb,#EF4444_12%,transparent)] hover:bg-[color-mix(in_srgb,#EF4444_12%,transparent)] transition-colors"
                      >
                        <XCircle className="h-4 w-4 mr-1.5" /> Refuser
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-[var(--surface-raised)] rounded-xl shadow-sm px-4 py-3">
          <p className="text-sm text-[var(--text-muted)]">{totalItems} résultat{totalItems > 1 ? 's' : ''}</p>
          <div className="flex items-center space-x-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50">
              <ChevronLeft className="h-5 w-5" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)} className={`px-3 py-1 rounded-lg text-sm font-medium ${page === p ? 'text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'}`} style={page === p ? { backgroundColor: 'var(--color-primary)' } : {}}>
                {p}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxImage && createPortal(
        <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4" onClick={() => setLightboxImage(null)}>
          <button className="absolute top-4 right-4 text-white hover:text-gray-300 p-2" onClick={() => setLightboxImage(null)}>
            <X className="h-8 w-8" />
          </button>
          <img src={lightboxImage} alt="Ordonnance plein écran" className="max-w-full max-h-full rounded-lg shadow-2xl object-contain" />
        </div>,
        document.body
      )}

      {/* Modal Valider */}
      {showValider && selectedOrd && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4" onClick={() => { setShowValider(false); setSelectedOrd(null); setNote(''); }}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-[var(--surface-raised)] rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto mt-10 mb-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">Valider l&apos;ordonnance</h2>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Ordonnance de <span className="font-medium">{selectedOrd.user?.nom} {selectedOrd.user?.prenom}</span> — Dr. {selectedOrd.nomMedecin}
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Note optionnelle</label>
                <textarea
                  data-testid="note-validation"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                  placeholder="Commentaire sur la validation..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button onClick={() => { setShowValider(false); setSelectedOrd(null); setNote(''); }} className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-lg font-medium text-sm">Annuler</button>
                <button data-testid="btn-confirmer-validation" onClick={handleValider} disabled={loading} className="px-4 py-2 text-white rounded-lg font-medium text-sm disabled:opacity-50 flex items-center bg-green-600 hover:bg-green-700">
                  <CheckCircle className="h-4 w-4 mr-2" /> Confirmer la validation
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Refuser */}
      {showRefuser && selectedOrd && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4" onClick={() => { setShowRefuser(false); setSelectedOrd(null); setNote(''); }}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-[var(--surface-raised)] rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto mt-10 mb-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">Refuser l&apos;ordonnance</h2>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Ordonnance de <span className="font-medium">{selectedOrd.user?.nom} {selectedOrd.user?.prenom}</span> — Dr. {selectedOrd.nomMedecin}
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Motif du refus *</label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                  placeholder="Pourquoi cette ordonnance est refusée..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button onClick={() => { setShowRefuser(false); setSelectedOrd(null); setNote(''); }} className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-lg font-medium text-sm">Annuler</button>
                <button onClick={handleRefuser} disabled={loading} className="px-4 py-2 text-white rounded-lg font-medium text-sm disabled:opacity-50 flex items-center bg-red-600 hover:bg-red-700">
                  <XCircle className="h-4 w-4 mr-2" /> Confirmer le refus
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default OrdonnancesMgmt;

