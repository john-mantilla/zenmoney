# Rules and Directives for AI Agents (`AGENTS.md`)

## 1. Versiones y Expo Core
- **Expo v57.0.0**: Lee siempre la documentación oficial correspondiente a Expo SDK 57 en https://docs.expo.dev/versions/v57.0.0/ antes de proponer cambios estructurales o añadir librerías.

## 2. Sistema de Diseño e Impeccable UI (`DESIGN.md`)
- **Fuente de la Verdad UI/UX**: Consulta y respeta estrictamente las directrices del archivo [`DESIGN.md`](file:///d:/Documentos/Iniciativas/FinanzasPersonales/zenmoney/DESIGN.md).
- **Cero AI Slop**: No utilices tarjetas planas grises sin sombra ni contraste, gradientes morados/azules por defecto o componentes de interfaz genéricos.
- **Tipografía Numérica**: Todas las cifras monetarias deben usar la fuente `Plus Jakarta Sans` (`amountLarge`, `amount`, `amountSmall`) e incluir formateo monetario adecuado.
- **Micro-interacciones y Hápticos**: Toda acción interactiva primaria debe incluir animación suave con `react-native-reanimated` y feedback táctil con `expo-haptics`.
- **Target Táctil y Soporte Dual Theme**: Asegura un mínimo de 44x44 pt para elementos interactivos y verifica el comportamiento tanto en **Light Mode** como en **Dark Mode**.
