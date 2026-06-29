import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixMedicamentIds() {
  try {
    console.log('Recherche des médicaments avec des IDs corrompus...');
    
    // Récupérer tous les médicaments
    const medicaments = await prisma.medicament.findMany();
    
    let fixedCount = 0;
    
    for (const med of medicaments) {
      // Vérifier si l'ID contient autre chose qu'un UUID valide
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (!uuidRegex.test(med.id)) {
        console.log(`ID corrompu trouvé: ${med.id} (${med.dci} - ${med.nomCommercial})`);
        
        // Générer un nouvel UUID valide via PostgreSQL
        const result = await prisma.$queryRaw`SELECT gen_random_uuid() as new_id`;
        const newId = result[0].new_id;
        
        // Mettre à jour l'ID via SQL direct (Prisma ne permet pas de mettre à jour l'ID)
        const oldId = med.id;
        
        await prisma.$executeRaw`
          UPDATE "Medicament" 
          SET id = ${newId}::uuid 
          WHERE id = ${oldId}
        `;
        
        console.log(`  -> ID corrigé: ${newId}`);
        fixedCount++;
      }
    }
    
    console.log(`\n✓ ${fixedCount} médicaments corrigés`);
  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixMedicamentIds();
