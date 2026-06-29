
---
description: Activer et tester le toggle thème sombre/clair + sélecteur de langue
---

## Toggle Thème (Soleil / Lune)

Le bouton est disponible dans la topbar de chaque interface (Admin, Staff, Caissier).

### Fonctionnement
1. Cliquer l'icône **Lune** pour passer en mode sombre → fond `#0d1117` (GitHub Dark)
2. Cliquer l'icône **Soleil** pour revenir en mode clair
3. Le choix est persisté dans `localStorage` (`gestpharma_theme`) et survit au rechargement

### Sélecteur de Langue (Super Admin uniquement)
1. Dans le header SuperAdminPanel, cliquer le bouton **Globe + code langue**
2. Choisir parmi : 🇫🇷 Français / 🇬🇧 English / 🇲🇦 العربية
3. L'arabe bascule automatiquement en `dir="rtl"`
4. Le choix est persisté dans `localStorage` (`gestpharma_lang`)

### Ajouter une nouvelle langue
1. Ouvrir `client/src/contexts/I18nContext.jsx`
2. Ajouter l'entrée dans `LANGUAGES` (code, label, flag, dir)
3. Ajouter les traductions dans l'objet `TRANSLATIONS`

### Étendre les traductions aux autres layouts
1. Importer `useI18n` dans le layout cible
2. Récupérer `const { t } = useI18n()`
3. Remplacer les chaînes par `{t('clé')}`

### Lancer les tests E2E
```
npx playwright test --project=chromium
```
