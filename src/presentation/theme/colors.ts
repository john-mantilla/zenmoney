/**
 * ZenMoney — Paleta de Colores
 */

export const Colors = {
  light: {
    primary: '#2E7D5F',         // Verde esmeralda (Branding/Ingresos)
    primaryLight: '#4A9D7E',
    primaryDark: '#1B5E42',
    secondary: '#1A1A2E',       // Azul oscuro profundo
    accent: '#F5A623',          // Ámbar dorado (Alertas/Metas)
    danger: '#E74C3C',          // Rojo coral (Gastos/Alertas críticas)
    dangerLight: '#FDECEA',
    success: '#27AE60',
    successLight: '#E8F5E9',
    warning: '#F5A623',
    warningLight: '#FFF8E1',
    background: '#F0F2F5',      // Fondo claro de app
    surface: '#FFFFFF',         // Tarjetas/Contenedores
    surfaceVariant: '#F8F9FA',  // Fondos alternativos
    text: '#1A1A2E',            // Texto principal
    textSecondary: '#6B7280',   // Texto secundario (Gris oscuro)
    textTertiary: '#9CA3AF',
    border: '#E5E7EB',
    disabled: '#D1D5DB',
    income: '#27AE60',
    expense: '#E74C3C',
    transfer: '#3B82F6',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  dark: {
    primary: '#4A9D7E',
    primaryLight: '#6ABFA0',
    primaryDark: '#2E7D5F',
    secondary: '#1A1A2E',
    accent: '#F5A623',
    danger: '#EF5350',
    dangerLight: '#3D1F1F',
    success: '#66BB6A',
    successLight: '#1B3D1F',
    warning: '#FFB74D',
    warningLight: '#3D331A',
    background: '#0D1117',      // Fondo oscuro
    surface: '#161B22',         // Tarjetas oscuras
    surfaceVariant: '#1C2333',
    text: '#F0F6FC',            // Texto principal claro
    textSecondary: '#8B949E',   // Texto secundario gris
    textTertiary: '#6E7681',
    border: '#30363D',
    disabled: '#484F58',
    income: '#66BB6A',
    expense: '#EF5350',
    transfer: '#64B5F6',
    overlay: 'rgba(0, 0, 0, 0.7)',
  },
};

export type ColorScheme = typeof Colors.light;
export type ColorThemeMode = 'light' | 'dark';
