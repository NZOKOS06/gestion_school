import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { FraisError } from '../services/fraisInscription.service.js';
import {
  SERVICES_SUGGERES,
  normaliserService,
  serviceApplicable,
} from '../services/servicesOptionnels.service.js';

const log = createLogger('ServicesOptionnelsController');

const handleError = (res, error, msg, req) => {
  if (error instanceof FraisError) return res.status(error.status).json({ error: error.message });
  if (error?.code === 'P2002') return res.status(409).json({ error: 'Un service porte déjà ce nom' });
  log.error({ err: error, tenantId: req.tenantId }, msg);
  return res.status(500).json({ error: 'Internal server error' });
};

/** GET /api/services-optionnels?classeId=&actifs=1 */
export const list = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const where = { tenantId };
    if (req.query.actifs) where.actif = true;
    let services = await prisma.serviceOptionnel.findMany({
      where,
      orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
      include: { _count: { select: { souscriptions: { where: { actif: true } } } } },
    });
    if (req.query.classeId) {
      const classe = await prisma.classe.findFirst({ where: { id: req.query.classeId, tenantId } });
      services = services.filter((s) => serviceApplicable(s, classe));
    }
    res.json({
      data: services.map(({ _count, ...s }) => ({ ...s, nbSouscriptions: _count?.souscriptions || 0 })),
      suggestions: SERVICES_SUGGERES,
    });
  } catch (error) {
    handleError(res, error, 'List services error', req);
  }
};

export const create = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const data = normaliserService(req.body);
    const service = await prisma.serviceOptionnel.create({ data: { tenantId, ...data } });
    await logAudit(req, 'service_optionnel_created', 'ServiceOptionnel', service.id, { nom: service.nom, tarif: data.tarif });
    res.status(201).json(service);
  } catch (error) {
    handleError(res, error, 'Create service error', req);
  }
};

/** Le nouveau tarif ne s'applique qu'aux nouvelles souscriptions (tarifs figés). */
export const update = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const existing = await prisma.serviceOptionnel.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Service introuvable' });
    const data = normaliserService(req.body, { partiel: true });
    const service = await prisma.serviceOptionnel.update({ where: { id: existing.id }, data });
    await logAudit(req, 'service_optionnel_updated', 'ServiceOptionnel', service.id, data);
    res.json(service);
  } catch (error) {
    handleError(res, error, 'Update service error', req);
  }
};

/** Suppression : définitive si jamais souscrit, sinon simple désactivation (historique conservé). */
export const remove = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const existing = await prisma.serviceOptionnel.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Service introuvable' });
    const nb = await prisma.souscriptionService.count({ where: { tenantId, serviceId: existing.id } });
    if (nb > 0) {
      await prisma.serviceOptionnel.update({ where: { id: existing.id }, data: { actif: false } });
      await logAudit(req, 'service_optionnel_desactive', 'ServiceOptionnel', existing.id, { nom: existing.nom });
      return res.json({ message: 'Service désactivé (des élèves y ont souscrit, l\'historique est conservé)', desactive: true });
    }
    await prisma.serviceOptionnel.delete({ where: { id: existing.id } });
    await logAudit(req, 'service_optionnel_deleted', 'ServiceOptionnel', existing.id, { nom: existing.nom });
    res.json({ message: 'Service supprimé' });
  } catch (error) {
    handleError(res, error, 'Delete service error', req);
  }
};
