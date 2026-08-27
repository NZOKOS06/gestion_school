# Intégration biométrique — pointage enseignant (V2)

GestSchool expose un contrat HTTP unique pour les lecteurs d'empreinte (ZKTeco, Anviz, etc.).  
Le pointage manuel (surveillant) et le pointage biométrique partagent le même modèle `PointageSession`.

## Prérequis

1. Module **Pointage personnel** activé sur le tenant (`modulePointagePersonnel`).
2. Emploi du temps renseigné pour les créneaux du jour.
3. Chaque enseignant possède un `deviceBiometricId` (identifiant utilisateur sur le terminal).
4. Variable d'environnement `POINTAGE_DEVICE_TOKEN` définie sur l'API.

## Endpoint

```
POST /api/pointage/device/scan
```

### Headers

| Header | Obligatoire | Description |
|--------|-------------|-------------|
| `X-Tenant-Slug` | oui | Slug de l'école (ex. `demo`) |
| `X-Pointage-Device-Token` | oui | Token partagé avec le lecteur |
| `Content-Type` | oui | `application/json` |

Le token peut aussi être envoyé dans le corps : `{ "deviceToken": "..." }`.

### Corps JSON

```json
{
  "deviceId": "zkteco-001",
  "biometricUserId": "101",
  "event": "arrivee",
  "at": "2026-08-26T08:02:00.000Z"
}
```

| Champ | Description |
|-------|-------------|
| `biometricUserId` | Correspond à `Staff.deviceBiometricId` |
| `event` | `arrivee` ou `depart` |
| `at` | Horodatage ISO (optionnel, défaut = maintenant) |
| `deviceId` | Identifiant libre du terminal (audit) |

### Réponses

- **200** — scan accepté, session mise à jour
- **401** — token device invalide
- **404** — enseignant ou session EDT introuvable
- **400** — départ sans arrivée préalable

## Résolution automatique

1. Recherche du staff par `deviceBiometricId`.
2. Génération lazy des sessions du jour depuis l'EDT si nécessaire.
3. Sélection du créneau le plus proche de l'horodatage.
4. Même pipeline que le pointage manuel (`sourceArrivee` / `sourceDepart` = `biometrique`).

## Exemple cURL

```bash
curl -X POST "https://gestschool-api.onrender.com/api/pointage/device/scan" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: demo" \
  -H "X-Pointage-Device-Token: $POINTAGE_DEVICE_TOKEN" \
  -d '{"deviceId":"zk-1","biometricUserId":"101","event":"arrivee"}'
```

## Phase ultérieure

- Webhook push depuis le firmware du lecteur
- Import CSV mode dégradé hors-ligne
- Journal d'audit des scans par `deviceId`
