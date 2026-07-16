# CONTEXT.md — ZenMoney: Mapa Mental del Proyecto

Este documento establece el propósito estratégico, las reglas operativas, las restricciones técnicas inviolables y el alcance del sistema ZenMoney. Es la base conceptual que debe guiar a cualquier desarrollador o modelo de lenguaje (LLM) que trabaje sobre este repositorio.

---

## 1. Propósito de Negocio
**ZenMoney** es una plataforma de finanzas personales y familiares multi-inquilino (*multi-tenant*). Su objetivo es permitir a individuos y núcleos familiares:
- **Consolidar múltiples cuentas y obligaciones** (efectivo, bancos, tarjetas de crédito, créditos hipotecarios y préstamos) bajo una única liquidez familiar consolidada.
- **Registrar transacciones de forma inteligente** usando métodos tradicionales (manual), voz o lenguaje natural (NLQ/AI).
- **Controlar el gasto mensual** mediante presupuestos categóricos dinámicos con alertas preventivas.
- **Agendar y anticipar obligaciones financieras (Facturas/Bills)** a través de un calendario interactivo unificado que combina cobros recurrentes automáticos y facturas manuales.

---

## 2. Reglas de Oro del Negocio (Core Tenets)
Estas reglas son los axiomas de la lógica financiera en ZenMoney y no deben violarse bajo ninguna refactorización:

1. **Saldos Dinámicos vs. Estáticos**: 
   - El saldo real de cualquier cuenta se calcula dinámicamente sumando o restando movimientos confirmados a partir de un balance inicial estático: `saldoActual = initialBalance + ingresos - gastos - transferenciasEnviadas + transferenciasRecibidas`.
   - Las tarjetas de crédito y préstamos operan de forma inversa (los gastos aumentan la deuda/disminuyen el balance disponible).
2. **Positividad del Libro Mayor (Ledger)**:
   - Todo monto (`amount`) guardado en la tabla `transactions` y `recurring_rules` debe ser estrictamente **positivo** (`amount > 0`). El signo contable está determinado únicamente por el tipo (`type` IN `'income'`, `'expense'`, `'transfer'`).
3. **Anclaje de Facturas (Agenda de Vencimientos)**:
   - Una factura pendiente (estado `pending`) o pagada (estado `confirmed`) se ancla al calendario por su fecha de vencimiento original (`dueDate` dentro del campo `aiMetadata`).
   - Si una factura del 10 de julio se paga el 12 de julio, el movimiento contable real (débito) ocurre el 12 de julio para cuadrar con el extracto bancario, pero en la Agenda de Facturas se mantiene visualmente en el día 10 de julio (marcada como pagada) para fines de auditoría del usuario.
4. **No Duplicidad de Recurrencias**:
   - Al pagar de forma anticipada o puntual una factura recurrente, la instancia generada debe marcarse con el `recurringRuleId` y el `dueDate` de la ocurrencia. El motor de recurrencias debe verificar la existencia mediante esta dupla antes de generar duplicados en estado pendiente.
5. **Privacidad Multitenant Estricta**:
   - Ningún usuario puede ver, modificar o enterarse de la existencia de transacciones, cuentas, presupuestos o perfiles de otros grupos familiares. Esto se garantiza a nivel de base de datos mediante RLS (Row-Level Security) basado en `family_group_id`.

---

## 3. Restricciones Técnicas Absolutas
- **Aislamiento de la Capa de Dominio**: La carpeta `src/domain/` debe mantenerse estrictamente pura. **No puede importar librerías externas** ni frameworks (como Supabase, React Native, Zustand o Expo). Únicamente TypeScript nativo y tipos de datos primitivos.
- **Acceso Restringido por Roles**:
  - `admin`: CRUD total, invitaciones familiares, gestión de configuraciones globales del grupo.
  - `editor`: CRUD de transacciones, cuentas, categorías y presupuestos. No puede invitar usuarios ni cambiar roles.
  - `viewer`: Acceso de solo lectura (`SELECT`). La UI debe ocultar o deshabilitar cualquier control de mutación (botones de guardar, eliminar, invitar) para perfiles con este rol.
- **Integridad Cascading Controlada**:
  - No se debe permitir la eliminación física directa en cascada que deje registros huérfanos. Las cuentas deben implementar desactivación lógica (`is_active = false`) en lugar de eliminación para no romper el historial contable de transacciones pasadas.

---

## 4. Alcance Actual del Sistema
El sistema consta de los siguientes módulos funcionales implementados:
1. **Resumen (Dashboard)**: Métricas consolidadas de liquidez real (`Disponible Líquido - Deuda Corto Plazo`) y desglose colapsable en acordeones de cuentas por pilares de liquidez (Cuentas de Dinero, Tarjetas de Crédito, Préstamos y Obligaciones).
2. **Historial de Movimientos**: Ledger cronológico con filtros reactivos en memoria por cuenta, buscador textual y visualización de categorías de 2 niveles (ej: *Vivienda • Servicios públicos*).
3. **Agenda de Facturas**: Calendario mensual interactivo con alertas visuales de facturación pendiente (naranja) y pagada (verde). Resumen mensual agrupado por defecto en "SIN PAGAR" y "PAGADAS".
4. **Presupuestos**: Progreso de consumo de límites categóricos del mes en curso con indicadores semafóricos (`ok <80%`, `warning 80-100%`, `exceeded >100%`).
5. **Asistente IA**: Interfaz conversacional que recopila el contexto financiero completo (saldos, presupuestos, transacciones) y permite interactuar con un modelo LLM (Gemini Flash) para consultas y cargas de transacciones por lenguaje natural.
6. **Ajustes**: CRUD de cuentas, categorías personalizadas, reglas recurrentes e invitaciones del grupo familiar.
