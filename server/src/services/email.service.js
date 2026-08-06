import nodemailer from 'nodemailer';
import axios from 'axios';
import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('EmailService');

const hasSmtpConfig = () => {
  return config.smtp.host && config.smtp.user && config.smtp.pass;
};

const hasBrevoConfig = () => {
  return !!config.brevo.apiKey;
};

const parseSender = (from) => {
  const match = from?.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { name: '', email: from || 'noreply@gestschool.local' };
};

const sendEmailViaBrevoApi = async ({ to, subject, html, text }) => {
  const sender = parseSender(config.smtp.from);
  const response = await axios.post(
    'https://api.brevo.com/v3/smtp/email',
    {
      sender,
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    },
    {
      headers: {
        'api-key': config.brevo.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );
  return { messageId: response.data?.messageId, provider: 'brevo-api' };
};

const createTransporter = () => {
  if (!hasSmtpConfig()) {
    return null;
  }

  // Configuration optimisée pour Brevo / SMTP relais
  const transport = nodemailer.createTransport({
    pool: true,
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    requireTLS: !config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
    tls: {
      rejectUnauthorized: true,
    },
    maxConnections: 3,
    maxMessages: 50,
    rateDelta: 1000,
    rateLimit: 5,
  });

  return transport;
};

let transporter = null;

export const getTransporter = () => {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
};

export const verifySmtpConnection = async () => {
  // Vérifier d'abord l'API Brevo (HTTP, pas de port bloqué)
  if (hasBrevoConfig()) {
    try {
      await axios.get('https://api.brevo.com/v3/account', {
        headers: { 'api-key': config.brevo.apiKey },
        timeout: 10000,
      });
      log.info('Connexion API Brevo vérifiée avec succès');
      return { ready: true, provider: 'brevo-api' };
    } catch (error) {
      const status = error.response?.status;
      let reason = error.message;
      if (status === 401) reason = 'Clé API Brevo invalide (401)';
      if (status === 403) reason = 'Clé API Brevo sans permission (403)';
      log.error({ err: error }, 'Échec de la vérification API Brevo');
      return { ready: false, reason, provider: 'brevo-api' };
    }
  }

  const t = getTransporter();
  if (!t) {
    return { ready: false, reason: 'Configuration SMTP manquante' };
  }
  try {
    await t.verify();
    log.info('Connexion SMTP vérifiée avec succès');
    return { ready: true, provider: 'smtp' };
  } catch (error) {
    log.error({ err: error }, 'Échec de la vérification SMTP');
    return { ready: false, reason: error.message, provider: 'smtp' };
  }
};

const sendEmail = async ({ to, subject, html, text }) => {
  if (!to || !subject) {
    throw new Error('Destinataire et sujet requis');
  }

  // 1. En production, privilégier l'API Brevo (HTTP) car le port SMTP est souvent bloqué
  if (hasBrevoConfig()) {
    try {
      const info = await sendEmailViaBrevoApi({ to, subject, html, text });
      log.info(`Email envoyé via Brevo API à ${to}: ${info.messageId}`);
      return info;
    } catch (error) {
      log.error({ err: error, to, subject }, 'Échec envoi Brevo API, tentative SMTP fallback');
      // fallback vers SMTP si configuré
    }
  }

  const t = getTransporter();
  if (!t) {
    if (config.nodeEnv === 'development') {
      log.info(`[EMAIL DEV] À: ${to}, Sujet: ${subject}`);
      log.info(`[EMAIL DEV] Texte: ${text || html}`);
      return { messageId: 'dev-mode', preview: text || html };
    }
    throw new Error('Configuration email manquante (Brevo API ou SMTP)');
  }

  try {
    const info = await t.sendMail({
      from: config.smtp.from,
      to,
      subject,
      text,
      html,
    });

    log.info(`Email envoyé via SMTP à ${to}: ${info.messageId}`);
    return { ...info, provider: 'smtp' };
  } catch (error) {
    log.error({ err: error, to, subject }, 'Échec de l\'envoi d\'email');
    throw error;
  }
};

export const sendPasswordResetEmail = async ({ to, resetUrl, nomApp = 'GestSchool' }) => {
  const subject = `Réinitialisation de votre mot de passe ${nomApp}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">Réinitialisation de mot de passe</h2>
      <p>Vous avez demandé à réinitialiser votre mot de passe pour <strong>${nomApp}</strong>.</p>
      <p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien est valable 1 heure.</p>
      <a href="${resetUrl}" style="display: inline-block; background: #16a34a; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
        Réinitialiser mon mot de passe
      </a>
      <p style="color: #6b7280; font-size: 14px;">
        Si vous n'êtes pas à l'origine de cette demande, ignorez cet email. Votre mot de passe reste sécurisé.
      </p>
      <p style="color: #6b7280; font-size: 12px;">
        Lien direct : ${resetUrl}
      </p>
    </div>
  `;
  const text = `Réinitialisation de mot de passe pour ${nomApp}.\n\nCliquez sur ce lien pour réinitialiser votre mot de passe (valable 1 heure) : ${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`;

  return sendEmail({ to, subject, html, text });
};

export const sendStaffWelcomeEmail = async ({ to, password, loginUrl, nomApp = 'GestSchool', tenantName = '' }) => {
  const displayName = tenantName || nomApp;
  const subject = `Votre compte ${displayName} a été créé`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">Bienvenue sur ${displayName}</h2>
      <p>Un compte a été créé pour vous sur <strong>${displayName}</strong>.</p>
      <p>Voici vos identifiants de connexion provisoires :</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0;"><strong>Email :</strong> ${to}</p>
        <p style="margin: 8px 0 0;"><strong>Mot de passe provisoire :</strong> ${password}</p>
      </div>
      <p>Cliquez sur le bouton ci-dessous pour vous connecter. Vous devrez changer votre mot de passe à la première connexion.</p>
      <a href="${loginUrl}" style="display: inline-block; background: #16a34a; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
        Se connecter
      </a>
      <p style="color: #6b7280; font-size: 14px;">
        Si vous n'êtes pas à l'origine de cette création de compte, contactez votre administrateur.
      </p>
    </div>
  `;
  const text = `Bienvenue sur ${displayName}.\n\nUn compte a été créé pour vous.\n\nEmail : ${to}\nMot de passe provisoire : ${password}\n\nConnectez-vous ici : ${loginUrl}\n\nVous devrez changer votre mot de passe à la première connexion.`;

  return sendEmail({ to, subject, html, text });
};

export const sendEmailVerificationEmail = async ({ to, verificationUrl, nomApp = 'GestSchool' }) => {
  const subject = `Vérifiez votre adresse email ${nomApp}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">Confirmez votre email</h2>
      <p>Merci d'utiliser <strong>${nomApp}</strong>.</p>
      <p>Cliquez sur le bouton ci-dessous pour vérifier votre adresse email. Ce lien est valable 24 heures.</p>
      <a href="${verificationUrl}" style="display: inline-block; background: #16a34a; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
        Vérifier mon email
      </a>
      <p style="color: #6b7280; font-size: 14px;">
        Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
      </p>
      <p style="color: #6b7280; font-size: 12px;">
        Lien direct : ${verificationUrl}
      </p>
    </div>
  `;
  const text = `Confirmez votre email pour ${nomApp}.\n\nCliquez sur ce lien pour vérifier votre adresse email (valable 24 heures) : ${verificationUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`;

  return sendEmail({ to, subject, html, text });
};

export const sendPasswordChangedEmail = async ({ to, nomApp = 'GestSchool', changedAt = new Date() }) => {
  const dateStr = changedAt.toLocaleString('fr-FR');
  const subject = `Votre mot de passe ${nomApp} a été modifié`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">Mot de passe modifié</h2>
      <p>Votre mot de passe <strong>${nomApp}</strong> a été modifié le <strong>${dateStr}</strong>.</p>
      <p>Si vous êtes à l'origine de cette modification, aucune action n'est requise.</p>
      <p style="color: #dc2626;"><strong>Si vous n'êtes pas à l'origine de cette modification, contactez immédiatement votre administrateur.</strong></p>
      <p style="color: #6b7280; font-size: 14px;">
        Cet email est envoyé automatiquement pour la sécurité de votre compte.
      </p>
    </div>
  `;
  const text = `Votre mot de passe ${nomApp} a été modifié le ${dateStr}.\n\nSi vous êtes à l'origine de cette modification, aucune action n'est requise.\n\nSi vous n'êtes pas à l'origine de cette modification, contactez immédiatement votre administrateur.`;

  return sendEmail({ to, subject, html, text });
};

export const sendNewDeviceLoginEmail = async ({ to, nomApp = 'GestSchool', ipAddress, userAgent, loginAt = new Date() }) => {
  const dateStr = loginAt.toLocaleString('fr-FR');
  const ua = userAgent || 'Navigateur inconnu';
  const ip = ipAddress || 'IP inconnue';
  const subject = `Nouvelle connexion détectée sur ${nomApp}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">Nouvelle connexion détectée</h2>
      <p>Une nouvelle connexion a été détectée sur votre compte <strong>${nomApp}</strong> :</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0;"><strong>Date :</strong> ${dateStr}</p>
        <p style="margin: 8px 0 0;"><strong>IP :</strong> ${ip}</p>
        <p style="margin: 8px 0 0;"><strong>Appareil / navigateur :</strong> ${ua}</p>
      </div>
      <p>Si c'est bien vous, aucune action n'est requise.</p>
      <p style="color: #dc2626;"><strong>Si ce n'est pas vous, changez immédiatement votre mot de passe et contactez votre administrateur.</strong></p>
    </div>
  `;
  const text = `Nouvelle connexion détectée sur ${nomApp}.\n\nDate : ${dateStr}\nIP : ${ip}\nAppareil / navigateur : ${ua}\n\nSi c'est bien vous, aucune action n'est requise. Si ce n'est pas vous, changez immédiatement votre mot de passe.`;

  return sendEmail({ to, subject, html, text });
};

export const sendAccountDeactivatedEmail = async ({ to, nomApp = 'GestSchool', deactivatedAt = new Date(), reason = '' }) => {
  const dateStr = deactivatedAt.toLocaleString('fr-FR');
  const subject = `Votre compte ${nomApp} a été désactivé`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Compte désactivé</h2>
      <p>Votre compte <strong>${nomApp}</strong> a été désactivé le <strong>${dateStr}</strong>.</p>
      ${reason ? `<p><strong>Motif :</strong> ${reason}</p>` : ''}
      <p>Si vous pensez qu'il s'agit d'une erreur, contactez votre administrateur.</p>
    </div>
  `;
  const text = `Votre compte ${nomApp} a été désactivé le ${dateStr}.\n${reason ? `Motif : ${reason}\n` : ''}Si vous pensez qu'il s'agit d'une erreur, contactez votre administrateur.`;

  return sendEmail({ to, subject, html, text });
};

export const sendRelanceEcheance = async ({
  to,
  nomApp = 'GestSchool',
  eleveNom = '',
  libelle = '',
  montantReste = 0,
  devise = 'FCFA',
  dateEcheance,
}) => {
  const dateStr = dateEcheance ? new Date(dateEcheance).toLocaleDateString('fr-FR') : '—';
  const montantStr = Number(montantReste).toLocaleString('fr-FR');
  const subject = `Relance de paiement — ${nomApp}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #b45309;">Relance de scolarité</h2>
      <p>Cher parent,</p>
      <p>Nous vous rappelons qu'une échéance relative à <strong>${eleveNom}</strong> est en retard ou arrive à échéance.</p>
      <ul>
        <li><strong>Échéance :</strong> ${libelle}</li>
        <li><strong>Date limite :</strong> ${dateStr}</li>
        <li><strong>Reste à payer :</strong> ${montantStr} ${devise}</li>
      </ul>
      <p>Merci de régulariser auprès de la caisse de l'établissement.</p>
      <p style="color:#666;font-size:12px;">Message automatique — ${nomApp}</p>
    </div>
  `;
  const text = `Relance ${nomApp}\nÉlève: ${eleveNom}\nÉchéance: ${libelle}\nDate: ${dateStr}\nReste: ${montantStr} ${devise}`;

  return sendEmail({ to, subject, html, text });
};

export default {
  sendEmail,
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
  sendPasswordChangedEmail,
  sendNewDeviceLoginEmail,
  sendAccountDeactivatedEmail,
  sendRelanceEcheance,
  sendStaffWelcomeEmail,
};
