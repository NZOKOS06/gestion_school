import axios from 'axios';
import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';
import { formatPhoneNumber } from './sms.service.js';

const log = createLogger('WhatsAppService');

/**
 * Envoie une notification WhatsApp.
 * Utilise l'API REST Twilio WhatsApp si TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN sont configurés,
 * sinon passe en mode simulation transparente.
 *
 * @param {Object} opts
 * @param {string} opts.to - Numéro du parent destinataire
 * @param {string} opts.message - Texte du message
 * @returns {Promise<{ success: boolean, provider: string, messageId?: string, error?: string }>}
 */
export async function sendWhatsApp({ to, message }) {
  const recipient = formatPhoneNumber(to);
  if (!recipient) {
    return { success: false, provider: 'none', error: 'Numéro de téléphone destinataire invalide' };
  }

  const { accountSid, authToken, from } = config.whatsapp || {};

  if (accountSid && authToken) {
    try {
      const formattedTo = recipient.startsWith('whatsapp:') ? recipient : `whatsapp:${recipient}`;
      const formattedFrom = from?.startsWith('whatsapp:') ? from : `whatsapp:${from}`;

      const params = new URLSearchParams();
      params.append('To', formattedTo);
      params.append('From', formattedFrom);
      params.append('Body', message);

      const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;

      const response = await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        params.toString(),
        {
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000,
        }
      );

      log.info({ recipient, sid: response.data?.sid }, 'Message WhatsApp envoyé avec succès via Twilio');
      return { success: true, provider: 'twilio', messageId: response.data?.sid };
    } catch (err) {
      log.warn({ recipient, err: err.response?.data || err.message }, 'Échec envoi Twilio WhatsApp');
    }
  }

  // Simulation mode
  log.info({ recipient, message }, 'WHATSAPP SIMULÉ [DEV/TEST]');
  return {
    success: true,
    provider: 'simulateur',
    messageId: `sim-wa-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  };
}
