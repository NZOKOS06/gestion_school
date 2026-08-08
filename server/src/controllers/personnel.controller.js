import bcrypt from 'bcryptjs';
import { prisma, rawPrisma } from '../utils/prisma.js';
import { logAudit } from '../utils/auditLogger.js';
import { sendStaffWelcomeEmail, sendAccountDeactivatedEmail, sendPasswordChangedEmail } from '../services/email.service.js';
import { buildTenantUrl } from '../utils/tenantUrl.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('PersonnelController');

export const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 100, search, role, actif } = req.query;
    const tenantId = req.tenantId;

    const where = { tenantId };
    if (actif === 'true' || actif === 'false') {
      where.actif = actif === 'true';
    }
    // actif omitted or 'all' → no filter

    if (role) where.role = role;

    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { prenom: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const take = Math.min(parseInt(limit) || 100, 500);
    const skip = (parseInt(page) - 1) * take;

    const [staff, total] = await Promise.all([
      prisma.staff.findMany({
        where,
        select: {
          id: true,
          email: true,
          role: true,
          nom: true,
          prenom: true,
          telephone: true,
          actif: true,
          mustChangePassword: true,
          derniereConnexion: true,
          typeContrat: true,
          heuresHebdo: true,
          tauxHoraire: true,
          createdAt: true
        },
        skip,
        take,
        orderBy: { nom: 'asc' }
      }),
      prisma.staff.count({ where })
    ]);

    res.json({
      staff,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    console.error('[PersonnelController] getAll error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getEnseignants = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const enseignants = await prisma.staff.findMany({
      where: { tenantId, role: 'enseignant' },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        actif: true,
        typeContrat: true,
        enseignantClasses: {
          include: {
            classe: { select: { id: true, nom: true, cycle: true, niveau: true } },
            matiere: { select: { id: true, nom: true, code: true } },
          },
        },
      },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    });

    res.json(enseignants);
  } catch (error) {
    console.error('[PersonnelController] getEnseignants error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const staff = await prisma.staff.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        email: true,
        role: true,
        nom: true,
        prenom: true,
        telephone: true,
        actif: true,
        mustChangePassword: true,
        derniereConnexion: true,
        typeContrat: true,
        heuresHebdo: true,
        tauxHoraire: true,
        createdAt: true
      }
    });

    if (!staff) {
      return res.status(404).json({ error: 'Staff non trouvé' });
    }

    res.json(staff);
  } catch (error) {
    console.error('[PersonnelController] getById error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const { email, nom, prenom, role, telephone, typeContrat, heuresHebdo, tauxHoraire } = req.body;
    const tenantId = req.tenantId;

    const existant = await prisma.staff.findFirst({
      where: { email, tenantId }
    });

    if (existant) {
      return res.status(409).json({ error: 'Email déjà utilisé' });
    }

    const tempPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const staff = await prisma.staff.create({
      data: {
        tenantId,
        email,
        passwordHash,
        nom,
        prenom,
        role,
        telephone,
        typeContrat: typeContrat || 'titulaire',
        heuresHebdo: heuresHebdo ? parseInt(heuresHebdo) : null,
        tauxHoraire: tauxHoraire ? parseFloat(tauxHoraire) : null,
        mustChangePassword: true
      },
      select: {
        id: true,
        email: true,
        role: true,
        nom: true,
        prenom: true,
        telephone: true,
        actif: true,
        mustChangePassword: true,
        typeContrat: true,
        heuresHebdo: true,
        tauxHoraire: true,
        createdAt: true
      }
    });

    // Enregistrer dans les logs d'audit
    await logAudit(req, 'staff_created', 'Staff', staff.id, {
      email: staff.email,
      role: staff.role,
      name: `${staff.prenom} ${staff.nom}`
    });

    // Envoyer l'email de création de compte
    try {
      const tenant = req.tenant;
      const nomApp = tenant?.config?.nomApp || tenant?.nom || 'GestSchool';
      const loginUrl = buildTenantUrl(tenant, { path: '/login' });
      await sendStaffWelcomeEmail({
        to: email,
        password: tempPassword,
        loginUrl,
        nomApp,
        tenantName: tenant?.nom
      });
    } catch (emailError) {
      console.error('[PersonnelController] Failed to send welcome email:', emailError);
      // L'email est non bloquant : le compte est créé même si l'envoi échoue
    }

    res.status(201).json({ ...staff, motDePasseProvisoire: tempPassword });
  } catch (error) {
    console.error('[PersonnelController] create error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const isSelf = req.user.id === id;
    const isAdmin = ['directeur', 'secretaire'].includes(req.user.role);

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'Action non autorisée' });
    }

    // Whitelist des champs modifiables — protège contre le mass assignment
    const { nom, prenom, email, telephone, role, actif, typeContrat, heuresHebdo, tauxHoraire } = req.body;
    let data;
    if (isSelf && !isAdmin) {
      // Self-profile: identity fields only
      data = Object.fromEntries(
        Object.entries({ nom, prenom, telephone }).filter(([, v]) => v !== undefined)
      );
    } else {
      data = Object.fromEntries(
        Object.entries({
          nom, prenom, email, telephone, role, actif,
          typeContrat: typeContrat !== undefined ? typeContrat : undefined,
          heuresHebdo: heuresHebdo !== undefined ? (heuresHebdo ? parseInt(heuresHebdo) : null) : undefined,
          tauxHoraire: tauxHoraire !== undefined ? (tauxHoraire ? parseFloat(tauxHoraire) : null) : undefined,
        }).filter(([, v]) => v !== undefined)
      );
    }

    const staff = await prisma.staff.findFirst({
      where: { id, tenantId }
    });

    if (!staff) {
      return res.status(404).json({ error: 'Staff non trouvé' });
    }

    if (data.email && data.email !== staff.email) {
      const existant = await prisma.staff.findFirst({
        where: { email: data.email, tenantId, id: { not: id } }
      });
      if (existant) {
        return res.status(409).json({ error: 'Email déjà utilisé' });
      }
    }

    const updated = await prisma.staff.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        role: true,
        nom: true,
        prenom: true,
        telephone: true,
        actif: true,
        mustChangePassword: true,
        derniereConnexion: true,
        typeContrat: true,
        heuresHebdo: true,
        tauxHoraire: true,
        updatedAt: true
      }
    });

    // Enregistrer dans les logs d'audit
    const auditDetails = {
      email: updated.email,
      name: `${updated.prenom} ${updated.nom}`,
      role: updated.role,
      actif: updated.actif
    };

    if (staff.role !== updated.role) {
      // Log spécifique pour changement de rôle
      await logAudit(req, 'staff_role_changed', 'Staff', updated.id, {
        ...auditDetails,
        oldRole: staff.role,
        newRole: updated.role
      });
    } else {
      // Log standard de mise à jour
      await logAudit(req, 'staff_updated', 'Staff', updated.id, auditDetails);
    }

    res.json(updated);
  } catch (error) {
    console.error('[PersonnelController] update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const staff = await prisma.staff.findFirst({
      where: { id, tenantId }
    });

    if (!staff) {
      return res.status(404).json({ error: 'Staff non trouvé' });
    }

    const tempPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await prisma.staff.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true }
    });

    // Enregistrer dans les logs d'audit
    await logAudit(req, 'password_changed', 'Staff', staff.id, {
      email: staff.email,
      name: `${staff.prenom} ${staff.nom}`,
      role: staff.role,
      actionType: 'reset_by_admin'
    });

    // Notifier le staff par email
    if (staff.email) {
      try {
        const tenantConfig = req.tenant?.config;
        const nomApp = tenantConfig?.nomApp || req.tenant?.nom || 'GestSchool';
        const loginUrl = buildTenantUrl(req.tenant?.slug, '/login');
        await sendStaffWelcomeEmail({
          to: staff.email,
          password: tempPassword,
          loginUrl,
          nomApp,
          tenantName: req.tenant?.nom || nomApp
        });
      } catch (emailError) {
        log.error({ err: emailError, email: staff.email }, 'Failed to send reset password email to staff');
      }
    }

    res.json({ message: 'Mot de passe réinitialisé', motDePasseProvisoire: tempPassword });
  } catch (error) {
    log.error({ err: error }, 'resetPassword error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const currentUser = req.user;

    if (id === currentUser.id) {
      return res.status(400).json({ error: 'Impossible de se désactiver soi-même' });
    }

    const staff = await prisma.staff.findFirst({
      where: { id, tenantId }
    });

    if (!staff) {
      return res.status(404).json({ error: 'Staff non trouvé' });
    }

    await prisma.staff.update({
      where: { id },
      data: { actif: false }
    });

    // Enregistrer dans les logs d'audit
    await logAudit(req, 'staff_deleted', 'Staff', staff.id, {
      email: staff.email,
      name: `${staff.prenom} ${staff.nom}`,
      role: staff.role
    });

    // Envoyer un email de notification de désactivation
    try {
      const tenant = req.tenant;
      const nomApp = tenant?.config?.nomApp || tenant?.nom || 'GestSchool';
      await sendAccountDeactivatedEmail({
        to: staff.email,
        nomApp,
        deactivatedAt: new Date()
      });
    } catch (emailError) {
      console.error('[PersonnelController] Failed to send deactivated email:', emailError);
    }

    res.json({ message: 'Staff désactivé' });
  } catch (error) {
    console.error('[PersonnelController] remove error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    let profile;
    if (role === 'parent') {
      profile = await prisma.user.findUnique({
        where: { id: userId },
        include: { tenant: { include: { config: true } }, enfants: { select: { id: true, matricule: true, nom: true, prenom: true } } }
      });
    } else if (role === 'super_admin') {
      profile = await rawPrisma.staff.findUnique({
        where: { id: userId },
        include: { tenant: { include: { config: true } } }
      });
    } else {
      profile = await prisma.staff.findUnique({
        where: { id: userId },
        include: { tenant: { include: { config: true } } }
      });
    }

    res.json(profile);
  } catch (error) {
    console.error('[PersonnelController] getMe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
