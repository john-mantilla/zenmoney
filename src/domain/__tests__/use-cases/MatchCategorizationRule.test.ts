import { describe, it, expect } from 'vitest';
import { MatchCategorizationRule } from '../../usecases/MatchCategorizationRule';
import { CategorizationRule } from '../../entities/CategorizationRule';

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

describe('MatchCategorizationRule', () => {
  it('encuentra una regla por coincidencia de substring (comercio más largo que el patrón)', () => {
    const rules = [makeRule({ matchPattern: 'uber', categoryId: 'cat-transporte' })];
    const result = new MatchCategorizationRule().execute('Uber Eats Colombia', rules);
    expect(result).toBe('cat-transporte');
  });

  it('encuentra una regla por coincidencia de substring (patrón más largo que el comercio)', () => {
    const rules = [makeRule({ matchPattern: 'uber eats colombia', categoryId: 'cat-transporte' })];
    const result = new MatchCategorizationRule().execute('Uber Eats', rules);
    expect(result).toBe('cat-transporte');
  });

  it('es insensible a mayúsculas/minúsculas', () => {
    const rules = [makeRule({ matchPattern: 'ÉXITO', categoryId: 'cat-mercado' })];
    const result = new MatchCategorizationRule().execute('éxito supermercado', rules);
    expect(result).toBe('cat-mercado');
  });

  it('devuelve null si ninguna regla coincide', () => {
    const rules = [makeRule({ matchPattern: 'netflix' })];
    const result = new MatchCategorizationRule().execute('Spotify', rules);
    expect(result).toBeNull();
  });

  it('ante varias coincidencias, prioriza la de mayor prioridad', () => {
    const rules = [
      makeRule({ id: 'rule-old', matchPattern: 'uber', categoryId: 'cat-viejo', priority: 5 }),
      makeRule({ id: 'rule-new', matchPattern: 'uber', categoryId: 'cat-nuevo', priority: 10 }),
    ];
    const result = new MatchCategorizationRule().execute('Uber', rules);
    expect(result).toBe('cat-nuevo');
  });
});
