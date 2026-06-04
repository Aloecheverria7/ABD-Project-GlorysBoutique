/** @file Utilidades HTTP para manejar handlers asincronos y respuestas comunes de Express. */

/**
 * Envuelve un manejador de ruta asincrono para capturar errores y delegarlos al middleware de errores.
 *
 * @param {import('express').RequestHandler} handler - Manejador asincrono de Express a envolver.
 * @returns {import('express').RequestHandler} Manejador que pasa cualquier rechazo de promesa a next.
 */
export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

/**
 * Responde con el estado 201 Created y el cuerpo en formato JSON.
 *
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {*} data - Datos a enviar en el cuerpo de la respuesta.
 * @returns {void}
 */
export function sendCreated(res, data) {
  res.status(201).json(data);
}
