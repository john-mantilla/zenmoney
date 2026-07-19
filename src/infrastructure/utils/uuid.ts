/**
 * Genera un UUID v4 pseudoaleatorio compatible con RFC 4122.
 * Útil para la creación de claves primarias en el cliente (offline)
 * que deben insertarse en campos UUID de Supabase.
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
