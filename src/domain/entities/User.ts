/**
 * ZenMoney — Entidad User y FamilyGroup
 */

export type UserRole = 'admin' | 'editor' | 'viewer';

export interface UserProfile {
  id: string;
  authUserId: string;
  familyGroupId: string;
  displayName: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface FamilyGroup {
  id: string;
  name: string;
  currencyDefault: string;
  /** Local-part de la dirección de reenvío de facturas electrónicas: {inboundToken}@<dominio-de-ingesta>. */
  inboundToken: string;
  createdAt: string;
}

export interface CreateFamilyGroupInput {
  name: string;
  currencyDefault?: string;
}
