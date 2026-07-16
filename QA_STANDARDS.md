# QA_STANDARDS.md — ZenMoney: Suite de Calidad

Este documento define la estrategia de pruebas, los criterios de aceptación del producto, los casos de borde críticos identificados en la auditoría y los procedimientos de validación manual.

---

## 1. Criterios de Aceptación Globales
Cualquier nueva característica o cambio debe cumplir las siguientes directrices antes de ser promovido:

1. **Exactitud Contable Dinámica**:
   - Todo cambio en el ledger (`transactions`) debe impactar inmediatamente en el balance calculado de las cuentas involucradas.
   - Las transacciones en estado `pending` **no deben** alterar el saldo dinámico ni el consumo de presupuestos. Solo las transacciones `confirmed` participan.
2. **Cero Fugas de Datos (Privacidad RLS)**:
   - Las operaciones CRUD deben ejecutarse en el contexto de sesión del usuario. No se permite realizar consultas directas que no filtren por políticas de Supabase.
3. **Persistencia de Metadata en Flujos**:
   - Al editar una transacción o marcar una factura como pagada en el formulario `new.tsx`, se debe garantizar que el `recurringRuleId`, `isRecurringInstance` y el `dueDate` original no se destruyan ni se guarden como `null` en la base de datos.
4. **Actualización Automática de Vistas (Real-Time UX)**:
   - Al regresar de crear, editar o pagar una factura o transacción, las pantallas de **Dashboard (Resumen)**, **Movimientos** y **Facturas** deben mostrar la información actualizada de inmediato. Esto se logra forzando la recarga en foco con `useFocusEffect`.

---

## 2. Casos de Borde Críticos y Puntos de Falla (Edge Cases)
Los siguientes casos especiales han sido catalogados como **Riesgos de Calidad** y deben validarse explícitamente en cualquier suite de testing:

- **Diferencia de Zonas Horarias (UTC vs Local)**:
  - El motor de recurrencias calcula ocurrencias usando normalización UTC (`setUTCHours(0,0,0,0)`), mientras que el cálculo de Runway utiliza zona horaria local (`setHours()`). Esto puede desplazar el registro de un día a otro en zonas horarias negativas (como GMT-5 Colombia) si no se homologa.
- **Desbordamiento de Fecha Mensual (Day of Month Overflow)**:
  - Al generar recurrencias mensuales agendadas para el día 31 (ej. factura de servicios), la lógica en febrero o meses de 30 días puede desbordarse al inicio del mes siguiente si no se aplica un recorte de fin de mes (`Math.min(dayOfMonth, lastDayOfMonth)`).
- **Transferencias en Tarjetas de Crédito**:
  - El caso de uso `CalculateAccountBalance` actualmente no deduce ni procesa transacciones tipo `transfer` en cuentas de tipo `credit_card`. Si un usuario realiza un pago a su tarjeta de crédito mediante una transferencia desde su cuenta de ahorros, la deuda no se restará en la tarjeta a menos que el tipo se registre como `income` en la tarjeta (lo cual rompe el concepto de transferencia).
- **Control de Roles**:
  - Un usuario con rol `viewer` debe tener bloqueada la capacidad de mutación en la interfaz. Cualquier intento de enviar datos a `create`, `update` o `delete` en los repositorios debe ser abortado por las RLS de la base de datos (retornando error 403), y la UI debe deshabilitar visualmente estos botones.
- **Ámbitos del Presupuesto (Scope)**:
  - El caso de uso `CalculateBudgetProgress` no discrimina por `ownerUserId` cuando el presupuesto tiene un ámbito `individual`. Debe asegurarse que los presupuestos individuales solo acumulen gastos de su creador, y no del total familiar.

---

## 3. Estrategia de Pruebas Requerida

### A. Pruebas Unitarias (Lógica del Dominio)
- **Framework**: Vitest (configurado en `vitest.config.ts`).
- **Foco**: Validar los casos de uso (`CalculateAccountBalance`, `ValidateTransaction`, `DetectAtypicalExpense`, `GenerateRecurringInstances`) inyectando repositorios simulados (*mocks*).
- **Ejemplo de escenario unitario (Bancolombia Balance)**:
  - Dado un balance inicial de $1.756.000.
  - Al procesar un gasto confirmado de $30.000 (Spotify) -> balance = $1.726.000.
  - Al procesar un gasto pendiente de $100.000 -> balance debe seguir siendo $1.726.000.

### B. Pruebas de Integración (Datos y RLS)
- Validar las funciones de mapeo (`Mapper.ts`) para garantizar que la transformación de tipos no altere la precisión numérica (`Number()` vs `parseFloat()`).
- Verificar que las inserciones directas respeten los constraints únicos y checks de tipo.

### C. Pruebas Funcionales (UX y Navegación)
- Comprobación de que la edición de transacciones herede correctamente los campos correspondientes a la factura original.
- Comprobación de que el calendario de Facturas pinte los días con indicadores naranja (pendientes) o verde (completamente pagadas) basándose en la fecha del vencimiento original (`dueDate`) y no en la de pago.

---

## 4. Guía de Verificación Manual (Paso a Paso)
Para comprobar que los cambios de corrección de estabilidad funcionan, se debe ejecutar el siguiente protocolo:

1. **Creación de Factura Manual**:
   - Ir a la pestaña **Facturas**, abrir el diálogo y registrar "Spotify" por $30.000 venciendo el 10 de julio (pasado).
   - Validar que el día 10 de julio en el calendario se resalta en **Naranja** y Spotify aparece en la sección "SIN PAGAR".
2. **Registro de Pago (Liquidación)**:
   - Tocar el día 10 de julio, pulsar **Pagar** en la factura de Spotify.
   - En el formulario, asignar la cuenta "Bancolombia" y cambiar la fecha de transacción a **HOY 12 de julio** (simulando pago tardío).
   - Presionar **Guardar**.
3. **Auditoría Post-Pago**:
   - El formulario debe cerrarse y regresar automáticamente a Facturas.
   - El día 10 de julio en el calendario debe cambiar a **Verde** (indica que el vencimiento del 10 está cubierto).
   - En la lista inferior del día 10 de julio, debe mostrarse Spotify en el grupo de **PAGADAS**, indicando: `Vence: 10 de jul • Pagada el: 12 de jul`.
   - Ir a la pestaña de **Movimientos**; la transacción de Spotify debe aparecer allí listada de inmediato con fecha del 12 de julio.
   - Ir al **Resumen** (Dashboard); el saldo de Bancolombia debe haberse decrementado por exactamente $30.000 en tiempo real sin necesidad de recargar manualmente la pantalla.
