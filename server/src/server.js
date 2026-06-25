/**
 * @file Punto de entrada del servidor Express de la API de Glorys Boutique.
 * Configura middlewares de seguridad, CORS, parseo JSON y logging, registra los routers de la API,
 * define el manejo de 404 y errores, ejecuta la migracion opcional y arranca el servidor HTTP.
 */
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { sequelize } from './db.js';
import { migrateDatabase } from './database/migrate.js';
import { authRouter } from './routes/auth.js';
import { cajaRouter } from './routes/caja.js';
import { catalogRouter } from './routes/catalog.js';
import { configRouter } from './routes/config.js';
import { creditRouter } from './routes/credit.js';
import { customersRouter } from './routes/customers.js';
import { inventoryRouter } from './routes/inventory.js';
import { lossesRouter } from './routes/losses.js';
import { paymentTypesRouter } from './routes/paymentTypes.js';
import { paymentsRouter } from './routes/payments.js';
import { productsRouter } from './routes/products.js';
import { purchasesRouter } from './routes/purchases.js';
import { salesRouter } from './routes/sales.js';
import { suppliersRouter } from './routes/suppliers.js';
import { usersRouter } from './routes/users.js';

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

/**
 * Comprueba si la conexion a la base de datos responde.
 *
 * @returns {Promise<boolean>} true si MySQL responde, false en caso contrario.
 */
async function isDatabaseUp() {
  try {
    await sequelize.authenticate();
    return true;
  } catch {
    return false;
  }
}

// Liveness: confirma que el proceso esta vivo y respondiendo. Es la sonda que Coolify debe
// consultar para el health check del contenedor (no falla si la BD esta temporalmente caida,
// para evitar reinicios en cascada por bloqueos transitorios de la base de datos).
app.get(['/api/health', '/health'], (_req, res) => {
  res.json({
    ok: true,
    status: 'ok',
    service: 'glorys-boutique-api',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Readiness: ademas verifica la conexion a MySQL. Responde 503 si la base de datos no esta
// disponible. Util si quieres que Coolify no envie trafico hasta que la BD responda.
app.get(['/api/health/ready', '/ready'], async (_req, res) => {
  const dbUp = await isDatabaseUp();
  res.status(dbUp ? 200 : 503).json({
    ok: dbUp,
    status: dbUp ? 'ok' : 'degraded',
    service: 'glorys-boutique-api',
    db: dbUp ? 'up' : 'down',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRouter);
app.use('/api/catalog', catalogRouter);
app.use('/api/config', configRouter);
app.use('/api/customers', customersRouter);
app.use('/api/products', productsRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/losses', lossesRouter);
app.use('/api/sales', salesRouter);
app.use('/api/purchases', purchasesRouter);
app.use('/api/users', usersRouter);
app.use('/api/payment-types', paymentTypesRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/credit', creditRouter);
app.use('/api/caja', cajaRouter);

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
