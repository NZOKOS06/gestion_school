import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';
import * as facturationService from '../services/facturation.service.js';

const log = createLogger('FacturationController');

/**
 * GET /api/facturation/preview
 * Prévisualisation de la facturation annuelle indexée sans persister.
 */
export const getPreview = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { anneeScolaireId, tauxIndexation, nbTranches } = req.query;

    const preview = await facturationService.previewFacturation({
      tenantId,
      anneeScolaireId,
      tauxIndexation: tauxIndexation ? parseFloat(tauxIndexation) : 0,
      nbTranches: nbTranches ? parseInt(nbTranches) : 3,
    });

    res.json(preview);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Preview facturation error');
    res.status(400).json({ error: error.message || 'Erreur lors du calcul de prévisualisation' });
  }
};

/**
 * POST /api/facturation/generer
 * Déclenchement de la génération en masse des échéances indexées.
 */
export const generer = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { anneeScolaireId, tauxIndexation = 0, nbTranches = 3 } = req.body;
    const declenchePar = req.user?.id || 'direction';

    const result = await facturationService.genererFacturation({
      tenantId,
      anneeScolaireId,
      tauxIndexation: parseFloat(tauxIndexation),
      nbTranches: parseInt(nbTranches),
      declenchePar,
    });

    await logAudit(req, 'facturation_annuelle_generer', 'FacturationJob', result.jobId || tenantId, {
      tauxIndexation,
      nbTranches,
      nbElevesFactures: result.nbElevesFactures,
      totalGenere: result.totalGenere,
    });

    res.status(201).json({
      message: 'Facturation annuelle indexée générée avec succès.',
      data: result,
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Generer facturation error');
    res.status(500).json({ error: error.message || 'Erreur lors de la génération de la facturation' });
  }
};

/**
 * GET /api/facturation/historique
 * Historique des jobs de facturation annuelle.
 */
export const getHistorique = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const historique = await facturationService.getHistoriqueFacturation(tenantId);
    res.json({ data: historique });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get historique facturation error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
