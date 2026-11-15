# Visión — Ludus

> *Ludus*: en latín, "juego" y "escuela" a la vez.

## Problema
Un estudiante universitario reparte su semestre entre el calendario del celular, notas sueltas, recordatorios de entregas en la cabeza y apps de Pomodoro que no saben de sus materias. Nada está conectado, nada recompensa el esfuerzo constante y, cuando se pierde el hilo (una racha rota, una entrega olvidada), es fácil abandonar el sistema entero. Las apps que lo integran todo suelen ser de pago, viven en la nube de otro o pesan demasiado para un Android de gama media.

## Usuario
Una sola persona: estudiante universitario en Colombia (zona `America/Bogota`), que usa a diario un PC con **Windows y Linux** (navegadores Zen y Chrome), una **Galaxy Tab S10 FE** y un **Galaxy A56** (Chrome). Sabe programar y quiere poder extender la app él mismo.

## Objetivos
1. **Un solo lugar** para materias, entregas, eventos y sesiones de estudio, coherente en los tres sistemas.
2. **Motivación sostenible:** un progreso estilo RPG que premie el cumplimiento real (estudiar, entregar a tiempo, planear) y que **no castigue** ni se pueda "farmear".
3. **Mis datos son míos:** todo local, sin conexión, sin cuentas ni pagos, exportable en un clic a JSON legible.
4. **Liviana:** abrir en menos de 2 s en el A56 y responder en menos de 100 ms; menos de 150 KB de JS inicial.
5. **Extensible:** agregar un módulo nuevo es agregar una carpeta, sin tocar los demás.

## No-objetivos (por ahora)
- Varios usuarios, cuentas, colaboración o compartir datos con otros.
- Sincronización automática entre dispositivos (v1: exportar/importar; ver ADR-0002).
- Leer o escribir la bóveda de Obsidian (ver ADR-0003).
- Avisos con la app cerrada o la pantalla bloqueada (limitación de las PWA; ver ADR-0004).
- iOS/macOS como plataformas probadas (deberían funcionar en Safari, pero no se verifican).
- Integraciones con plataformas de la universidad (Moodle, SIA, correo).
- Estética pixel art en el MVP (prevista como tema posterior; ver ADR-0007).

## Cómo sabremos que funciona
- Se usa al menos 5 días por semana durante un mes.
- Ninguna entrega se registra después de su fecha por olvido.
- Cero pérdidas de datos (con respaldos exportados semanalmente).
