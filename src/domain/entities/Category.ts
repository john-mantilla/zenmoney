/**
 * ZenMoney — Entidad Category
 */

export interface Category {
  id: string;
  familyGroupId: string | null; // null si es de sistema (compartida)
  name: string;
  icon: string;
  color: string;
  parentCategoryId: string | null; // Null si es categoría principal, uuid si es subcategoría
  isSystem: boolean;
  isPrivate: boolean;
  createdAt: string;
}

export interface CreateCategoryInput {
  name: string;
  icon: string;
  color: string;
  parentCategoryId?: string | null;
  isPrivate?: boolean;
}
