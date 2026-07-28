import { describe, it, expect, vi } from 'vitest';
import { LearnCategorizationFromCorrection } from '../../usecases/LearnCategorizationFromCorrection';
import { CategorizationRule, CreateCategorizationRuleInput } from '../../entities/CategorizationRule';
import { CategorizationRuleRepository } from '../../repositories/CategorizationRuleRepository';

function makeRule(overrides: Partial<CategorizationRule> = {}): CategorizationRule {
  return {
    id: 'rule-1',
    familyGroupId: 'fam-1',
    matchPattern: 'uber',
    categoryId: 'cat-transporte',
    priority: 10,
    isAiGenerated: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeFakeRepo(): CategorizationRuleRepository {
  return {
    getAll: vi.fn(async () => []),
    create: vi.fn(async (input: CreateCategorizationRuleInput) => ({
      id: 'new-rule',
      familyGroupId: 'fam-1',
      matchPattern: input.matchPattern,
      categoryId: input.categoryId,
      priority: input.priority ?? 10,
      isAiGenerated: input.isAiGenerated ?? false,
      createdAt: '2026-01-01T00:00:00.000Z',
    })),
    update: vi.fn(async (id: string, data: Partial<CreateCategorizationRuleInput>) => ({
      id,
      familyGroupId: 'fam-1',
      matchPattern: data.matchPattern ?? 'uber',
      categoryId: data.categoryId ?? 'cat-transporte',
      priority: data.priority ?? 10,
      isAiGenerated: data.isAiGenerated ?? false,
      createdAt: '2026-01-01T00:00:00.000Z',
    })),
  };
}

describe('LearnCategorizationFromCorrection', () => {
  it('crea una regla nueva cuando no existe ninguna para ese comercio', async () => {
    const repo = makeFakeRepo();
    const usecase = new LearnCategorizationFromCorrection(repo);

    await usecase.execute({ merchantName: 'Uber', correctedCategoryId: 'cat-transporte', existingRules: [] });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ matchPattern: 'Uber', categoryId: 'cat-transporte', isAiGenerated: false })
    );
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('actualiza la regla existente cuando la corrección cambia la categoría', async () => {
    const repo = makeFakeRepo();
    const usecase = new LearnCategorizationFromCorrection(repo);
    const existingRules = [makeRule({ categoryId: 'cat-mal-asignada' })];

    await usecase.execute({ merchantName: 'uber', correctedCategoryId: 'cat-transporte', existingRules });

    expect(repo.update).toHaveBeenCalledWith('rule-1', expect.objectContaining({ categoryId: 'cat-transporte' }));
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('no hace nada si la regla ya tenía la categoría correcta', async () => {
    const repo = makeFakeRepo();
    const usecase = new LearnCategorizationFromCorrection(repo);
    const existingRules = [makeRule({ categoryId: 'cat-transporte' })];

    await usecase.execute({ merchantName: 'Uber', correctedCategoryId: 'cat-transporte', existingRules });

    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('no hace nada si el nombre del comercio está vacío', async () => {
    const repo = makeFakeRepo();
    const usecase = new LearnCategorizationFromCorrection(repo);

    const result = await usecase.execute({ merchantName: '   ', correctedCategoryId: 'cat-x', existingRules: [] });

    expect(result).toBeNull();
    expect(repo.create).not.toHaveBeenCalled();
  });
});
