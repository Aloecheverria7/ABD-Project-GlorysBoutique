/** @file Utilidad para crear la base de datos MySQL si todavia no existe. */
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Crea la base de datos configurada (DB_NAME) si aun no existe, usando codificacion utf8mb4.
 * Se conecta como administrador sin seleccionar base y cierra la conexion al terminar.
 *
 * @returns {Promise<void>} Promesa que se resuelve cuando la base de datos existe.
 */
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
