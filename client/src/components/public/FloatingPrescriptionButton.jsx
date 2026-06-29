import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Upload, X, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { useI18n } from '../../contexts/I18nContext';
import { useTenant } from '../../contexts/TenantContext';
import axios from 'axios';
import toast from 'react-hot-toast';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

export default function FloatingPrescriptionButton() {
  const { t } = useI18n();
  const { isModuleActive } = useTenant();
  const [open, setOpen] = useState(false);
  const [fichier, setFichier] = useState(null);
  const [apercu, setApercu] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const fileInputRef = useRef(null);

  if (!isModuleActive('commandeEnLigne')) return null;

  const traiterFichier = (file) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error(t('quick_rx_formats'));
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('5 Mo max');
      return;
    }
    setFichier(file);
    setSent(false);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setApercu(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setApercu(null);
    }
  };

  const envoyer = async () => {
    if (!fichier) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('ordonnanceFile', fichier);
      fd.append('items', JSON.stringify([]));
      await axios.post('/api/public/commandes', fd, {
        headers: { 'Content-Type': undefined },
      });
      setSent(true);
      setFichier(null);
      setApercu(null);
      toast.success(t('quick_rx_sent'));
      setTimeout(() => {
        setOpen(false);
        setSent(false);
      }, 2500);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur');
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setOpen(false);
    setFichier(null);
    setApercu(null);
    setSent(false);
  };

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-5 py-3.5 rounded-full text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5"
        style={{ backgroundColor: 'var(--color-primary)' }}
        aria-label={t('floating_rx')}
      >
        <Upload className="h-5 w-5" />
        <span className="hidden sm:inline">{t('floating_rx')}</span>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={reset}
          />
          <div
            className="relative w-full max-w-md rounded-3xl p-6 md:p-8"
            style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-modal)',
            }}
          >
            <button
              onClick={reset}
              className="absolute top-4 right-4 p-2 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
            >
              <X className="h-5 w-5" />
            </button>

            {sent ? (
              <div className="text-center py-8">
                <div
                  className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'color-mix(in srgb, var(--color-success) 12%, transparent)' }}
                >
                  <CheckCircle2 className="h-8 w-8" style={{ color: 'var(--color-success)' }} />
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {t('quick_rx_sent')}
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {t('quick_rx_subtitle')}
                </p>
              </div>
            ) : (
              <>
                <h3 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                  {t('quick_rx_title')}
                </h3>
                <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
                  {t('quick_rx_subtitle')}
                </p>

                <div
                  className="relative rounded-2xl p-6 text-center cursor-pointer transition-colors mb-4"
                  style={{
                    border: `2px dashed ${dragOver ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
                    background: dragOver
                      ? 'color-mix(in srgb, var(--color-primary) 5%, transparent)'
                      : 'var(--surface-base)',
                  }}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const file = e.dataTransfer.files[0];
                    if (file) traiterFichier(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    className="hidden"
                    onChange={(e) => e.target.files[0] && traiterFichier(e.target.files[0])}
                  />
                  {fichier ? (
                    <div>
                      {apercu ? (
                        <img src={apercu} alt="Aperçu" className="max-h-32 mx-auto rounded-xl mb-2 object-contain" />
                      ) : (
                        <FileText className="h-12 w-12 mx-auto mb-2" style={{ color: 'var(--color-primary)' }} />
                      )}
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{fichier.name}</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {(fichier.size / 1024).toFixed(0)} Ko
                      </p>
                    </div>
                  ) : (
                    <div>
                      <Upload className="h-10 w-10 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {t('quick_rx_drag')}
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {t('quick_rx_formats')}
                      </p>
                    </div>
                  )}
                </div>

                <button
                  onClick={envoyer}
                  disabled={!fichier || sending}
                  className="w-full h-12 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {t('quick_rx_btn')}
                </button>

                <Link
                  to="/commander"
                  onClick={reset}
                  className="block text-center mt-3 text-sm font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {t('btn_order')} →
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
