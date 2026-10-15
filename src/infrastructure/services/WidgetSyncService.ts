/**
 * ZenMoney — Servicio de Sincronización de Widgets Android (Jetpack Glance)
 *
 * Envía el presupuesto disponible y estado financiero al Widget nativo de Android.
 */

import { NativeModules, Platform } from 'react-native';

const { ZenMoneyWidgetModule } = NativeModules;

export interface WidgetBudgetData {
  remainingBudget: number;
  spentPercentage?: number;
  currency?: string;
  statusText?: string;
}

export class WidgetSyncService {
  /**
   * Formatea un número en moneda local (por defecto COP).
   */
  private static formatCurrency(amount: number, currency: string = 'COP'): string {
    try {
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: currency,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `$ ${Math.round(amount).toLocaleString('es-CO')}`;
    }
  }

  /**
   * Actualiza los datos visuales del Widget nativo en Android.
   */
  static async updateWidget(data: WidgetBudgetData): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    if (!ZenMoneyWidgetModule?.updateWidgetData) {
      return false;
    }

    try {
      const remainingFormatted = this.formatCurrency(data.remainingBudget, data.currency || 'COP');
      const spentPercent = data.spentPercentage ?? 0;
      
      let status = data.statusText;
      if (!status) {
        if (data.remainingBudget <= 0) {
          status = 'Presupuesto agotado';
        } else if (spentPercent > 80) {
          status = `${Math.round(spentPercent)}% consumido (Atención)`;
        } else {
          status = `${Math.round(spentPercent)}% consumido este mes`;
        }
      }

      await ZenMoneyWidgetModule.updateWidgetData(
        remainingFormatted,
        status,
        spentPercent
      );
      return true;
    } catch (error) {
      console.error('[WidgetSyncService] Error al actualizar widget nativo:', error);
      return false;
    }
  }
}
