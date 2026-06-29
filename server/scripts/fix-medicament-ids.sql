-- Script pour corriger les IDs de médicaments corrompus
-- Ce script génère de nouveaux UUIDs pour les médicaments dont l'ID contient autre chose qu'un UUID valide

-- D'abord, identifier les médicaments avec des IDs corrompus
SELECT id, dci, "nomCommercial" 
FROM "Medicament" 
WHERE id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Pour corriger, vous devez exécuter les commandes suivantes pour chaque médicament corrompu
-- Remplacez OLD_ID par l'ID corrompu et NEW_ID par un nouvel UUID généré

-- Exemple de commande pour un médicament spécifique:
-- UPDATE "Medicament" SET id = 'nouvel-uuid-ici' WHERE id = 'ancien-id-corrompu';

-- Note: Prisma ne permet pas de mettre à jour l'ID directement.
-- Vous devrez peut-être supprimer et recréer les enregistrements avec les bons IDs.
