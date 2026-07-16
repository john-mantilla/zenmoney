/**
 * ZenMoney — Interface CategoryRepository
 */

import { Category, CreateCategoryInput } from '../entities/Category';

export interface CategoryRepository {
  getById(id: string): Promise<Category | null>;
  getAll(includeSystem?: boolean): Promise<Category[]>;
  getByParentId(parentId: string | null): Promise<Category[]>;
  create(input: CreateCategoryInput): Promise<Category>;
  update(id: string, data: Partial<CreateCategoryInput>): Promise<Category>;
  delete(id: string): Promise<void>;
  searchByName(query: string): Promise<Category[]>;
}
