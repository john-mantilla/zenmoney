/**
 * ZenMoney — Repositorio Híbrido de Desafíos (HybridChallengeRepository)
 *
 * Maneja la persistencia y consulta de desafíos de 7 días (tanto predefinidos
 * como los generados dinámicamente por la IA).
 */

import { Challenge } from '@/src/domain/entities/Challenge';

const STORAGE_KEY = '@zenmoney_active_challenges_v1';

export class HybridChallengeRepository {
  private inMemoryChallenges: Challenge[] = [];

  async getAll(): Promise<Challenge[]> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          return JSON.parse(stored);
        }
      }
    } catch {
      // Fallback a memoria local si no hay localStorage
    }
    return this.inMemoryChallenges;
  }

  async saveAll(challenges: Challenge[]): Promise<void> {
    this.inMemoryChallenges = challenges;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(challenges));
      }
    } catch {}
  }

  async create(newChallenge: Challenge): Promise<Challenge> {
    const all = await this.getAll();
    const filtered = all.filter((c) => c.id !== newChallenge.id);
    const updated = [newChallenge, ...filtered];
    await this.saveAll(updated);
    return newChallenge;
  }

  async update(id: string, updates: Partial<Challenge>): Promise<Challenge | null> {
    const all = await this.getAll();
    const index = all.findIndex((c) => c.id === id);
    if (index === -1) return null;

    const updatedItem = { ...all[index], ...updates };
    all[index] = updatedItem;
    await this.saveAll(all);
    return updatedItem;
  }
}
