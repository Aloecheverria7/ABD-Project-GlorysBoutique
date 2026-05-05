import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

export async function ensureDatabaseExists() {
  const databaseName = process.env.DB_NAME || 'glorysboutique_BD';
  const admin = new Sequelize('', process.env.DB_USER || 'root', process.env.DB_PASSWORD || '', {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql',
    logging: process.env.DB_LOGGING === 'true' ? console.log : false
  });

  try {
    await admin.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } finally {
    await admin.close();
  }
}
