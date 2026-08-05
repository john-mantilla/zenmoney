# Guía de Uso e Integración: Galaxy Watch 7 (Wear OS 6 / One UI 8.0 Watch)

Esta guía explica cómo registrar gastos por voz usando tu **Galaxy Watch 7** en la app **ZenMoney**, implementando la **Fase 1** (Google Assistant App Actions & Direct Deep Links).

---

## 🚀 Fase 1: Funcionamiento por Voz con Google Assistant (Sin Intermediarios)

La Fase 1 utiliza la integración nativa de Google Assistant en **Wear OS 6** sin instalar WhatsApp o Telegram en el reloj, protegiendo así la batería de tu Galaxy Watch 7.

### 🎙️ Comandos de Voz Admitidos

Puedes activar Google Assistant desde tu reloj (presionando el botón físico o diciendo *"Hey Google"*) y pronunciar cualquiera de las siguientes frases:

1. *"Hey Google, dile a ZenMoney que gasté 35 mil pesos en almuerzo"*
2. *"Hey Google, registrar gasto en ZenMoney: 50 mil de gasolina con tarjeta"*
3. *"Hey Google, dile a ZenMoney: pagué 120 mil del recibo de energía"*

---

## 🛠️ Cómo Funciona la Arquitectura de la Fase 1

```
 ┌─────────────────────────────────────────────────────────┐
 │ Galaxy Watch 7 (Wear OS 6 / One UI 8.0 Watch)           │
 │ 🎙️ Google Assistant transcribe:                         │
 │ "Pagué 30 mil en gasolina"                               │
 └──────────────────────────┬──────────────────────────────┘
                            │ (Dispara Deep Link / Intent)
                            ▼
 ┌─────────────────────────────────────────────────────────┐
 │ Deep Link Handler                                       │
 │ zenmoney://register-voice?text=Pagué 30 mil en gasolina │
 └──────────────────────────┬──────────────────────────────┘
                            │
                            ▼
 ┌─────────────────────────────────────────────────────────┐
 │ ZenMoney App (Android / Expo)                           │
 │ Recibe la frase y la envía a Gemini Flash API           │
 └──────────────────────────┬──────────────────────────────┘
                            │
                            ▼
 ┌─────────────────────────────────────────────────────────┐
 │ Gemini Flash API + PostgreSQL (Supabase / Offline)      │
 │ • Monto: $30.000                                        │
 │ • Categoría: ⛽ Transporte / Gasolina                   │
 │ • Cuenta: Principal                                     │
 │ 📱 Formulario se autocompleta e informa con háptico     │
 └─────────────────────────────────────────────────────────┘
```

---

## 📲 Cómo probarlo localmente (ADB / Deep Link Test)

Para verificar el funcionamiento del deep link en un dispositivo Android o emulador conectado por ADB:

```bash
# Probar el Deep Link directo con una frase de voz simulada
adb shell am start -W -a android.intent.action.VIEW -d "zenmoney://register-voice?text=Pagu%C3%A9%2045%20mil%20en%20el%20supermercado" com.zenmoney.app
```

Al ejecutar esta orden, ZenMoney se abrirá procesando instantáneamente la frase con Gemini Flash e introduciendo el gasto categorizado.

---

## 🔮 Siguiente Paso: Fase 2 (Tile & Complicación Nativa)

En la Fase 2 agregaremos:
* **Complicación en la Carátula:** Un toque en la pantalla de inicio del reloj para abrir el micrófono sin hablarle a Google Assistant.
* **Tile (Tarjeta):** Tarjeta dedicada en Wear OS 6 con un botón gigante de voz + visualización del saldo restante del mes.
