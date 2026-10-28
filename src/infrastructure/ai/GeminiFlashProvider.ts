/**
 * ZenMoney — Gemini Flash AI Provider (Server-Side Mediated)
 *
 * Implementa la interfaz AIProvider realizando llamadas exclusivamente a las Edge Functions
 * de Supabase (server-side). Las credenciales de Google Gemini residen en el Vault de Supabase,
 * garantizando cero exposición de claves en el cliente móvil o web.
 */

import { Account } from '@domain/entities/Account';
import { Category } from '@domain/entities/Category';
import { AIProvider, NLQParseResult, NLQQueryResult, FinancialContext, ConversationTurn } from './AIProvider';
import { supabase } from '@infrastructure/supabase/client';

export class GeminiFlashProvider implements AIProvider {
  readonly name = 'Google Gemini Flash Provider (Supabase Edge)';

  async parseTransaction(
    input: string,
    accounts: Account[],
    categories: Category[]
  ): Promise<NLQParseResult> {
    const localToday = new Date();
    const localYear = localToday.getFullYear();
    const localMonth = String(localToday.getMonth() + 1).padStart(2, '0');
    const localDay = String(localToday.getDate()).padStart(2, '0');
    const localTodayStr = `${localYear}-${localMonth}-${localDay}`;

    try {
      console.log('[Gemini Provider] Invocando Edge Function parse-nlq...');
      
      const { data, error } = await supabase.functions.invoke('parse-nlq', {
        body: {
          input,
          accounts: accounts.map(a => ({ id: a.id, name: a.name, type: a.type })),
          categories: categories.map(c => ({ id: c.id, name: c.name })),
          referenceDate: localTodayStr,
        }
      });

      if (error) {
        throw new Error(error.message || 'Error en respuesta de Edge Function parse-nlq.');
      }

      if (data) {
        return {
          ...data,
          amount: data.amount,
          type: data.type,
          suggestedCategoryName: data.suggestedCategoryName,
          suggestedAccountName: data.suggestedAccountName,
          merchantName: data.merchantName,
          description: data.description,
          transactionDate: this.resolveTransactionDate(data.transactionDate, localTodayStr),
          confidence: data.confidence || 1,
          needsUserInput: [],
          rawInput: input,
        } as any;
      }

      throw new Error('Respuesta vacía del servicio de IA.');
    } catch (err: any) {
      console.error('[Gemini Provider] Error al invocar parse-nlq:', err);
      throw new Error(err?.message || 'No fue posible interpretar la transacción con IA. Por favor intenta de nuevo.');
    }
  }

  async parseReceiptImage(
    imageBase64: string,
    mimeType: string,
    accounts: Account[],
    categories: Category[]
  ): Promise<NLQParseResult> {
    const localToday = new Date();
    const localTodayStr = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, '0')}-${String(localToday.getDate()).padStart(2, '0')}`;

    try {
      console.log('[Gemini Provider] Invocando Edge Function parse-receipt-image...');

      const { data, error } = await supabase.functions.invoke('parse-receipt-image', {
        body: {
          imageBase64,
          mimeType,
          accounts: accounts.map(a => ({ id: a.id, name: a.name, type: a.type })),
          categories: categories.map(c => ({ id: c.id, name: c.name })),
          referenceDate: localTodayStr,
        }
      });

      if (error) {
        throw new Error(error.message || 'Error en respuesta de Edge Function parse-receipt-image.');
      }

      if (data) {
        return {
          ...data,
          transactionDate: this.resolveTransactionDate(data.transactionDate, localTodayStr),
          confidence: data.confidence || 0,
          needsUserInput: [],
          rawInput: '[foto de recibo]',
        } as any;
      }

      throw new Error('Respuesta vacía del servicio de lectura de recibos.');
    } catch (err: any) {
      console.error('[Gemini Provider] Error al invocar parse-receipt-image:', err);
      throw new Error(err?.message || 'No fue posible leer la imagen del recibo con IA.');
    }
  }

  async queryFinances(
    question: string,
    context: FinancialContext,
    history: ConversationTurn[] = []
  ): Promise<NLQQueryResult> {
    try {
      console.log('[Gemini Provider] Invocando Edge Function chat-assistant...');
      const { data, error } = await supabase.functions.invoke('chat-assistant', {
        body: {
          question,
          context,
          history,
        },
      });

      if (error) {
        throw new Error(error.message || 'Error en respuesta de Edge Function chat-assistant.');
      }

      if (data && data.answer) {
        return {
          answer: data.answer,
          suggestedActions: data.suggestedActions || [],
          pendingAction: data.pendingAction || null,
        };
      }

      throw new Error('Respuesta vacía del Asistente Financiero.');
    } catch (err: any) {
      console.error('[Gemini Provider] Error al invocar chat-assistant:', err);
      throw new Error(err?.message || 'El Asistente Financiero no pudo responder en este momento.');
    }
  }

  /**
   * Valida la fecha que devolvió el modelo antes de confiar en ella: debe ser un
   * "YYYY-MM-DD" real y no una fecha futura lejana (protege contra alucinaciones del modelo).
   * Si no pasa la validación, se usa la fecha local de hoy como respaldo seguro.
   */
  private resolveTransactionDate(candidate: unknown, fallbackToday: string): string {
    if (typeof candidate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
      const parsedDate = new Date(candidate + 'T00:00:00');
      const oneYearAhead = new Date();
      oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);
      if (!isNaN(parsedDate.getTime()) && parsedDate <= oneYearAhead) {
        return candidate;
      }
    }
    return fallbackToday;
  }
}
