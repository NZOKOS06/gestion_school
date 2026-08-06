---
description: Activer et tester le toggle thème sombre/clair + sélecteur de langue
---

## Toggle Thème (Soleil / Lune)

Le bouton est disponible dans la topbar de chaque interface (Admin, Enseignant, Parent, Caissier).

### Fonctionnement
1. Cliquer l'icône **Lune** pour passer en mode sombre
2. Cliquer l'icône **Soleil** pour revenir en mode clair
3. Le choix est persisté dans `localStorage` (`GestSchool-theme`) et survit au rechargement

### Sélecteur de Langue (Super Admin)
1. Dans le header SuperAdmin, cliquer le bouton **Globe + code langue**
2. Choisir parmi : 🇫🇷 Français / 🇬🇧 English / 🇲🇦 العربية
3. L'arabe bascule automatiquement en `dir="rtl"`

### Ajouter une nouvelle langue
1. Ouvrir `client/src/contexts/I18nContext.jsx`
2. Ajouter l'entrée dans `LANGUAGES` (code, label, flag, dir)
3. Ajouter les traductions dans l'objet `TRANSLATIONS`

### Lancer les tests E2E
```
npx playwright test --project=chromium
```
