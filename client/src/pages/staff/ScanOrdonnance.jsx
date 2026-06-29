import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAxios } from '../../hooks/useAxios';
import { useSocket } from '../../hooks/useSocket';
import { Button, PageHeader } from '../../components/ui';
import {
  Camera,
  Upload,
  FileText,
  RotateCcw,
  ArrowLeft,
  FileImage,
  X,
  CheckCircle2,
} from 'lucide-react';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const todayInput = () => new Date().toISOString().split('T')[0];

const ScanOrdonnance = () => {
  const { post } = useAxios();
  const { on, off } = useSocket();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  const [form, setForm] = useState({
    nomMedecin: '',
    dateOrdonnance: todayInput(),
    nomClient: '',
    telephoneClient: '',
    note: '',
  });

  // Socket.IO : ordonnance validée
  useEffect(() => {
    const handleValidated = (data) => {
      toast.success(
        `Ordonnance ${data.reference || data.id} validée par le pharmacien !`,
        { duration: 5000 }
      );
    };
    on('ordonnanceValidee', handleValidated);
    return () => off('ordonnanceValidee', handleValidated);
  }, [on, off]);

  const resetForm = useCallback(() => {
    setFile(null);
    setPreview(null);
    setSuccess(null);
    setForm({
      nomMedecin: '',
      dateOrdonnance: todayInput(),
      nomClient: '',
      telephoneClient: '',
      note: '',
    });
  }, []);

  const validateFile = (selectedFile) => {
    if (!ACCEPTED_TYPES.includes(selectedFile.type)) {
      toast.error('Format non supporté. Utilisez JPG, PNG, WebP ou PDF.');
      return false;
    }
    if (selectedFile.size > MAX_SIZE_BYTES) {
      toast.error(`Fichier trop lourd. Taille max : ${MAX_SIZE_MB} Mo.`);
      return false;
    }
    return true;
  };

  const handleFile = (selectedFile) => {
    if (!selectedFile || !validateFile(selectedFile)) return;
    setFile(selectedFile);

    if (selectedFile.type === 'application/pdf') {
      setPreview('pdf');
    } else {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !form.nomMedecin.trim()) return;

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('nomMedecin', form.nomMedecin.trim());
      fd.append('dateOrdonnance', form.dateOrdonnance);
      if (form.nomClient.trim()) fd.append('nomClient', form.nomClient.trim());
      if (form.telephoneClient.trim())
        fd.append('telephoneClient', form.telephoneClient.trim());
      if (form.note.trim()) fd.append('note', form.note.trim());

      const res = await post('/api/ordonnances', fd, {
        headers: { 'Content-Type': undefined },
      });

      setSuccess({
        id: res.ordonnance?.id,
        reference: res.ordonnance?.reference || res.ordonnance?.id,
      });
      toast.success('Ordonnance soumise avec succès');
    } catch {
      // toast géré par useAxios
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = file && form.nomMedecin.trim().length > 0;

  // ─── Écran succès ───
  if (success) {
    return (
      <div data-testid="succes-ordonnance" className="max-w-lg mx-auto space-y-8 py-12 px-4">
        <div className="text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-[color-mix(in_srgb,#10B981_12%,transparent)] flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-[#10B981]" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">
            Ordonnance soumise !
          </h2>
          <p className="text-[var(--text-secondary)]">
            Le pharmacien va la valider. Vous serez notifié dès qu'elle sera
            traitée.
          </p>
          <div className="inline-flex items-center gap-2 bg-[var(--surface-hover)] px-4 py-2 rounded-lg">
            <span className="text-sm text-[var(--text-muted)]">Référence :</span>
            <span className="text-sm font-mono font-semibold text-[var(--text-primary)]">
              #{success.reference}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="secondary"
            icon={RotateCcw}
            onClick={resetForm}
            className="flex-1"
          >
            Nouvelle ordonnance
          </Button>
          <Button
            icon={ArrowLeft}
            onClick={() => navigate('/staff/dashboard')}
            className="flex-1"
          >
            Retour dashboard
          </Button>
        </div>
      </div>
    );
  }

  // ─── Écran principal ───
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8 px-4">
      <PageHeader
        title="Nouvelle ordonnance"
        subtitle="Scannez ou téléversez une ordonnance physique"
        icon={Camera}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Zone upload */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !preview && fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-2xl p-8
            flex flex-col items-center justify-center gap-3
            transition-all cursor-pointer min-h-[280px]
            ${
              dragActive
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                : 'border-gray-300 hover:border-gray-400 bg-[var(--surface-hover)]'
            }
          `}
        >
          <input
            ref={fileInputRef}
            data-testid="input-ordonnance"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onChange={handleChange}
            className="hidden"
          />

          {preview ? (
            <div className="relative w-full flex flex-col items-center gap-4">
              {preview === 'pdf' ? (
                <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
                  <FileText className="h-16 w-16 text-[#EF4444]" />
                  <p className="text-sm font-medium">{file.name}</p>
                </div>
              ) : (
                <img
                  data-testid="preview-ordonnance"
                  src={preview}
                  alt="Aperçu"
                  className="max-h-48 rounded-xl object-contain shadow-sm"
                />
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={X}
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setPreview(null);
                  fileInputRef.current.value = '';
                }}
              >
                Changer l'image
              </Button>
            </div>
          ) : (
            <>
              <div
                className="h-14 w-14 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--color-primary)', opacity: 0.1 }}
              >
                <Upload
                  className="h-7 w-7"
                  style={{ color: 'var(--color-primary)' }}
                />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Cliquez ou glissez-déposez une image ici
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  JPG, PNG, WebP ou PDF — max {MAX_SIZE_MB} Mo
                </p>
              </div>
            </>
          )}
        </div>

        {/* Formulaire */}
        <div className="bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-xl p-6 space-y-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Nom du médecin *
              </label>
              <input
                required
                data-testid="nom-medecin"
                value={form.nomMedecin}
                onChange={(e) =>
                  setForm({ ...form, nomMedecin: e.target.value })
                }
                placeholder="Dr. Dupont"
                className="w-full px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Date de l'ordonnance *
              </label>
              <input
                required
                type="date"
                data-testid="date-ordonnance"
                value={form.dateOrdonnance}
                onChange={(e) =>
                  setForm({ ...form, dateOrdonnance: e.target.value })
                }
                className="w-full px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Nom du client
              </label>
              <input
                value={form.nomClient}
                onChange={(e) =>
                  setForm({ ...form, nomClient: e.target.value })
                }
                placeholder="Marie Dupont"
                className="w-full px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Téléphone du client
              </label>
              <input
                type="tel"
                value={form.telephoneClient}
                onChange={(e) =>
                  setForm({ ...form, telephoneClient: e.target.value })
                }
                placeholder="+225 01 23 45 67 89"
                className="w-full px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Note pour le pharmacien
            </label>
            <textarea
              rows={3}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Urgence, allergies connues, précisions..."
              className="w-full px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
            />
          </div>
        </div>

        {/* Bouton */}
        <Button
          data-testid="btn-soumettre-ordonnance"
          type="submit"
          loading={submitting}
          disabled={!canSubmit}
          icon={FileImage}
          size="lg"
          className="w-full"
        >
          Soumettre au pharmacien
        </Button>

        {!canSubmit && (
          <p className="text-center text-xs text-[var(--text-muted)] -mt-4">
            {file
              ? 'Renseignez le nom du médecin pour soumettre'
              : 'Sélectionnez une image pour continuer'}
          </p>
        )}
      </form>
    </div>
  );
};

export default ScanOrdonnance;


