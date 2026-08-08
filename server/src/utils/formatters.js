// Formatage des dates (JJ/MM/AAAA)
export const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export const formatDateTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Formatage monétaire (espace comme séparateur milliers)
export const formatMontant = (montant, devise = 'FCFA') => {
  if (montant === null || montant === undefined) return '-';
  const num = typeof montant === 'string' ? parseFloat(montant) : montant;
  const formatted = Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} ${devise}`;
};

// Formatage du numéro de vente (ex: V-000001)
export const formatNumeroVente = (numero) => {
  return `V-${numero.toString().padStart(6, '0')}`;
};

// Formatage du numéro de commande (ex: CF-2024-000001)
export const formatNumeroCommande = (tenantId, numero) => {
  const annee = new Date().getFullYear();
  return `CF-${annee}-${numero.toString().padStart(6, '0')}`;
};

// Formatage du téléphone (Congo)
export const formatTelephone = (tel) => {
  if (!tel) return '';
  // Format: +242 XX XXX XXXX ou 0X XX XX XX XX
  const cleaned = tel.replace(/\s/g, '');
  if (cleaned.startsWith('+242')) {
    return cleaned.replace(/(\+242)(\d{2})(\d{3})(\d{4})/, '$1 $2 $3 $4');
  }
  if (cleaned.startsWith('0')) {
    return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
  }
  return tel;
};

// Calcul de l'âge
export const calculerAge = (dateNaissance) => {
  if (!dateNaissance) return null;
  const today = new Date();
  const birth = new Date(dateNaissance);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

/** Rejette date future et âge hors plage scolaire (2–25 ans). Retourne message ou null. */
export const messageErreurDateNaissance = (dateNaissance) => {
  if (!dateNaissance) return 'Date de naissance requise';
  const birth = new Date(dateNaissance);
  if (Number.isNaN(birth.getTime())) return 'Date de naissance invalide';
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (birth > today) return 'La date de naissance ne peut pas être dans le futur';
  const age = calculerAge(birth);
  if (age < 2 || age > 25) return "L'âge de l'élève doit être compris entre 2 et 25 ans";
  return null;
};

// Tronquer texte
export const tronquer = (texte, longueur = 50) => {
  if (!texte || texte.length <= longueur) return texte;
  return texte.substring(0, longueur) + '...';
};

// Capitalize
export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// Formatage du statut pour affichage
export const formatStatutVente = (statut) => {
  const map = {
    'en_cours': 'En cours',
    'finalisee': 'Finalisée',
    'annulee': 'Annulée'
  };
  return map[statut] || statut;
};

export const formatStatutOrdonnance = (statut) => {
  const map = {
    'en_attente': 'En attente',
    'validee': 'Validée',
    'dispensee': 'Délivrée',
    'refusee': 'Refusée'
  };
  return map[statut] || statut;
};

export const formatStatutCommande = (statut) => {
  const map = {
    'brouillon': 'Brouillon',
    'envoyee': 'Envoyée',
    'recue': 'Reçue',
    'partielle': 'Partielle',
    'annulee': 'Annulée'
  };
  return map[statut] || statut;
};

export const formatStatutLivraison = (statut) => {
  const map = {
    'assignee': 'Assignée',
    'en_route': 'En route',
    'livree': 'Livrée',
    'echec': 'Échec',
    'reassignee': 'Réassignée'
  };
  return map[statut] || statut;
};

export const formatModePaiement = (mode) => {
  const map = {
    'especes': 'Espèces',
    'mobile_money': 'Mobile Money',
    'carte': 'Carte bancaire',
    'credit': 'Crédit'
  };
  return map[mode] || mode;
};

export const formatRole = (role) => {
  const map = {
    'super_admin': 'Super Admin',
    'directeur': 'Directeur',
    'directeur_etudes': 'Directeur des études',
    'secretaire': 'Secrétaire',
    'enseignant': 'Enseignant',
    'surveillant': 'Surveillant',
    'comptable': 'Comptable',
    'parent': 'Parent',
  };
  return map[role] || role;
};
