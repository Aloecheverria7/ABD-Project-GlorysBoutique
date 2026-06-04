/** @file Utilidades para firmar y verificar tokens JWT de autenticacion. */
import jwt from 'jsonwebtoken';

const TOKEN_TTL = '8h';

/**
 * Obtiene la clave secreta JWT desde las variables de entorno.
 *
 * @returns {string} La clave secreta configurada en JWT_SECRET.
 * @throws {Error} Si JWT_SECRET no esta definido en el entorno.
 */
function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET no esta configurado en el entorno.');
  }
  return secret;
}

/**
 * Firma un token JWT con la informacion del usuario y un tiempo de expiracion de 8 horas.
 *
 * @param {object} payload - Datos a incluir en el token (por ejemplo sub, username, rol_id, rol).
 * @returns {string} El token JWT firmado.
 * @throws {Error} Si JWT_SECRET no esta configurado en el entorno.
 */
export function signToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: TOKEN_TTL });
}

/**
 * Verifica y decodifica un token JWT.
 *
 * @param {string} token - El token JWT a verificar.
 * @returns {object} El contenido decodificado del token si es valido.
 * @throws {Error} Si JWT_SECRET no esta configurado, o si el token es invalido o expirado.
 */
export function verifyToken(token) {
  return jwt.verify(token, getSecret());
}
