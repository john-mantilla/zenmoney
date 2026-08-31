/**
 * ZenMoney — Interface TagRepository
 */

import { Tag, CreateTagInput } from '../entities/Tag';

export interface TagRepository {
  getById(id: string): Promise<Tag | null>;
  getAll(): Promise<Tag[]>;
  create(input: CreateTagInput): Promise<Tag>;
  delete(id: string): Promise<void>;
}
