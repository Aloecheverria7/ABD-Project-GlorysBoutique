import { sequelize } from '../db.js';
import '../models/index.js';
import { fileURLToPath } from 'url';
import { ensureDatabaseExists } from './createDatabase.js';
import { seedDatabase } from './seed.js';

async function preservaProveedoresLegacy() {
  const [columns] = await sequelize.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'productos' AND COLUMN_NAME = 'proveedor_id'"
  );
  if (columns.length === 0) return;

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS producto_proveedores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      producto_id INT NOT NULL,
      proveedor_id INT NOT NULL,
      costo DECIMAL(10,2) NULL,
      moneda_costo VARCHAR(3) NOT NULL DEFAULT 'NIO',
      UNIQUE KEY uq_producto_proveedor (producto_id, proveedor_id)
    )
  `);

  await sequelize.query(`
    INSERT IGNORE INTO producto_proveedores (producto_id, proveedor_id, moneda_costo)
    SELECT id, proveedor_id, 'NIO' FROM productos WHERE proveedor_id IS NOT NULL
  `);

  const [fks] = await sequelize.query(
    "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'productos' AND COLUMN_NAME = 'proveedor_id' AND REFERENCED_TABLE_NAME IS NOT NULL"
  );
  for (const row of fks) {
    await sequelize.query(`ALTER TABLE productos DROP FOREIGN KEY \`${row.CONSTRAINT_NAME}\``).catch(() => {});
  }
}

export async function migrateDatabase({ seed = true } = {}) {
  await ensureDatabaseExists();
  await sequelize.authenticate();
  await preservaProveedoresLegacy();
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
