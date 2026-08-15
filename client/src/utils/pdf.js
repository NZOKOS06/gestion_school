import axiosInstance from './axios';
import toast from 'react-hot-toast';

/**
 * Ouvre un PDF authentifié (cookies + tenant) dans un nouvel onglet.
 */
export async function openPdf(url, filename = 'document.pdf') {
  try {
    const res = await axiosInstance.get(url, { responseType: 'blob' });
    const contentType = res.headers?.['content-type'] || '';
    if (contentType.includes('application/json')) {
      toast.error('Impossible d’ouvrir le PDF');
      return false;
    }
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const objectUrl = URL.createObjectURL(blob);
    const tab = window.open(objectUrl, '_blank');
    if (!tab) {
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return true;
  } catch {
    toast.error('Impossible d’ouvrir le PDF');
    return false;
  }
}
