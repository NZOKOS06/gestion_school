import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMarges() {
  try {
    console.log('Vérification des marges des médicaments...\n');
    
    const medicaments = await prisma.medicament.findMany({
      select: {
        id: true,
        dci: true,
        nomCommercial: true,
        prixAchat: true,
        prixVente: true,
        margePercent: true
      }
    });
    
    let negativeMarginCount = 0;
    let incorrectMarginCount = 0;
    
    console.log('Médicaments avec marge négative:');
    console.log('='.repeat(80));
    
    for (const med of medicaments) {
      const prixAchat = parseFloat(med.prixAchat);
      const prixVente = parseFloat(med.prixVente);
      const margePercent = parseFloat(med.margePercent);
      
      // Calculer la marge attendue
      const expectedMargin = ((prixVente - prixAchat) / prixAchat) * 100;
      
      // Vérifier si la marge est négative
      if (margePercent < 0) {
        negativeMarginCount++;
        console.log(`${med.dci} - ${med.nomCommercial}`);
        console.log(`  Prix achat: ${prixAchat} | Prix vente: ${prixVente}`);
        console.log(`  Marge enregistrée: ${margePercent.toFixed(2)}%`);
        console.log(`  Marge calculée: ${expectedMargin.toFixed(2)}%`);
        console.log(`  Différence: ${(margePercent - expectedMargin).toFixed(2)}%`);
        console.log('');
      }
      
      // Vérifier si la marge enregistrée est incorrecte (écart > 0.01)
      if (Math.abs(margePercent - expectedMargin) > 0.01) {
        incorrectMarginCount++;
        console.log(`${med.dci} - ${med.nomCommercial} (Marge incorrecte)`);
        console.log(`  Prix achat: ${prixAchat} | Prix vente: ${prixVente}`);
        console.log(`  Marge enregistrée: ${margePercent.toFixed(2)}%`);
        console.log(`  Marge calculée: ${expectedMargin.toFixed(2)}%`);
        console.log(`  Différence: ${(margePercent - expectedMargin).toFixed(2)}%`);
        console.log('');
      }
    }
    
    console.log('='.repeat(80));
    console.log(`Total médicaments: ${medicaments.length}`);
    console.log(`Médicaments avec marge négative: ${negativeMarginCount}`);
    console.log(`Médicaments avec marge incorrecte: ${incorrectMarginCount}`);
    
  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMarges();
