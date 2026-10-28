# Rules and Directives for AI Agents (`AGENTS.md`)

## 1. Versiones y Expo Core
- **Expo v57.0.0**: Lee siempre la documentación oficial correspondiente a Expo SDK 57 en https://docs.expo.dev/versions/v57.0.0/ antes de proponer cambios estructurales o añadir librerías.

## 2. Sistema de Diseño e Impeccable UI (`DESIGN.md`)
- **Fuente de la Verdad UI/UX**: Consulta y respeta estrictamente las directrices del archivo [`DESIGN.md`](file:///d:/Documentos/Iniciativas/FinanzasPersonales/zenmoney/DESIGN.md).
- **Cero AI Slop**: No utilices tarjetas planas grises sin sombra ni contraste, gradientes morados/azules por defecto o componentes de interfaz genéricos.
- **Tipografía Numérica**: Todas las cifras monetarias deben usar la fuente `Plus Jakarta Sans` (`amountLarge`, `amount`, `amountSmall`) e incluir formateo monetario adecuado.
- **Micro-interacciones y Hápticos**: Toda acción interactiva primaria debe incluir animación suave con `react-native-reanimated` y feedback táctil con `expo-haptics`.
- **Target Táctil y Soporte Dual Theme**: Asegura un mínimo de 44x44 pt para elementos interactivos y verifica el comportamiento tanto en **Light Mode** como en **Dark Mode**.

## 3. Compuertas de Calidad Obligatorias (Quality Gates)
Antes de dar por concluida cualquier tarea, refactorización o cambio de código, se DEBE ejecutar la verificación integral:
```bash
npm run verify:all
```
1. **Compuerta 1 (Typecheck & Static Analysis):** `npm run typecheck` (`tsc --noEmit`) debe terminar con código 0. Cero errores de compilación TypeScript.
2. **Compuerta 2 (Test Suite):** `npm test` (`vitest run`) debe pasar el 100% de las pruebas unitarias y de integración.
3. **Compuerta 3 (UI Smoke Test):** Las pruebas de flujo en `src/presentation/__tests__/` deben validar que los cálculos de saldo, ingresos y gastos no devuelvan $0 ni oculten cuentas.
4. **Compuerta 4 (Auditoría Anti-Patrones):**
   - Prohibido el uso de bloques `try/catch` vacíos o con solo `console.warn` en pantallas que oculten fallos de carga simulando saldos en cero.
   - Prohibido filtrar colecciones genéricas en repositorios locales (`WHERE is_active = 1`) que impidan a la UI de ajustes gestionar registros inactivos.
   - Prohibido exponer secretos o API keys privadas en el cliente.
