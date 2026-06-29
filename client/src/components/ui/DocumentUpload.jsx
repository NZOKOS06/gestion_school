import { useState, useRef, useCallback } from 'react';
import { FileUp, FileCheck, Eye, Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import axiosInstance from '../../utils/axios';

const DocumentUpload = ({
  label,
  currentUrl,
  onUpload,
  endpoint,
  acceptedTypes = '.pdf',
  maxSizeMo = 10,
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState(currentUrl);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const acceptedMimes = acceptedTypes
    .split(',')
    .map((t) => t.trim())
    .map((t) => {
      if (t === '.pdf') return 'application/pdf';
      if (t === '.jpg' || t === '.jpeg') return 'image/jpeg';
      if (t === '.png') return 'image/png';
      return '';
    })
    .filter(Boolean);

  const validateFile = (file) => {
    if (file.size > maxSizeMo * 1024 * 1024) {
      toast.error(`Fichier trop volumineux (max ${maxSizeMo} Mo)`);
      return false;
    }
    if (acceptedMimes.length > 0 && !acceptedMimes.includes(file.type)) {
      toast.error(`Format non accepté. Utilisez: ${acceptedTypes}`);
      return false;
    }
    return true;
  };

  const doUpload = useCallback(async (file) => {
    if (!validateFile(file)) return;
    setUploading(true);
    setProgress(0);
    try {
      const fd = new FormData();
      fd.append('fichier', file);
      const res = await axiosInstance.put(endpoint, fd, {
        // IMPORTANT: laisser le navigateur définir automatiquement
        // Content-Type: multipart/form-data; boundary=...
        // Si on force 'application/json', le boundary est absent et Multer
        // ne peut pas parser le fichier → req.file = undefined → 400
        headers: { 'Content-Type': undefined },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      const newUrl = res.data?.data?.urlBonCommande || res.data?.data?.urlBonLivraison || res.data?.data?.documentUrl || res.data?.url || null;
      setUrl(newUrl);
      toast.success('Document enregistré');
      if (onUpload) onUpload(res.data);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Erreur upload';
      toast.error(msg);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [endpoint, onUpload, maxSizeMo, acceptedTypes]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) doUpload(file);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) doUpload(file);
  };

  const handleReplace = () => {
    inputRef.current?.click();
  };

  if (uploading) {
    return (
      <div
        className="rounded-xl p-6 flex flex-col items-center justify-center gap-3"
        style={{
          border: '1px solid var(--border-subtle)',
          background: 'var(--surface-raised)',
        }}
      >
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Upload en cours... {progress > 0 ? `${progress}%` : ''}
        </p>
        {progress > 0 && (
          <div className="w-full max-w-xs h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-hover)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: 'var(--color-primary)' }} />
          </div>
        )}
      </div>
    );
  }

  if (url) {
    return (
      <div
        className="rounded-xl p-4 flex items-center justify-between gap-3"
        style={{
          border: '1px solid var(--border-subtle)',
          background: 'var(--surface-raised)',
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'color-mix(in srgb, #10B981 12%, transparent)' }}
          >
            <FileCheck className="h-5 w-5" style={{ color: '#10B981' }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {label}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Document enregistré
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[var(--surface-hover)]"
            style={{ color: 'var(--color-primary)' }}
            title="Voir le document"
          >
            <Eye className="h-3.5 w-3.5" /> Voir
          </a>
          <button
            onClick={handleReplace}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[var(--surface-hover)]"
            style={{ color: 'var(--text-secondary)' }}
            title="Remplacer le document"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remplacer
          </button>
        </div>
        <input ref={inputRef} type="file" accept={acceptedTypes} className="hidden" onChange={handleFileSelect} />
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className="rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
      style={{
        border: `2px dashed ${dragOver ? 'var(--color-primary)' : 'var(--border-default)'}`,
        background: dragOver ? 'color-mix(in srgb, var(--color-primary) 5%, transparent)' : 'var(--surface-raised)',
      }}
    >
      <FileUp className="h-8 w-8" strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Glissez le fichier ici ou cliquez pour sélectionner
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {acceptedTypes.replace(/\./g, '').toUpperCase()} — max {maxSizeMo} Mo
        </p>
      </div>
      <input ref={inputRef} type="file" accept={acceptedTypes} className="hidden" onChange={handleFileSelect} />
    </div>
  );
};

export default DocumentUpload;
