/**
 * evaluations.excel.service.js
 *
 * Service d'export et d'import de grilles de notes au format Microsoft Excel (.xlsx).
 * Permet aux enseignants de travailler hors-ligne sur Excel puis de réimporter
 * en un clic les notes avec validation stricte (bornes, appartenance classe, doublons).
 */

import ExcelJS from 'exceljs';
import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('EvaluationsExcelService');

// ─── Styles Excel ─────────────────────────────────────────────────────────────
const HEADER_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1A365D' }, // Navy GestSchool
};

const HEADER_FONT = {
  name: 'Calibri',
  size: 11,
  bold: true,
  color: { argb: 'FFFFFFFF' },
};

const META_TITLE_FONT = {
  name: 'Calibri',
  size: 14,
  bold: true,
  color: { argb: 'FF1A365D' },
};

const ZEBRA_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF7FAFC' },
};

const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
};

/**
 * Neutralise les risques de CSV / Excel Formula Injection (CWE-1236 / DDE).
 * Si une valeur commence par =, +, -, @, \t, ou \r, Excel risque d'exécuter
 * la formule lors de l'ouverture locale du fichier. On préfixe par une apostrophe '.
 */
export function sanitizeExcelFormula(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/^[=\+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Nettoie une chaîne extraite d'Excel en retirant l'apostrophe défensive de neutralisation.
 */
export function unescapeExcelFormula(value) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (str.startsWith("'") && /^[=\+\-@\t\r]/.test(str.slice(1))) {
    return str.slice(1);
  }
  return str;
}

/**
 * Génère le classeur Excel template pré-rempli pour une évaluation donnée.
 *
 * @param {string} tenantId
 * @param {string} evaluationId
 * @returns {Promise<Buffer>}
 */
export async function exportEvaluationExcelTemplate(tenantId, evaluationId) {
  const evaluation = await prisma.evaluation.findFirst({
    where: { id: evaluationId, tenantId },
    include: {
      classe: true,
      matiere: true,
      anneeScolaire: true,
      notes: {
        include: {
          eleve: { select: { id: true, matricule: true, nom: true, prenom: true } },
        },
      },
    },
  });

  if (!evaluation) {
    throw new Error('EVALUATION_NOT_FOUND');
  }

  // Récupérer tous les élèves inscrits dans cette classe pour l'année scolaire
  const inscriptions = await prisma.inscription.findMany({
    where: {
      tenantId,
      classeId: evaluation.classeId,
      anneeScolaireId: evaluation.anneeScolaireId,
      statut: 'validee',
    },
    include: {
      eleve: {
        select: {
          id: true,
          matricule: true,
          nom: true,
          prenom: true,
        },
      },
    },
    orderBy: [
      { eleve: { nom: 'asc' } },
      { eleve: { prenom: 'asc' } },
    ],
  });

  // Map des notes existantes par eleveId
  const notesMap = new Map();
  for (const n of evaluation.notes) {
    notesMap.set(n.eleveId, n);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GestSchool SaaS';
  workbook.lastModifiedBy = 'GestSchool';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Saisie Notes', {
    views: [{ showGridLines: true }],
  });

  // 1. En-tête informatif (Lignes 1 à 6)
  worksheet.mergeCells('A1:F1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `GRILLE DE SAISIE DES NOTES — ${evaluation.nom.toUpperCase()}`;
  titleCell.font = META_TITLE_FONT;
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 28;

  worksheet.getCell('A3').value = 'Classe :';
  worksheet.getCell('B3').value = evaluation.classe?.nom || '—';
  worksheet.getCell('A3').font = { bold: true };

  worksheet.getCell('C3').value = 'Matière :';
  worksheet.getCell('D3').value = evaluation.matiere?.nom || '—';
  worksheet.getCell('C3').font = { bold: true };

  worksheet.getCell('E3').value = 'Coefficient :';
  worksheet.getCell('F3').value = evaluation.coefficient;
  worksheet.getCell('E3').font = { bold: true };

  worksheet.getCell('A4').value = 'Période :';
  worksheet.getCell('B4').value = `Période ${evaluation.periodeIndex}`;
  worksheet.getCell('A4').font = { bold: true };

  worksheet.getCell('C4').value = 'Barème / Note Max :';
  worksheet.getCell('D4').value = `/${evaluation.noteMaximale}`;
  worksheet.getCell('C4').font = { bold: true };

  worksheet.getCell('E4').value = 'Date épreuve :';
  worksheet.getCell('F4').value = evaluation.dateEvaluation
    ? new Date(evaluation.dateEvaluation).toLocaleDateString('fr-FR')
    : '—';
  worksheet.getCell('E4').font = { bold: true };

  // Consignes ligne 5
  worksheet.mergeCells('A5:F5');
  const noteInfoCell = worksheet.getCell('A5');
  noteInfoCell.value = `Instructions : Ne modifiez pas les colonnes ID, Matricule, Nom et Prénom. Saisissez uniquement les notes (entre 0 et ${evaluation.noteMaximale}) et appréciations.`;
  noteInfoCell.font = { italic: true, size: 9, color: { argb: 'FF718096' } };

  // 2. Colonnes du tableau de saisie (Ligne 7)
  const headerRow = worksheet.getRow(7);
  headerRow.values = [
    'ID Élève (Système)',
    'Matricule',
    'Nom',
    'Prénom',
    `Note (sur ${evaluation.noteMaximale})`,
    'Appréciation Enseignant',
  ];
  headerRow.height = 24;

  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = THIN_BORDER;
  });

  worksheet.columns = [
    { key: 'eleveId', width: 20 },     // Masqué ou discret
    { key: 'matricule', width: 16 },
    { key: 'nom', width: 22 },
    { key: 'prenom', width: 24 },
    { key: 'valeur', width: 20 },
    { key: 'appreciation', width: 35 },
  ];

  // 3. Remplissage des données élèves
  let rowIndex = 8;
  for (const ins of inscriptions) {
    const el = ins.eleve;
    const noteExistante = notesMap.get(el.id);
    const row = worksheet.getRow(rowIndex);

    row.values = [
      el.id,
      sanitizeExcelFormula(el.matricule || '—'),
      sanitizeExcelFormula(el.nom?.toUpperCase() || ''),
      sanitizeExcelFormula(el.prenom || ''),
      noteExistante ? Number(noteExistante.valeur) : null,
      sanitizeExcelFormula(noteExistante?.appreciation || ''),
    ];

    row.height = 20;

    // Zebra striping
    const isZebra = rowIndex % 2 === 0;
    row.eachCell((cell, colNumber) => {
      cell.border = THIN_BORDER;
      if (isZebra && colNumber < 5) {
        cell.fill = ZEBRA_FILL;
      }
      if (colNumber === 2 || colNumber === 5) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { vertical: 'middle' };
      }
    });

    // Style de la cellule de note (colonne 5)
    const noteCell = row.getCell(5);
    noteCell.font = { bold: true, size: 11, color: { argb: 'FF1A365D' } };
    noteCell.numFmt = '0.00';

    rowIndex++;
  }

  // Masquer la colonne A (ID Élève interne) pour garder un rendu ultra net pour l'utilisateur
  // mais la laisser accessible par le parser à l'importation.
  worksheet.getColumn(1).hidden = true;

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Importe et applique les notes depuis un classeur Excel uploadé.
 *
 * @param {string} tenantId
 * @param {string} evaluationId
 * @param {Buffer} fileBuffer
 * @param {string} actorId ID du staff connecté
 * @param {string} actorRole Rôle du staff
 * @returns {Promise<{ totalLignes: number, countSaisies: number, countMisesAJour: number, erreurs: Array<string> }>}
 */
export async function importEvaluationNotesFromExcel(tenantId, evaluationId, fileBuffer, actorId, actorRole) {
  const evaluation = await prisma.evaluation.findFirst({
    where: { id: evaluationId, tenantId },
    include: {
      classe: true,
      matiere: true,
    },
  });

  if (!evaluation) {
    throw new Error('EVALUATION_NOT_FOUND');
  }

  // Anti-fraude : Vérifier si la saisie des notes est ouverte par la direction
  if (actorRole === 'enseignant') {
    const cfg = await prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: { saisieNotesOuverte: true },
    });
    if (cfg?.saisieNotesOuverte === false) {
      const err = new Error('SAISIE_FERMEE');
      err.statusCode = 403;
      throw err;
    }
  }

  // Récupérer les élèves de la classe pour valider l'appartenance
  const inscriptions = await prisma.inscription.findMany({
    where: {
      tenantId,
      classeId: evaluation.classeId,
      anneeScolaireId: evaluation.anneeScolaireId,
      statut: 'validee',
    },
    select: {
      eleveId: true,
      eleve: { select: { id: true, matricule: true, nom: true, prenom: true } },
    },
  });

  const validEleveIds = new Set(inscriptions.map((i) => i.eleveId));
  const matriculeToEleveId = new Map();
  for (const ins of inscriptions) {
    if (ins.eleve.matricule) {
      matriculeToEleveId.set(ins.eleve.matricule.trim().toUpperCase(), ins.eleveId);
    }
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Le fichier Excel ne contient aucune feuille de calcul.');
  }

  const maxNote = Number(evaluation.noteMaximale) || 20;
  const notesToUpsert = [];
  const erreurs = [];

  // Trouver la ligne d'en-tête (cherche 'Matricule' ou 'Note')
  let headerRowIndex = 7;
  for (let r = 1; r <= 15; r++) {
    const row = worksheet.getRow(r);
    const textValues = (row.values || []).map((v) => String(v || '').toLowerCase());
    if (textValues.some((v) => v.includes('matricule')) || textValues.some((v) => v.includes('note'))) {
      headerRowIndex = r;
      break;
    }
  }

  const totalRows = worksheet.rowCount;

  for (let r = headerRowIndex + 1; r <= totalRows; r++) {
    const row = worksheet.getRow(r);
    const rawId = row.getCell(1).value;
    const rawMatricule = row.getCell(2).value;
    const rawNom = row.getCell(3).value;
    const rawPrenom = row.getCell(4).value;
    const rawNote = row.getCell(5).value;
    const rawAppreciation = row.getCell(6).value;

    // Si la ligne est entièrement vide, ignorer
    if (!rawId && !rawMatricule && !rawNom && rawNote == null) {
      continue;
    }

    // Résolution de l'élève
    let eleveId = null;
    if (rawId && typeof rawId === 'string' && validEleveIds.has(rawId.trim())) {
      eleveId = rawId.trim();
    } else if (rawMatricule) {
      const matClean = String(rawMatricule).trim().toUpperCase();
      if (matriculeToEleveId.has(matClean)) {
        eleveId = matriculeToEleveId.get(matClean);
      }
    }

    const eleveNomDisplay = `${rawNom || ''} ${rawPrenom || ''} (${rawMatricule || 'Sans matricule'})`.trim();

    if (!eleveId) {
      erreurs.push(`Ligne ${r} : Élève "${eleveNomDisplay}" non reconnu dans cette classe.`);
      continue;
    }

    // Si aucune note n'est renseignée sur cette ligne, on saute (pas d'écrasement)
    if (rawNote === null || rawNote === undefined || String(rawNote).trim() === '') {
      continue;
    }

    // Parsing et validation de la note
    let noteNum = null;
    if (typeof rawNote === 'number') {
      noteNum = rawNote;
    } else if (typeof rawNote === 'object' && rawNote.result !== undefined) {
      noteNum = parseFloat(rawNote.result);
    } else {
      const parsed = parseFloat(String(rawNote).replace(',', '.').trim());
      if (!isNaN(parsed)) {
        noteNum = parsed;
      }
    }

    if (noteNum === null || isNaN(noteNum)) {
      erreurs.push(`Ligne ${r} : Note invalide "${rawNote}" pour l'élève ${eleveNomDisplay}.`);
      continue;
    }

    if (noteNum < 0 || noteNum > maxNote) {
      erreurs.push(
        `Ligne ${r} : La note ${noteNum} est hors limites pour l'élève ${eleveNomDisplay} (doit être entre 0 et ${maxNote}).`
      );
      continue;
    }

    const appreciation = rawAppreciation ? unescapeExcelFormula(rawAppreciation) : null;

    notesToUpsert.push({
      eleveId,
      valeur: noteNum,
      appreciation,
      ligne: r,
    });
  }

  if (notesToUpsert.length === 0 && erreurs.length > 0) {
    return {
      totalLignes: erreurs.length,
      countSaisies: 0,
      countMisesAJour: 0,
      erreurs,
    };
  }

  // Application atomique en base
  let countSaisies = 0;
  let countMisesAJour = 0;

  await prisma.$transaction(async (tx) => {
    for (const item of notesToUpsert) {
      const existing = await tx.note.findFirst({
        where: { evaluationId, eleveId: item.eleveId },
      });

      if (existing) {
        await tx.note.update({
          where: { id: existing.id },
          data: {
            valeur: item.valeur,
            appreciation: item.appreciation || existing.appreciation,
            saisiParId: actorId,
          },
        });
        countMisesAJour++;
      } else {
        await tx.note.create({
          data: {
            tenantId,
            evaluationId,
            eleveId: item.eleveId,
            valeur: item.valeur,
            appreciation: item.appreciation,
            saisiParId: actorId,
          },
        });
        countSaisies++;
      }
    }
  });

  log.info(
    { evaluationId, tenantId, countSaisies, countMisesAJour, totalErreurs: erreurs.length },
    'Import Excel notes terminé'
  );

  return {
    totalLignes: notesToUpsert.length + erreurs.length,
    countSaisies,
    countMisesAJour,
    totalTraite: countSaisies + countMisesAJour,
    erreurs,
  };
}
