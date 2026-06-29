import { verifySmtpConnection, sendPasswordResetEmail } from '../src/services/email.service.js';

const to = process.argv[2];

(async () => {
  console.log('🔍 Vérification de la connexion SMTP...');
  const status = await verifySmtpConnection();
  console.log(status);

  if (!status.ready) {
    console.error('❌ SMTP non prêt');
    process.exit(1);
  }

  if (!to) {
    console.log('ℹ️  Utilisation : node scripts/test-email.js <email-destinataire>');
    process.exit(0);
  }

  console.log(`📤 Envoi d'un email de test à ${to}...`);
  try {
    const info = await sendPasswordResetEmail({
      to,
      resetUrl: 'http://localhost:5173/reinitialiser-mot-de-passe?token=test',
      nomApp: 'GestResto'
    });
    console.log('✅ Email envoyé :', info.messageId);
  } catch (error) {
    console.error('❌ Erreur envoi :', error.message);
    process.exit(1);
  }
})();
