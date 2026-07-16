/**
 * ZenMoney — Entidad AssistantMessage
 *
 * Un turno de la conversación entre el usuario y el asistente IA, persistido
 * para que la conversación sobreviva entre sesiones (cerrar y volver a abrir
 * la app) y para dar contexto de turnos previos al modelo.
 */

export type AssistantSender = 'user' | 'ai';

export interface AssistantMessage {
  id: string;
  familyGroupId: string;
  userId: string;
  sender: AssistantSender;
  content: string;
  suggestedActions: string[];
  createdAt: string;
}

export interface CreateAssistantMessageInput {
  sender: AssistantSender;
  content: string;
  suggestedActions?: string[];
}
