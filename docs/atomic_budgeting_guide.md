# Guía de Presupuesto en Hábitos Atómicos (Atomic Budgeting)

## 1. Filosofía y Enfoque Conductual

Los presupuestos mensuales tradicionales suelen fallar porque imponen límites abstractos a 30 días (*"Tengo \$600.000 COP para ocio este mes"*). Esto genera dos grandes problemas:
1. **Brecha intención-acción**: A las 1:30 PM de un martes frente a un menú, nadie hace la división mental de cuántos días faltan y cuánto ha gastado.
2. **Efecto "Qué más da" (*What-the-hell effect*)**: Un solo gasto imprevisto a mitad de mes provoca desánimo, culpa y abandono del seguimiento.

Inspirado en la metodología de **Hábitos Atómicos** (James Clear), este módulo transforma los límites mensuales en un sistema de micro-decisiones de mínima fricción:

---

## 2. Las 4 Leyes Aplicadas a las Finanzas Personales

### 1ª Ley: Hacerlo Obvio (The Cue / La Señal)
* **Daily Safe-to-Spend (Disponible de Hoy)**: La app calcula cada mañana cuánto puedes gastar hoy de forma segura sin comprometer el fin de mes.
* **Ponderación de Fin de Semana (1.5x)**: Reconoce que los viernes, sábados y domingos hay mayor gasto social, asignando una cuota proporcionalmente superior sin generar falsas alarmas de sobregiro.
* **Nudge Matutino (08:00 AM)**: Recordatorio sutil que fija la intención del día antes de que ocurran los impulsos de gasto.

### 2ª Ley: Hacerlo Atractivo (The Craving / El Anhelo)
* **Días en Verde**: Cumplir con la cuota diaria otorga un distintivo visual inmediato.
* **Rachas de Disciplina (*Streaks*)**: Contador de días consecutivos dentro del ritmo.
* **Filosofía de Resiliencia**: *"Nunca falles dos veces seguidas"*. Si un día hay sobregiro, el sistema recalcula suavemente los días restantes sin mensajes de culpa ni bloqueos.

### 3ª Ley: Hacerlo Fácil (The Response / La Respuesta)
* **Regla de los 2 Minutos (1-Tap Quick Action)**: Notificaciones interactivas y banners en el Dashboard que permiten registrar o validar el gasto habitual en menos de 2 segundos.
* **Micro-reglas concretas**:
  * *Tope por ocasión* (ej. almuerzo máximo \$30.000 COP).
  * *Día Cero Gasto* (ej. martes sin compras discrecionales).
  * *Frecuencia semanal* (ej. máximo 2 salidas a cenar por semana).

### 4ª Ley: Hacerlo Satisfactorio (The Reward / La Recompensa)
* **Micro-Sweep (Barrido de Ahorro)**: Al final del día, el excedente no gastado de tu cuota diaria puede transferirse simbólicamente con 1 toque hacia tu meta de ahorro (vacaciones, fondo de emergencia o hucha).

---

## 3. Control y Autonomía del Usuario (Feature Toggles)

El usuario tiene control total sobre esta funcionalidad y puede:
1. **Interruptor Maestro (Global ON/OFF)**: En cualquier momento puede desactivar los hábitos atómicos y Safe-to-Spend desde Ajustes, volviendo al modo de presupuesto mensual clásico.
2. **Control Granular por Categoría**: Activar la metodología solo en categorías variables o discrecionales (ej. Restaurantes, Entretenimiento, Cafés) y mantener categorías fijas (ej. Servicios Públicos, Arriendo) sin cálculos diarios.
3. **Ajuste de Ponderación**: Activar o desactivar el multiplicador de fin de semana según su estilo de vida.

---

## 4. Arquitectura y Componentes Técnicos

```
src/
├── domain/
│   ├── entities/
│   │   └── AtomicHabit.ts             # Entidades AtomicHabit, DailyPacing, HabitStreak
│   ├── services/
│   │   ├── AtomicPacingService.ts     # Cálculo determinista on-device de Safe-to-Spend
│   │   └── StreakTrackerService.ts    # Motor de rachas y resiliencia
│   └── usecases/
│       ├── CalculateDailyPacing.ts    # Orquestador del disponible del día
│       ├── CreateAtomicHabit.ts       # Validación y creación de micro-reglas
│       ├── ConfirmHabitExpense.ts     # Registro ultra-rápido en 1 toque
│       ├── EvaluateDayStatus.ts       # Evaluación de Día en Verde y Daily Surplus
│       └── ExecuteMicroSweep.ts       # Transferencia de excedente a meta de ahorro
├── infrastructure/
│   ├── services/
│   │   └── HabitNotificationManager.ts# Notificaciones locales con botones interactivos
│   └── state/
│       └── habitSettingsStore.ts      # Store reactivo Zustand con persistencia local
└── presentation/
    └── components/
        ├── DailySafeToSpendCard.tsx   # Tarjeta de disponible de hoy en Dashboard
        ├── OneTapHabitBanner.tsx      # Banner interactivo para registro en 1 tap
        ├── StreakCelebrationBadge.tsx # Distintivo de rachas y Día en Verde
        ├── HabitSettingsSection.tsx   # Panel de configuración y switches de toggle
        └── CreateAtomicHabitModal.tsx # Modal de traducción de presupuesto a hábito
```
