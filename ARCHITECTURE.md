# ARCHITECTURE.md — ZenMoney: Plano de Ingeniería

Este documento describe la arquitectura lógica, el flujo de datos, el stack tecnológico y los patrones de diseño aplicados en ZenMoney.

---

## 1. Stack Tecnológico
El sistema está construido bajo la combinación de las siguientes tecnologías:

- **Frontend / Cliente**:
  - **Core**: React Native + Expo (SDK 57, TypeScript en modo estricto).
  - **Enrutamiento**: Expo Router (File-based routing, Typed Routes habilitados).
  - **Diseño Visual**: React Native Paper (MD3 design system) + Custom HSL/Hex theme tokens (soporte automático para Modo Oscuro).
  - **Animaciones**: Animated API de RN (con miras a migrar a Reanimated).
  - **Estado Global**: Zustand (Gestión ligera y reactiva del estado de autenticación).
- **Backend / Persistencia / Infraestructura**:
  - **Base de Datos**: PostgreSQL alojado en Supabase Cloud.
  - **Seguridad**: Row-Level Security (RLS) policies + JWT de Supabase Auth.
  - **IA & NLQ**: Gemini API (modelo Gemini 1.5 Flash) consumido mediante cliente REST directo para parseo de lenguaje natural.

---

## 2. Arquitectura de Software: Clean Architecture
ZenMoney implementa una variante simplificada de Clean Architecture para separar las reglas de negocio de los detalles de infraestructura:

```mermaid
graph TD
    subgraph Presentation_Layer [Capa de Presentación - app/ & src/presentation/]
        Screens[Pantallas Expo Router] --> Components[Componentes Reutilizables]
        Screens --> Theme[Diseño y Tokens de Tema]
    end

    subgraph Domain_Layer [Capa de Dominio - src/domain/]
        UseCases[Casos de Uso - Lógica pura] --> Entities[Entidades y Modelos de Dominio]
        UseCases --> RepoInterfaces[Interfaces de Repositorios]
    end

    subgraph Data_Layer [Capa de Datos y Persistencia - src/data/]
        RepoImpls[Implementaciones de Repositorio] --> Mappers[Mapeadores de Datos - Mapper.ts]
    end

    subgraph Infrastructure_Layer [Capa de Infraestructura - src/infrastructure/]
        SupabaseClient[Supabase client & Auth Store]
        AILayer[Gemini Flash Provider]
    end

    %% Relaciones de dependencia (apuntan hacia adentro/arriba)
    Screens --> UseCases
    Screens --> RepoInterfaces
    RepoImpls -- Implementa --> RepoInterfaces
    RepoImpls --> SupabaseClient
    RepoImpls --> Mappers
```

### Capas del Directorio `src/`
1. **`domain/` (Dominio)**: Contiene las entidades puras de TypeScript (ej: `Transaction`, `Account`, `Budget`) y los casos de uso (`CalculateAccountBalance`, `GenerateRecurringInstances`, etc.). No depende de nada externo.
2. **`data/` (Datos)**: Implementa las interfaces de repositorios del dominio conectándolas con Supabase. Contiene `Mapper.ts`, responsable de la transformación bidireccional entre las filas de BD (`snake_case`) y las entidades (`camelCase`).
3. **`infrastructure/` (Infraestructura)**: Gestión del cliente de Supabase, el almacén de autenticación global (`useAuthStore`) y el proveedor de IA.
4. **`presentation/` (Presentación)**: Componentes reactivos, hooks personalizados de temas (`useAppTheme`) y utilidades visuales de MD3.

---

## 3. Flujo de Datos (Data Flow)
El siguiente diagrama detalla cómo viaja la información al ejecutar una acción común de negocio: **Pagar una Factura Agendada**.

```mermaid
sequenceDiagram
    autonumber
    actor Usuario
    participant UI as Vista de Facturas (bills.tsx)
    participant Form as Formulario (transaction/new.tsx)
    participant Repo as SupabaseTransactionRepository
    participant DB as Supabase PostgreSQL

    Usuario->>UI: Selecciona Factura del 10/Jul y pulsa "Pagar"
    UI->>Form: Redirige con parámetro id (ID de transacción)
    Note over Form: Carga la transacción en estado 'pending'
    Usuario->>Form: Cambia fecha al 12/Jul y pulsa "Guardar"
    Form->>Form: Cambia status a 'confirmed' y preserva metadata (dueDate original)
    Form->>Repo: invoca update(id, inputData)
    Note over Repo: Mapper.toDbTransaction() convierte a snake_case
    Repo->>DB: UPDATE transactions SET status = 'confirmed', transaction_date = '2026-07-12', ... WHERE id = ID
    DB-->>Repo: Devuelve fila de BD modificada
    Note over Repo: Mapper.toDomainTransaction() convierte a camelCase
    Repo-->>Form: Devuelve Transaction actualizada
    Form->>UI: Retorna (router.back())
    Note over UI: useFocusEffect recarga datos
    UI->>DB: Consulta transacciones actualizadas del mes
    DB-->>UI: Retorna transacciones
    Note over UI: Muestra factura como PAGADA en el día 10/Jul
```

---

## 4. Gestión de Estado Global vs. Local
- **Estado Global (`Zustand`)**:
  - Exclusivo para el perfil del usuario autenticado, el token de sesión y el grupo familiar activo (`useAuthStore`).
  - Permite a la app validar el flujo de guards al inicio (`app/_layout.tsx`) y denegar accesos en tiempo real.
- **Estado Local (`React.useState`)**:
  - Las pantallas cargan su propio estado al recibir el foco usando `useFocusEffect`.
  - No existe un caché de datos contables centralizado en memoria (ej: Redux o React Query); cada pantalla interactúa directamente con los repositorios para garantizar que los saldos y listados reflejen inmediatamente los cambios de la base de datos sin latencia de sincronización.
