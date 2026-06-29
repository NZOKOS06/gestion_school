import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Pill, MapPin, Phone, Mail, Clock, Shield, Heart,
  Facebook, Instagram, MessageCircle, ArrowRight,
} from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { useI18n } from '../../contexts/I18nContext';

const JOURS_ORDRE = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

const Footer = () => {
  const { config } = useTenant();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const year = new Date().getFullYear();

  const nomApp = config?.nomApp || 'GestPharma';
  const slogan = config?.sloganApp || 'Votre santé, notre priorité';

  const navLinks = [
    { label: t('nav_home'), to: '/' },
    { label: t('nav_catalogue'), to: '/catalogue' },
    { label: t('btn_order'), to: '/commander' },
    { label: t('stat_delivery'), to: '/suivi' },
    { label: t('nav_login'), to: '/login' },
  ];

  const legalLinks = [
    { label: t('footer_legal'), to: '/mentions-legales' },
    { label: t('footer_privacy'), to: '/confidentialite' },
    { label: t('footer_terms'), to: '/cgu' },
  ];

  const horaires = config?.horaireOuverture
    ? JOURS_ORDRE.filter((j) => config.horaireOuverture[j])
        .map((jour) => [jour, config.horaireOuverture[jour]])
    : null;

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email) return;
    setSubscribed(true);
    setEmail('');
    setTimeout(() => setSubscribed(false), 3000);
  };

  return (
    <footer className="bg-gray-900 dark:bg-[#0A0D14] text-gray-300">
      {/* Bande CTA urgence */}
      {config?.telephone && (
        <div
          className="border-b"
          style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'color-mix(in srgb, var(--color-primary) 8%, #0A0D14)' }}
        >
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'color-mix(in srgb, var(--color-primary) 20%, transparent)' }}
              >
                <Heart className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{t('footer_emergency')}</p>
                <p className="text-xs text-gray-400">{config.nom || nomApp}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`tel:${config.telephone}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white transition-all hover:shadow-lg"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <Phone className="h-4 w-4" />
                {t('footer_call_now')}
              </a>
              <a
                href={`https://wa.me/${config.telephone?.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white transition-all hover:shadow-lg"
                style={{ backgroundColor: '#25D366' }}
              >
                <MessageCircle className="h-4 w-4" />
                {t('footer_whatsapp')}
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Colonne 1 — Identité + Newsletter */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              {config?.logoUrl ? (
                <img src={config.logoUrl} alt={nomApp} className="h-9 w-9 object-contain" />
              ) : (
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: 'var(--color-primary)' }}
                >
                  <Pill size={18} className="text-white" />
                </div>
              )}
              <span className="text-white font-bold text-lg">{nomApp}</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed mb-5 max-w-xs">{slogan}</p>

            {/* Newsletter */}
            <div className="mb-5">
              <p className="text-sm font-medium text-white mb-1.5">{t('footer_newsletter')}</p>
              <p className="text-xs text-gray-500 mb-3">{t('footer_newsletter_desc')}</p>
              {subscribed ? (
                <p className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
                  ✓ {t('footer_subscribe')} ✓
                </p>
              ) : (
                <form onSubmit={handleSubscribe} className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('footer_email_placeholder')}
                    className="flex-1 px-3 py-2 text-sm rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-lg text-white transition-all hover:shadow-md"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                    aria-label={t('footer_subscribe')}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              )}
            </div>

            {/* Réseaux sociaux */}
            <div className="flex items-center gap-3">
              {[
                { icon: Facebook, href: config?.facebookUrl || null, label: 'Facebook' },
                { icon: Instagram, href: config?.instagramUrl || null, label: 'Instagram' },
                { icon: MessageCircle, href: config?.whatsappUrl || (config?.telephone ? `https://wa.me/${config.telephone.replace(/[^0-9]/g, '')}` : null), label: 'WhatsApp' },
                { icon: MessageCircle, href: config?.telegramUrl || null, label: 'Telegram' },
              ].filter(s => s.href).map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="h-9 w-9 rounded-lg flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all"
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Colonne 2 — Navigation */}
          <div>
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-5">
              {t('nav_home') === 'Accueil' ? 'Navigation' : 'Navigation'}
            </h3>
            <ul className="space-y-3">
              {navLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-sm text-gray-400 hover:text-white transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Colonne 3 — Horaires */}
          <div>
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-5 flex items-center gap-2">
              <Clock className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
              {t('footer_hours')}
            </h3>
            <div className="space-y-2">
              {horaires ? (
                horaires.map(([jour, h]) => {
                  const ferme = /ferm/i.test(h);
                  return (
                    <div key={jour} className="flex justify-between text-sm">
                      <span className="text-gray-400 capitalize">{jour}</span>
                      {ferme ? (
                        <span className="text-red-400 text-xs">{t('closed_today')}</span>
                      ) : (
                        <span className="text-gray-300 font-mono text-xs">{h}</span>
                      )}
                    </div>
                  );
                })
              ) : (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Lun – Ven</span>
                    <span className="font-mono text-xs text-gray-300">8h – 18h</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Samedi</span>
                    <span className="font-mono text-xs text-gray-300">8h – 13h</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Dimanche</span>
                    <span className="text-red-400 text-xs">{t('closed_today')}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Colonne 4 — Contact */}
          <div>
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-5">
              {t('footer_contact')}
            </h3>
            <div className="space-y-3">
              {config?.adresse && (
                <a
                  href={config.googleMapsUrl || `https://maps.google.com/?q=${encodeURIComponent(config.adresse)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 text-sm text-gray-400 hover:text-white transition-colors group"
                >
                  <MapPin size={16} className="mt-0.5 flex-shrink-0 group-hover:text-green-400" />
                  <span>{config.adresse}</span>
                </a>
              )}
              {config?.telephone && (
                <a
                  href={`tel:${config.telephone}`}
                  className="flex items-center gap-3 text-sm text-gray-400 hover:text-white transition-colors group"
                >
                  <Phone size={16} className="flex-shrink-0 group-hover:text-green-400" />
                  <span>{config.telephone}</span>
                </a>
              )}
              {config?.email && (
                <a
                  href={`mailto:${config.email}`}
                  className="flex items-center gap-3 text-sm text-gray-400 hover:text-white transition-colors group"
                >
                  <Mail size={16} className="flex-shrink-0 group-hover:text-green-400" />
                  <span>{config.email}</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Trust badges */}
        <div className="mt-12 pt-8 border-t border-gray-800">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              {config?.numeroAutorisation && (
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                  <span className="text-xs text-gray-400">
                    {t('footer_auth_number')} : {config.numeroAutorisation}
                  </span>
                </div>
              )}
              {config?.nomPharmacien && (
                <div className="flex items-center gap-2">
                  <Pill className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                  <span className="text-xs text-gray-400">
                    {config.nomPharmacien}
                  </span>
                </div>
              )}
            </div>

            {/* Liens légaux */}
            <div className="flex items-center gap-4">
              {legalLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Barre de bas de page */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            © {year} {nomApp}. {t('footer_rights_reserved')}
          </p>
          <p className="text-xs text-gray-600">
            {t('footer_powered_by')}{' '}
            <span style={{ color: 'var(--color-primary)' }} className="font-medium">
              GestPharma
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
