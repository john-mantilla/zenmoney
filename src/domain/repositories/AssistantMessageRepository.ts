/**
 * ZenMoney — Interface AssistantMessageRepository
 */

import { AssistantMessage, CreateAssistantMessageInput } from '../entities/AssistantMessage';

export interface AssistantMessageRepository {
  /** Últimos mensajes del usuario actual, en orden cronológico ascendente. */
  getRecent(limit: number): Promise<AssistantMessage[]>;
  create(input: CreateAssistantMessageInput): Promise<AssistantMessage>;
  /** Borra todo el hilo del usuario actual (para "Nueva conversación"). */
  deleteAll(): Promise<void>;
}
