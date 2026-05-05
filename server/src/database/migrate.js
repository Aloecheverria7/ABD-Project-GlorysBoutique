import { sequelize } from '../db.js';
import '../models/index.js';
import { fileURLToPath } from 'url';
import { ensureDatabaseExists } from './createDatabase.js';
import { seedDatabase } from './seed.js';

export async function migrateDatabase({ seed = true } = {}) {
  await ensureDatabaseExists();
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });

  if (seed) {
    await seedDatabase();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  migrateDatabase({ seed: process.env.DB_SEED !== 'false' })
    .then(async () => {
      console.log('Database migrated successfully with Sequelize.');
      await sequelize.close();
    })
    .catch(async (error) => {
      console.error(error);
      await sequelize.close().catch(() => {});
      process.exit(1);
    });
}
