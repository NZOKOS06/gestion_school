import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixLotPrix() {
  try {
    console.log('Vérification et correction des prix d\'achat des lots...\n');
    
    const lots = await prisma.lotStock.findMany({
      include: {
        medicament: true
      }
    });
    
    let fixedCount = 0;
    
    for (const lot of lots) {
      const prixAchatLot = lot.prixAchatLot ? parseFloat(lot.prixAchatLot) : null;
      const prixAchatMed = lot.medicament?.prixAchat ? parseFloat(lot.medicament.prixAchat) : null;
      
      // Si le prix du lot est très différent du prix du médicament (écart > 1000%)
      if (prixAchatLot && prixAchatMed) {
        const ratio = prixAchatLot / prixAchatMed;
        if (ratio > 10 || ratio < 0.1) {
          console.log(`Lot ${lot.numeroLot} - ${lot.medicament?.dci} - ${lot.medicament?.nomCommercial}`);
          console.log(`  Prix achat lot: ${prixAchatLot} FCFA`);
          console.log(`  Prix achat médicament: ${prixAchatMed} FCFA`);
          console.log(`  Ratio: ${ratio.toFixed(2)}x`);
          
          // Corriger le prix du lot pour qu'il corresponde au prix du médicament
          await prisma.lotStock.update({
            where: { id: lot.id },
            data: { prixAchatLot: prixAchatMed }
          });
          
          console.log(`  -> Prix corrigé à ${prixAchatMed} FCFA\n`);
          fixedCount++;
        }
      } else if (!prixAchatLot && prixAchatMed) {
        // Si le lot n'a pas de prix d'achat, utiliser celui du médicament
        console.log(`Lot ${lot.numeroLot} - ${lot.medicament?.dci} - ${lot.medicament?.nomCommercial}`);
        console.log(`  Prix achat lot: non défini`);
        console.log(`  Prix achat médicament: ${prixAchatMed} FCFA`);
        
        await prisma.lotStock.update({
          where: { id: lot.id },
          data: { prixAchatLot: prixAchatMed }
        });
        
        console.log(`  -> Prix défini à ${prixAchatMed} FCFA\n`);
        fixedCount++;
      }
    }
    
    console.log(`✓ ${fixedCount} lots corrigés`);
  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixLotPrix();
