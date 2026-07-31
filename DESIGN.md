# ZenMoney — Impeccable Design System & Guidance (`DESIGN.md`)

Este documento constituye la **fuente de la verdad de UI/UX y Sistema de Diseño** para la aplicación **ZenMoney** (React Native + Expo). Ha sido estructurado siguiendo las directrices del framework **Impeccable.style** para garantizar interfaces móviles de nivel premium, eliminando el "AI slop" (diseño plano genérico, baja jerarquía y componentes sin vida).

---

## 1. Identidad de Producto & Principios de Diseño

ZenMoney es una plataforma de finanzas personales diseñada para inspirar **claridad, tranquilidad y control financiero**.

### Principios Fundamentales (Impeccable Rules):
* **Cero "AI Slop"**: Prohibido usar tarjetas planas anidadas sin jerarquía, fondos grises muertos o gradientes morados/azules genéricos por defecto.
* **Precisión Numérica de Alto Impacto**: Toda cifra monetaria debe resaltar con tipografía numérica dedicada (`Plus Jakarta Sans`) y jerarquía según su naturaleza (Ingreso/Gasto/Balance).
* **Retroalimentación Táctil & Viva**: Toda acción primaria (guardar, crear transacción, cambiar filtro) debe incluir feedback háptico (`expo-haptics`) y animaciones fluidas de micro-interacción (150ms - 250ms con `react-native-reanimated`).
* **Accesibilidad Táctil Nativa**: Todo botón, chip o elemento interactivo debe respetar el objetivo táctil mínimo de **44×44 pt**.

---

## 2. Paleta de Colores (Sistema de Tokens)

ZenMoney soporta **Light Mode** y **Dark Mode** de forma nativa mediante la paleta definida en `src/presentation/theme/colors.ts`.

### 🌿 Modo Claro (Light Mode)
* **Fondo Principal (`background`)**: `#F0F2F5` (Neutro suave, no blanco puro para reducir fatiga).
* **Superficie (`surface`)**: `#FFFFFF` (Elevación y contenedores con sombra suave).
* **Primario (Branding)**: `#2E7D5F` (Verde Esmeralda Profundo — Transmite estabilidad y crecimiento).
* **Primario Claro (`primaryLight`)**: `#4A9D7E`
* **Ingresos (`income`)**: `#27AE60` (Verde Éxito brillante).
* **Gastos (`expense`)**: `#E74C3C` (Rojo Coral cálido, no agresivo).
* **Transferencias (`transfer`)**: `#3B82F6` (Azul Eléctrico).
* **Aviso / Metas (`accent`)**: `#F5A623` (Ámbar dorado).
* **Texto Principal (`text`)**: `#1A1A2E` (Azul Noche profundo, contraste 14:1).
* **Texto Secundario (`textSecondary`)**: `#6B7280`.

### 🌙 Modo Oscuro (Dark Mode)
* **Fondo Principal (`background`)**: `#0D1117` (Negro azabache con tinte azul profundo).
* **Superficie (`surface`)**: `#161B22` (Gris noche elevado).
* **Superficie Variante (`surfaceVariant`)**: `#1C2333`.
* **Primario**: `#4A9D7E`.
* **Ingresos (`income`)**: `#66BB6A`.
* **Gastos (`expense`)**: `#EF5350`.
* **Texto Principal (`text`)**: `#F0F6FC`.
* **Texto Secundario (`textSecondary`)**: `#8B949E`.

---

## 3. Jerarquía Tipográfica (`typography.ts`)

Usamos un sistema dual de fuentes para maximizar la legibilidad UI y la distinción de balances financieros:

| Token | Fuente | Tamaño | Peso | Uso |
| :--- | :--- | :--- | :--- | :--- |
| `amountLarge` | **Plus Jakarta Sans** | 36pt | 800 (ExtraBold) | Balances principales, Totales de Salud Financiera |
| `amount` | **Plus Jakarta Sans** | 22pt | 700 (Bold) | Montos en listas de transacciones y tarjetas |
| `amountSmall` | **Plus Jakarta Sans** | 15pt | 600 (SemiBold) | Desgloses secundarios y presupuestos |
| `h1` | **Inter** | 28pt | 700 (Bold) | Títulos de pantalla principal |
| `h2` | **Inter** | 24pt | 600 (SemiBold) | Encabezados de sección |
| `h3` | **Inter** | 20pt | 600 (SemiBold) | Títulos de tarjetas y modales |
| `body` | **Inter** | 15pt | 400 (Regular) | Cuerpo de texto |
| `bodySmall` | **Inter** | 13pt | 400 (Regular) | Subtítulos, descripciones secundarias |
| `caption` | **Inter** | 11pt | 400 (Regular) | Fechas, marcas de tiempo, etiquetas menores |

---

## 4. Elevación, Sombras y Bordes (`shadows.ts` & `borderRadius.ts`)

* **Radios de Borde**:
  * `xs`: 4px (Insignias pequeñas)
  * `sm`: 8px (Campos de entrada, chips)
  * `md`: 12px (Botones principales, elementos de lista)
  * `lg`: 16px (Tarjetas de contenido principales)
  * `xl`: 24px (Contenedores flotantes, Modal Bottom Sheets)
  * `full`: 9999px (Pills y Avatares)

* **Sombras (Light Mode)**:
  * **Sombra de Tarjeta (`md`)**: `shadowColor: '#1A1A2E'`, `shadowOffset: { width: 0, height: 4 }`, `shadowOpacity: 0.06`, `shadowRadius: 8`, `elevation: 3`.
  * **Sombra Flotante (FAB / Modales `lg`)**: `shadowOpacity: 0.12`, `shadowRadius: 16`, `elevation: 6`.

---

## 5. Reglas de Componentes & UX Movil

### 💳 Tarjetas Financieras (Cards)
* Nunca usar tarjetas con borde gris plano sin sombra o sin contraste con el fondo.
* Para la tarjeta de **Balance Total**, usar `expo-linear-gradient` suave con el color primario o metálico.
* Incluir indicadores visuales claros (+ / - / flecha hacia arriba o abajo) en cada tarjeta de transacción.

### 🔘 Botones e Interacciones
* Los botones principales deben tener un estado activo visual (scale reduction a `0.97` con `Reanimated` al presionar).
* Invocar `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` en cada toque de botón primario.
* Los estados deshabilitados deben reflejar claridad (`disabled` color + `opacity: 0.5`) sin perder contraste del texto.

### 📊 Gráficos (`react-native-gifted-charts`)
* Usar curvas suavizadas (`curved`) con gradiente de relleno bajo la curva (`areaChart`).
* Los colores de las series deben respetar estrictamente los tokens (`income`, `expense`, `accent`).
* Incluir tooltips animados al tocar un punto del gráfico.

---

## 6. Lista de Verificación "Impeccable Quality Checklist"

Antes de dar por completada una pantalla o componente, verificar:

- [ ] ¿El texto numérico usa `PlusJakartaSans` y formato de moneda localizado (`$1,250.00`)?
- [ ] ¿Los botones e íconos interactivos tienen un área táctil mínima de 44x44 pt?
- [ ] ¿Se probó la vista tanto en **Light Mode** como en **Dark Mode**?
- [ ] ¿Las animaciones duran entre 150ms y 250ms y no bloquean el hilo UI?
- [ ] ¿Existe feedback háptico (`Haptics`) en las acciones clave?
- [ ] ¿Los estados vacíos (*Empty States*) o de carga (*Skeletons*) tienen diseño dedicado y mensajes empáticos?
