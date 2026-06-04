/** @file Utilidades de formato y conversion de moneda (cordoba NIO y dolar USD). */
import { DEFAULT_RATE } from '../constants.js';

/**
 * Formateadores de moneda predefinidos para cordoba (NIO) y dolar (USD).
 */
export const formatters = {
  NIO: new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO', minimumFractionDigits: 2 }),
  USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
};

/**
 * Formatea un monto como texto de moneda. Si la moneda no es reconocida usa NIO.
 *
 * @param {number|string} amount - Monto a formatear (los valores nulos se tratan como 0).
 * @param {string} [currency='NIO'] - Codigo de moneda ('NIO' o 'USD').
 * @returns {string} Monto formateado como cadena de moneda.
 */
export function fmt(amount, currency = 'NIO') {
  const value = Number(amount || 0);
  return (formatters[currency] || formatters.NIO).format(value);
}

/**
 * Convierte un monto expresado en cordoba (NIO) a la moneda indicada.
 *
 * @param {number|string} amountNIO - Monto en cordoba (los valores nulos se tratan como 0).
 * @param {string} currency - Moneda destino ('USD' para convertir, cualquier otra devuelve el valor sin cambios).
 * @param {number|string} rate - Tasa de cambio cordoba por dolar; usa DEFAULT_RATE si es falsy.
 * @returns {number} Monto convertido.
 */
export function convertFromNIO(amountNIO, currency, rate) {
  const value = Number(amountNIO || 0);
  if (currency === 'USD') return value / Number(rate || DEFAULT_RATE);
  return value;
}

/**
 * Convierte un monto en la moneda indicada a cordoba (NIO).
 *
 * @param {number|string} amount - Monto a convertir (los valores nulos se tratan como 0).
 * @param {string} currency - Moneda de origen ('USD' para convertir, cualquier otra devuelve el valor sin cambios).
 * @param {number|string} rate - Tasa de cambio cordoba por dolar; usa DEFAULT_RATE si es falsy.
 * @returns {number} Monto en cordoba.
 */
export function convertToNIO(amount, currency, rate) {
  const value = Number(amount || 0);
  if (currency === 'USD') return value * Number(rate || DEFAULT_RATE);
  return value;
}

/**
 * Calcula el precio de una variante en la moneda solicitada.
 * Prioriza el precio nativo de la moneda; si no existe, convierte desde la otra
 * moneda usando la tasa e indica que el valor fue convertido.
 *
 * @param {{ precio_base?: number, precio_usd?: number }} variant - Variante con sus precios.
 * @param {string} moneda - Moneda solicitada ('USD' o 'NIO').
 * @param {number} rate - Tasa de cambio cordoba por dolar.
 * @returns {{ value: number, converted: boolean }} Precio calculado y si requirio conversion.
 */
export function priceFor(variant, moneda, rate) {
  const nio = variant?.precio_base != null ? Number(variant.precio_base) : null;
  const usd = variant?.precio_usd != null ? Number(variant.precio_usd) : null;
  // Regla de negocio: un producto puede tener precio fijado en NIO (precio_base) y/o en USD
  // (precio_usd). Se prefiere SIEMPRE el precio nativo de la moneda solicitada (converted: false);
  // solo si no existe se convierte desde la otra moneda con la tasa (converted: true) para que la
  // UI pueda advertir que es un valor estimado. Si no hay ningun precio, devuelve 0.
  if (moneda === 'USD') {
    if (usd != null) return { value: usd, converted: false };
    if (nio != null) return { value: nio / rate, converted: true };
    return { value: 0, converted: false };
  }
  if (nio != null) return { value: nio, converted: false };
  if (usd != null) return { value: usd * rate, converted: true };
  return { value: 0, converted: false };
}
