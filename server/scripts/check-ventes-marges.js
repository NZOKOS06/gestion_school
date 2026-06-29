import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkVentesMarges() {
  try {
    console.log('Vérification des ventes et marges...\n');
    
    const ventes = await prisma.vente.findMany({
      where: { statut: 'finalisee' },
      include: {
        lignes: {
          include: {
            medicament: true,
            lotStock: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    for (const vente of ventes) {
      console.log(`Vente #${vente.id} - ${vente.createdAt.toISOString()}`);
      console.log(`Montant total: ${vente.montantTotal} FCFA`);
      console.log('Lignes:');
      
      for (const ligne of vente.lignes) {
        const prixVente = parseFloat(ligne.prixUnitaire);
        const prixAchatLot = ligne.lotStock?.prixAchatLot ? parseFloat(ligne.lotStock.prixAchatLot) : null;
        const prixAchatMed = ligne.medicament?.prixAchat ? parseFloat(ligne.medicament.prixAchat) : null;
        const prixAchat = prixAchatLot || prixAchatMed || 0;
        const qty = ligne.quantite;
        
        const ca = prixVente * qty;
        const cout = prixAchat * qty;
        const marge = ca - cout;
        
        console.log(`  ${ligne.medicament?.dci} - ${ligne.medicament?.nomCommercial}`);
        console.log(`    Prix vente unitaire: ${prixVente} FCFA`);
        console.log(`    Prix achat lot: ${prixAchatLot} FCFA`);
        console.log(`    Prix achat médicament: ${prixAchatMed} FCFA`);
        console.log(`    Prix achat utilisé: ${prixAchat} FCFA`);
        console.log(`    Quantité: ${qty}`);
        console.log(`    CA: ${ca} FCFA`);
        console.log(`    Coût: ${cout} FCFA`);
        console.log(`    Marge: ${marge} FCFA`);
        console.log('');
      }
      console.log('---\n');
    }
    
  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkVentesMarges();
