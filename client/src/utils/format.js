import { DEFAULT_RATE } from '../constants.js';

export const formatters = {
  NIO: new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO', minimumFractionDigits: 2 }),
  USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
};

export function fmt(amount, currency = 'NIO') {
  const value = Number(amount || 0);
  return (formatters[currency] || formatters.NIO).format(value);
}

export function convertFromNIO(amountNIO, currency, rate) {
  const value = Number(amountNIO || 0);
  if (currency === 'USD') return value / Number(rate || DEFAULT_RATE);
  return value;
}

export function convertToNIO(amount, currency, rate) {
  const value = Number(amount || 0);
  if (currency === 'USD') return value * Number(rate || DEFAULT_RATE);
  return value;
}

export function priceFor(variant, moneda, rate) {
  const nio = variant?.precio_base != null ? Number(variant.precio_base) : null;
  const usd = variant?.precio_usd != null ? Number(variant.precio_usd) : null;
  if (moneda === 'USD') {
    if (usd != null) return { value: usd, converted: false };
    if (nio != null) return { value: nio / rate, converted: true };
    return { value: 0, converted: false };
  }
  if (nio != null) return { value: nio, converted: false };
  if (usd != null) return { value: usd * rate, converted: true };
  return { value: 0, converted: false };
}
