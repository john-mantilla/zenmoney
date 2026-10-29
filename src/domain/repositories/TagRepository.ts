/**
 * ZenMoney — Interface TagRepository
 */

import { Tag, CreateTagInput } from '../entities/Tag';

export interface TagRepository {
  getById(id: string): Promise<Tag | null>;
  getAll(): Promise<Tag[]>;
  create(input: CreateTagInput): Promise<Tag>;
  update?(id: string, input: Partial<CreateTagInput>): Promise<Tag>;
  delete(id: string): Promise<void>;
  deduplicateTags?(): Promise<void>;
  getTagUsageCounts?(): Promise<Record<string, number>>;
}
