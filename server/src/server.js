import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { sequelize } from './db.js';
import { migrateDatabase } from './database/migrate.js';
import { authRouter } from './routes/auth.js';
import { catalogRouter } from './routes/catalog.js';
import { configRouter } from './routes/config.js';
import { customersRouter } from './routes/customers.js';
import { inventoryRouter } from './routes/inventory.js';
import { productsRouter } from './routes/products.js';
import { salesRouter } from './routes/sales.js';

dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET no esta definido en server/.env. Define un valor antes de arrancar el servidor.');
  process.exit(1);
}

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'glorys-boutique-api' });
});

app.use('/api/auth', authRouter);
app.use('/api/catalog', catalogRouter);
app.use('/api/config', configRouter);
app.use('/api/customers', customersRouter);
app.use('/api/products', productsRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/sales', salesRouter);

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({
    message: error.sqlMessage || error.message || 'Unexpected server error'
  });
});

try {
  if (process.env.DB_AUTO_MIGRATE === 'true') {
    await migrateDatabase({ seed: process.env.DB_SEED !== 'false' });
  }

  await sequelize.authenticate();
  console.log('Database connection established with Sequelize.');
} catch (error) {
  console.warn(`Database connection failed: ${error.message}`);
}

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
