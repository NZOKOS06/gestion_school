import multer from 'multer';
import { createLogger } from '../utils/logger.js';

const log = createLogger('DocumentAnalyse');
const TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export const uploadMemoire = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(TYPES.includes(file.mimetype) ? null : new Error('Image PNG, JPG ou WebP uniquement'), TYPES.includes(file.mimetype)),
}).single('document');

const PROMPT = `Tu analyses un document scolaire existant (bulletin, reçu, certificat) d'une école.
Extrais l'en-tête officiel et le style. Réponds UNIQUEMENT par un JSON :
{"etat":"ligne 1 (ex. nom du pays)","devise":"ligne 2 (devise nationale)","ministere":"ligne 3 (ministère de tutelle)","formatRecu":"a4"|"thermique"}
formatRecu = "thermique" si le document est un ticket étroit de caisse, sinon "a4".
Laisse une chaîne vide pour toute valeur absente. Aucun autre texte.`;

/** POST /api/config/:slug/analyser-document — propose un modèle ; rien n'est enregistré (validation humaine côté écran). */
export const analyserDocument = async (req, res) => {
  const cle = process.env.ANTHROPIC_API_KEY;
  if (!cle) return res.status(503).json({ message: "L'analyse automatique n'est pas activée sur ce serveur (ANTHROPIC_API_KEY)" });
  if (!req.file) return res.status(400).json({ message: 'Aucune image reçue' });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': cle, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: req.file.mimetype, data: req.file.buffer.toString('base64') } },
          { type: 'text', text: PROMPT },
        ] }],
      }),
    });
    if (!r.ok) throw new Error(`API ${r.status}`);
    const texte = (await r.json())?.content?.[0]?.text || '';
    const json = JSON.parse(texte.slice(texte.indexOf('{'), texte.lastIndexOf('}') + 1));
    const txt = (x) => String(x || '').trim().slice(0, 120);
    res.json({ data: { etat: txt(json.etat), devise: txt(json.devise), ministere: txt(json.ministere), formatRecu: json.formatRecu === 'thermique' ? 'thermique' : 'a4' } });
  } catch (error) {
    log.error({ err: error }, 'analyserDocument');
    res.status(502).json({ message: "Analyse impossible, saisissez l'en-tête manuellement" });
  }
};
