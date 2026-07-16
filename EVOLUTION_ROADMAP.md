# EVOLUTION_ROADMAP.md — ZenMoney: Deuda Técnica y Plan de Evolución

Este documento presenta una auditoría crítica de los puntos débiles del software actual y establece la estrategia de refactorización progresiva (Zero-Downtime Refactoring) para elevar a ZenMoney a un estándar de producción empresarial.

---

## 1. Diagnóstico de Deuda Técnica y Puntos de Falla (SPOF)

Tras auditar detalladamente la base de código, se han identificado las siguientes vulnerabilidades estructurales clasificadas por su estado actual y severidad:

### 🟢 Fallos Críticos Recientemente Corregidos [RESOLVED]
- **Modelo Inexistente de Gemini (Llamadas a gemini-3.5-flash)**:
  - *Problema*: `GeminiFlashProvider.ts` llamaba a `gemini-3.5-flash` provocando que el asistente y el modo IA fallaran silenciosamente.
  - *Solución*: Corregido a **`gemini-1.5-flash`**. El asistente IA ahora funciona correctamente.
- **Desfase de Zona Horaria (Fecha de 12/Jul mostrada como 11/Jul en Movimientos)**:
  - *Problema*: `new Date('2026-07-12')` parseaba la fecha en UTC medianoche y al restar el desfase local de Colombia (GMT-5) retrocedía al 11 de julio.
  - *Solución*: Reemplazado por un parseo seguro con división de strings en `TransactionCard.tsx` para forzar la creación del objeto en hora local.
- **Duplicación de Facturas Recurrentes al Pagar Adelantado**:
  - *Problema*: `GenerateRecurringInstances.ts` mapeaba ocurrencias por `transactionDate`. Al adelantar un pago y cambiar la fecha a "hoy", el motor no encontraba el pago en el día original de vencimiento y generaba una factura duplicada sin pagar.
  - *Solución*: Cambiado para mapear ocurrencias usando `tx.aiMetadata?.dueDate || tx.transactionDate`. El motor ahora sabe que la recurrencia ya está pagada.
- **Visualización de Facturas Pagadas como Ingreso (Suma en lugar de Resta)**:
  - *Problema*: En `bills.tsx` el grupo "PAGADAS" mostraba su total con `type="income"`, lo que pintaba las facturas con un signo `+` y de color verde en la agenda, simulando que pagar deudas sumaba dinero.
  - *Solución*: Corregido a `type="expense"`. Ahora se visualiza correctamente con signo menos e indicador de débito.

---

### 🔴 Severidad Crítica (Riesgos de Rendimiento y Consistencia Pendientes)
1. **Bucle de Consulta N+1 en Cálculo de Saldos (`CalculateAccountBalance.ts` - línea 62)**:
   - Para calcular las transferencias entrantes, el caso de uso realiza una consulta `transactionRepository.getAll({ status: 'confirmed' })` sin filtros de cuenta. Esto descarga **todas** las transacciones confirmadas de la base de datos a memoria para luego filtrarlas con un bucle `for`. Con 5,000 transacciones, la app se congelará al inicio del Dashboard.
2. **Bucle N+1 en Generación de Recurrencias (`GenerateRecurringInstances.ts` - línea 46)**:
   - Dentro de un bucle `for` que itera por cada regla de recurrencia activa, la app hace una llamada a `transactionRepo.getAll()` sin filtros. Si hay 15 reglas y 1,000 transacciones en el historial, la base de datos es consultada 15 veces descargando 15,000 registros innecesarios en cada recarga de pantalla.
3. **Omisión de Lógica en Recurrencias Anuales (`ProjectMonthlyRunway.ts` - línea 138)**:
   - La lógica de proyección financiera ignora por completo las reglas de frecuencia `'yearly'`. Si un usuario tiene un cobro anual fuerte en el mes actual (ej. un seguro de $2.000.000), la proyección del saldo final lo omitirá, induciendo a errores de liquidez.
4. **Desbordamiento de Fechas a Fin de Mes (`GenerateRecurringInstances.ts` - línea 115)**:
   - Si una regla mensual está configurada para los días 29, 30 o 31, al avanzar el mes mediante `setMonth(+1)`, JavaScript desborda la fecha al mes posterior si el mes destino tiene menos días (ej: 31 de enero -> 31 de febrero se convierte automáticamente en 3 de marzo). Esto duplica transacciones e invalida la agenda.

---

### 🟠 Severidad Media (Vicios Arquitectónicos y dead-code)
5. **Acoplamiento Directo en Ajustes (`Settings.tsx` - 966 líneas)**:
   - Es un componente "Dios". Contiene toda la UI de gestión de cuentas, categorías, recurrencias e invitaciones en un solo archivo. Además, realiza consultas directas al cliente crudo de Supabase para invitaciones familiares bypassendo la capa de Repositorios de Dominio.
6. **Huérfanos de Dominio (`SavingsGoal`, `UserProfile`, `FamilyGroup`)**:
   - Aunque las entidades están definidas en la carpeta `src/domain/entities/`, no existen sus correspondientes interfaces de repositorio. El módulo de metas de ahorro está inactivo e incompleto.
7. **Casts Inseguros (`as any`) en Casos de Uso**:
   - `GenerateRecurringInstances` inyecta propiedades adicionales a la transacción usando `as any` porque la interfaz `CreateTransactionInput` carece de los campos `isRecurringInstance`, `recurringRuleId` y `status`. Esto expone al código a fallos silenciosos si la base de datos descarta variables no declaradas.
8. **Basura en el Enrutador (`two.tsx`, `modal.tsx`)**:
   - Archivos temporales autogenerados por el andamiaje original de Expo que siguen siendo compilados y cargados en el enrutamiento estático de la app.

---

### 🟡 Severidad Baja (UX e Interfaz)
9. **Fechas mediante Texto Plano**:
   - En dispositivos móviles, la app no levanta un selector de fecha nativo (DatePicker). El usuario debe escribir manualmente la fecha en formato string `YYYY-MM-DD`, lo cual genera alta fricción y errores de formato.
10. **Refrescos Redundantes de Foco**:
    - Las pantallas de Dashboard y Movimientos recargan toda su información desde Supabase cada vez que ganan el foco (`useFocusEffect` sin políticas de caché local).

---

## 2. Plan de Estabilidad Absoluta
Acciones inmediatas para mitigar los riesgos críticos de lógica:

- **Optimización de Consultas de Saldo**:
  - Crear e integrar un filtro específico en `TransactionFilters` (`transferToAccountId?: string`).
  - Modificar el Repositorio de Supabase para filtrar la query mediante SQL: `.eq('transfer_to_account_id', accountId)`.
- **Mitigación de Consultas N+1 de Recurrencias**:
  - Agregar `recurringRuleId` a `TransactionFilters`.
  - Modificar el generador para que solo consulte las transacciones ya creadas para esa regla específica: `transactionRepo.getAll({ recurringRuleId: rule.id })`.
- **Normalización Temporal**:
  - Reemplazar el cálculo basado en `setUTCHours` y `setHours` en los use cases por una biblioteca ultraligera de manipulación de fechas (como `date-fns` o normalizar todo estrictamente a UTC-5 mediante strings YYYY-MM-DD sin desfases de hora local).
- **Protección de Fin de Mes en Recurrencias**:
  - Implementar la validación de recorte de fin de mes:
    ```typescript
    const targetDay = rule.dayOfMonth;
    const lastDayOfTargetMonth = new Date(year, month + 1, 0).getDate();
    const safeDay = Math.min(targetDay, lastDayOfTargetMonth);
    ```

---

## 3. Plan de Modularización y Escalabilidad

Para permitir que ZenMoney escale a múltiples desarrolladores y nuevas características sin corromperse, aplicaremos los principios SOLID:

```
[Módulo Ajustes] (Monolito de 966 líneas)
       │
       ├───► [SettingsAccountsScreen.tsx]   (CRUD Cuentas + Préstamos)
       ├───► [SettingsCategoriesScreen.tsx] (Árbol de Categorías)
       ├───► [SettingsRecurrencesScreen.tsx] (Reglas de Facturación Recurrente)
       └───► [SettingsFamilyScreen.tsx]      (Invitaciones y Miembros)
```

- **Completar el Contrato de Dominio**:
  - Implementar `SavingsGoalRepository` en la capa de datos.
  - Implementar `SavingsGoal` mapper en `Mapper.ts` para resolver el crash latente de conversión.
  - Crear e integrar `UserProfileRepository` para desacoplar el módulo de familia del cliente de Supabase crudo.
- **Implementar Componentes de UI Nativos**:
  - Integrar `@react-native-community/datetimepicker` para proveer una experiencia premium en la edición y agendamiento de cobros.
- **Eliminación de Residuos**:
  - Borrar definitivamente `app/(tabs)/two.tsx` y `app/modal.tsx`.

---

## 4. Roadmap de Evolución Iterativa (Zero-Downtime)

Este plan de 4 etapas permite refactorizar la app sin interrumpir la funcionalidad de cara al usuario final:

### 🚀 Etapa 1: Hotfixes y Estabilidad Crítica (En Progreso)
- **Objetivo**: Corregir los fallos de consultas y lógica de fechas que comprometen el rendimiento.
- **Tareas**:
  1. [DONE] Corregir la URL y modelo de la API de Gemini (`gemini-1.5-flash`).
  2. [DONE] Solucionar desfase de fecha (local timezone) en tarjetas de transacciones.
  3. [DONE] Impedir duplicación de cobros recurrentes en pagos anticipados.
  4. [DONE] Resolver bug visual de facturas pagadas sumando dinero.
  5. Optimizar `CalculateAccountBalance` inyectando el filtro de transferencias en base de datos.
  6. Optimizar `GenerateRecurringInstances` inyectando el filtro de ID de regla de recurrencia.
  7. Resolver el bug de desbordamiento de fin de mes y el soporte para recurrencias anuales (`yearly`).
  8. Agregar `useFocusEffect` a las pantallas de Ajustes y Presupuestos para sincronizar cambios.
  9. Eliminar los archivos huérfanos `two.tsx` y `modal.tsx`.

### 📦 Etapa 2: Saneamiento del Modelo de Datos e Infraestructura
- **Objetivo**: Completar los contratos de Clean Architecture y mitigar casts de tipado inseguros.
- **Tareas**:
  1. Escribir los métodos del mapeador `toDomainSavingsGoal` y `toDbSavingsGoal` en `Mapper.ts`.
  2. Implementar los repositorios e interfaces para `SavingsGoal` y `UserProfile`.
  3. Reemplazar todas las consultas crudas a Supabase en `Settings.tsx` por llamadas a los nuevos repositorios.
  4. Modificar `CreateTransactionInput` en el dominio para incorporar tipados nativos opcionales que eviten el uso de `as any`.

### 🎨 Etapa 3: Modularización Visual e Interfaz de Usuario
- **Objetivo**: Limpiar el código sucio (Code Smells) de la capa de presentación.
- **Tareas**:
  1. Dividir `Settings.tsx` en 4 pantallas independientes dentro de la ruta `app/settings/` usando rutas dinámicas de Expo Router.
  2. Homologar todos los estilos en línea de los componentes (`BalanceCard`, `TransactionCard`) utilizando la estructura del hook `useAppTheme()`.
  3. Cambiar el motor de animación de escala del `TransactionCard` de Animated API a `react-native-reanimated` 4 para optimizar el rendimiento en hilo nativo de UI.

### ♿ Etapa 4: Experiencia Premium y Accesibilidad
- **Objetivo**: Proveer facilidades de entrada de datos nativos y soporte accesible.
- **Tareas**:
  1. Instalar e integrar un selector de fechas de Expo para reemplazar las entradas de texto plano.
  2. Implementar `accessibilityLabel` e `accessibilityRole` en todos los componentes interactivos.
  3. Adaptar el visor de monedas `AmountDisplay` para dar soporte dinámico a múltiples símbolos configurables.
