import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixMarges() {
  try {
    console.log('Correction des marges des médicaments...\n');
    
    const medicaments = await prisma.medicament.findMany();
    
    let fixedCount = 0;
    
    for (const med of medicaments) {
      const prixAchat = parseFloat(med.prixAchat);
      const prixVente = parseFloat(med.prixVente);
      const margePercent = parseFloat(med.margePercent);
      
      // Calculer la marge attendue
      const expectedMargin = ((prixVente - prixAchat) / prixAchat) * 100;
      
      // Vérifier si la marge enregistrée est incorrecte (écart > 0.01)
      if (Math.abs(margePercent - expectedMargin) > 0.01) {
        console.log(`${med.dci} - ${med.nomCommercial}`);
        console.log(`  Prix achat: ${prixAchat} | Prix vente: ${prixVente}`);
        console.log(`  Marge enregistrée: ${margePercent.toFixed(2)}%`);
        console.log(`  Marge calculée: ${expectedMargin.toFixed(2)}%`);
        
        // Corriger la marge
        await prisma.medicament.update({
          where: { id: med.id },
          data: { margePercent: expectedMargin }
        });
        
        console.log(`  -> Marge corrigée à ${expectedMargin.toFixed(2)}%\n`);
        fixedCount++;
      }
    }
    
    console.log(`✓ ${fixedCount} médicaments corrigés`);
  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixMarges();
