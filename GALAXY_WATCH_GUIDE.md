# Guía de Uso e Integración: Galaxy Watch 7 (Wear OS 6 / One UI 8.0 Watch)

Esta guía explica cómo registrar gastos por voz usando tu **Galaxy Watch 7** en la app **ZenMoney**, implementando tanto la **Fase 1** (Google Assistant App Actions) como la **Fase 2** (Tile Nativo y Complicación de Carátula a 1-Tap).

---

## 🚀 Fase 1: Funcionamiento por Voz con Google Assistant (Sin Intermediarios)

La Fase 1 utiliza la integración nativa de Google Assistant en **Wear OS 6** sin instalar WhatsApp o Telegram en el reloj, protegiendo la batería de tu Galaxy Watch 7.

### 🎙️ Comandos de Voz Admitidos

Puedes activar Google Assistant desde tu reloj (presionando el botón físico o diciendo *"Hey Google"*) y pronunciar cualquiera de las siguientes frases:

1. *"Hey Google, dile a ZenMoney que gasté 35 mil pesos en almuerzo"*
2. *"Hey Google, registrar gasto en ZenMoney: 50 mil de gasolina con tarjeta"*
3. *"Hey Google, dile a ZenMoney: pagué 120 mil del recibo de energía"*

---

## ⌚ Fase 2: Módulo Nativo Wear OS 6 (Tile + Complicación a 1-Tap)

La Fase 2 compila el módulo nativo `:wear` en `android/wear` para tu **Galaxy Watch 7**:

### 1. 🔘 Complicación en la Carátula (1-Tap Watchface Access)
* **Cómo usarla:** Agrega la complicación de ZenMoney (`ZenMoneyComplicationService`) a tu carátula favorita en Wear OS 6.
* **Acción:** Al presionar el icono `🎙️` en la carátula, se abre instantáneamente la pantalla de voz nativa (`ZenMoneyWearActivity`) **sin necesidad de pronunciar "Hey Google"**.

### 2. 🎴 Wear OS Tile (Tarjeta Deslizante en Carousel)
* **Cómo usarla:** En tu reloj, desplázate hacia la derecha en la lista de tarjetas y añade la Tile de **ZenMoney**.
* **Acción:** Muestra un botón directo `[ 🎙️ Registrar Gasto ]`. Al presionarlo, graba tu voz, ejecuta **vibración doble háptica** al capturar el resultado y envía la orden a Gemini Flash API.

---

## 🛠️ Arquitectura del Módulo Nativo Wear OS 6 (`:wear`)

```
 ┌─────────────────────────────────────────────────────────────┐
 │ Galaxy Watch 7 (Wear OS 6 / One UI 8.0 Watch)               │
 │                                                             │
 │  ┌──────────────────────────┐   ┌─────────────────────────┐ │
 │  │ Watchface Complication    │   │ Wear OS Tile Card       │ │
 │  │ (Icono a 1-Tap en pantalla)│   │ (Tarjeta en carrusel)   │ │
 │  └────────────┬─────────────┘   └────────────┬────────────┘ │
 └───────────────┼──────────────────────────────┼──────────────┘
                 └──────────────┬───────────────┘
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ ZenMoneyWearActivity.kt (Android Native Wear OS)            │
 │ • Captura voz con SpeechRecognizer nativo de Wear OS       │
 │ • Vibración Doble Háptica (VibrationEffect.EFFECT_DOUBLE)   │
 └──────────────────────────────┬──────────────────────────────┘
                                │ (Deep Link Intent)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ ZenMoney App + Gemini Flash API                             │
 │ • Interpreta la frase en < 1 segundo                        │
 │ • Guarda en PostgreSQL (Supabase / Offline)                 │
 └─────────────────────────────────────────────────────────────┘
```

---

## 📲 Prueba por ADB del Intent de Voz

Para verificar el funcionamiento del deep link en un dispositivo Android o emulador conectado por ADB:

```bash
# Probar el Deep Link directo con una frase de voz simulada
adb shell am start -W -a android.intent.action.VIEW -d "zenmoney://register-voice?text=Pagu%C3%A9%2045%20mil%20en%20el%20supermercado" com.zenmoney.app
```
