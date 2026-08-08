import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('ParentsListController');

/** Liste des comptes parent du tenant (pour liaison élève). */
export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { search, limit = 200 } = req.query;
    const take = Math.min(parseInt(limit) || 200, 500);
    const where = { tenantId, actif: true };
    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { prenom: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { telephone: { contains: search, mode: 'insensitive' } },
      ];
    }
    const parents = await prisma.user.findMany({
      where,
      select: { id: true, nom: true, prenom: true, email: true, telephone: true },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
      take,
    });
    res.json({ data: parents });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get parents error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Création rapide d'un parent (admin) — mot de passe temporaire généré. */
export const create = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { nom, prenom, email, telephone } = req.body;
    if (!nom?.trim() || !prenom?.trim() || !email?.trim()) {
      return res.status(400).json({ error: 'Nom, prénom et email requis' });
    }
    const existing = await prisma.user.findFirst({
      where: { tenantId, email: email.trim().toLowerCase() },
    });
    if (existing) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }
    const tempPassword = crypto.randomBytes(4).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const parent = await prisma.user.create({
      data: {
        tenantId,
        nom: nom.trim(),
        prenom: prenom.trim(),
        email: email.trim().toLowerCase(),
        telephone: telephone?.trim() || null,
        passwordHash,
      },
      select: { id: true, nom: true, prenom: true, email: true, telephone: true },
    });
    res.status(201).json({ ...parent, temporaryPassword: tempPassword });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Create parent error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
