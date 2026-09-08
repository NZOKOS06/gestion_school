import axios from 'axios';
import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('SmsService');

/**
 * Normalise un numéro de téléphone en format international E.164.
 * Supporte les formats courants d'Afrique centrale (Congo +242, RDC +243, Cameroun +237, CI +225, etc.)
 */
export function formatPhoneNumber(rawPhone, defaultIndicatif = '242') {
  if (!rawPhone) return null;
  let cleaned = String(rawPhone).replace(/[\s\.\-\(\)]/g, '');
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  if (cleaned.startsWith('00')) {
    return `+${cleaned.slice(2)}`;
  }
  // Si commence par un zéro local (ex: 069000000 -> +242069000000 ou +24269000000)
  if (cleaned.startsWith('0')) {
    return `+${defaultIndicatif}${cleaned.slice(1)}`;
  }
  // Si pas de préfixe, ajouter l'indicatif par défaut
  if (!cleaned.startsWith(defaultIndicatif)) {
    return `+${defaultIndicatif}${cleaned}`;
  }
  return `+${cleaned}`;
}

/**
 * Envoie un SMS transactionnel.
 * 1. Priorité 1 : Brevo Transactional SMS API (si BREVO_API_KEY configurée)
 * 2. Priorité 2 : Africa's Talking (si AT_API_KEY configurée)
 * 3. Fallback : Mode simulation (idéal dev / test sans coût)
 *
 * @param {Object} opts
 * @param {string} opts.to - Numéro destinataire
 * @param {string} opts.message - Contenu texte du SMS
 * @param {string} [opts.sender] - Nom d'expéditeur (max 11 caractères alphanumériques)
 * @returns {Promise<{ success: boolean, provider: string, messageId?: string, error?: string }>}
 */
export async function sendSms({ to, message, sender }) {
  const recipient = formatPhoneNumber(to);
  if (!recipient) {
    return { success: false, provider: 'none', error: 'Numéro de téléphone manquant ou invalide' };
  }

  const senderName = (sender || config.sms?.from || 'GestSchool').substring(0, 11);

  // 1. Brevo Transactional SMS
  if (config.brevo?.apiKey) {
    try {
      const response = await axios.post(
        'https://api.brevo.com/v3/transactionalSMS/send-transac-sms',
        {
          sender: senderName,
          recipient,
          content: message,
          type: 'transactional',
        },
        {
          headers: {
            'api-key': config.brevo.apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      const messageId = response.data?.messageId || response.data?.smsId;
      log.info({ recipient, messageId }, 'SMS envoyé avec succès via Brevo');
      return { success: true, provider: 'brevo', messageId: String(messageId) };
    } catch (err) {
      log.warn({ recipient, err: err.response?.data || err.message }, 'Échec envoi Brevo SMS, passage au fallback');
    }
  }

  // 2. Africa's Talking SMS (Alternative Afrique Centrale / de l'Ouest)
  if (config.sms?.africasTalking?.apiKey && config.sms?.africasTalking?.username) {
    try {
      const atUsername = config.sms.africasTalking.username;
      const atApiKey = config.sms.africasTalking.apiKey;
      const atFrom = config.sms.africasTalking.from || senderName;

      const params = new URLSearchParams();
      params.append('username', atUsername);
      params.append('to', recipient);
      params.append('message', message);
      if (atFrom) params.append('from', atFrom);

      const response = await axios.post(
        'https://api.africastalking.com/version1/messaging',
        params.toString(),
        {
          headers: {
            apiKey: atApiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          timeout: 10000,
        }
      );

      const recipientsData = response.data?.SMSMessageData?.Recipients;
      log.info({ recipient, recipientsData }, "SMS envoyé avec succès via Africa's Talking");
      return { success: true, provider: 'africas_talking', messageId: recipientsData?.[0]?.messageId };
    } catch (err) {
      log.warn({ recipient, err: err.response?.data || err.message }, "Échec envoi Africa's Talking");
    }
  }

  // 3. Simulateur Dev / Test
  log.info({ recipient, sender: senderName, messageLength: message.length, message }, 'SMS SIMULÉ [DEV/TEST]');
  return {
    success: true,
    provider: 'simulateur',
    messageId: `sim-sms-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  };
}
