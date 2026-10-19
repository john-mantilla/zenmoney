/**
 * ZenMoney — Utilidades de Fechas Locales
 *
 * En JavaScript, `new Date().toISOString()` devuelve la fecha en zona horaria UTC (Z).
 * En zonas horarias como Colombia (UTC-5), a partir de las 7:00 PM,
 * `toISOString().split('T')[0]` pasa a ser el día siguiente en UTC.
 *
 * Esta función garantiza que siempre se obtenga la fecha en la zona horaria LOCAL
 * del dispositivo (formato 'YYYY-MM-DD').
 */

export const getLocalDateString = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
