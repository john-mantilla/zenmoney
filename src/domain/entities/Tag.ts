/**
 * ZenMoney — Entidad Tag
 */

export interface Tag {
  id: string;
  familyGroupId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface CreateTagInput {
  name: string;
  color?: string;
}
