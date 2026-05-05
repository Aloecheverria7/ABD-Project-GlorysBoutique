import jwt from 'jsonwebtoken';

const TOKEN_TTL = '8h';

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET no esta configurado en el entorno.');
  }
  return secret;
}

export function signToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: TOKEN_TTL });
}

export function verifyToken(token) {
  return jwt.verify(token, getSecret());
}
