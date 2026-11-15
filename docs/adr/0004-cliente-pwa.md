# ADR-0004: Cliente — PWA pura (Tauri 2 queda como plan de contingencia)

Estado: aceptado
Fecha: 2026-11-14

## Contexto
Plataformas: Windows, Linux (navegadores Zen y Chrome) y Android (Galaxy Tab S10 FE, Galaxy A56; Chrome). Fuerzas en tensión:
- **Temporizador:** Android congela pestañas y PWAs en segundo plano.
- **Notificaciones:** una PWA no puede programar notificaciones locales para cuando esté cerrada (Chrome abandonó *Notification Triggers*). Las únicas vías son Web Push (pasa por FCM/Mozilla y requiere servidor) o un empaquetado nativo.
- **Archivos:** Obsidian (ADR-0003) y Syncthing (ADR-0002) necesitarían File System Access, ausente en Firefox/Zen.

## Opciones consideradas
| Opción | Pros | Contras | Recursos aprox. |
|---|---|---|---|
| **PWA pura** | Opción por defecto de la guía; un código; actualización instantánea; nada que instalar para desarrollar | Sin avisos con la app cerrada; sin acceso a carpetas en Zen/Firefox; el navegador puede borrar datos | Sin instalador; RAM del navegador |
| Tauri 2 desde el inicio | Notificaciones programadas (AlarmManager), sistema de archivos, SQLite nativo | Rust + Android SDK/NDK (varios GB); compilación lenta; WebKitGTK en Linux con diferencias de renderizado | Instalador 3–10 MB; 40–80 MB RAM; MIT/Apache-2.0 |
| PWA + Tauri cuando una historia lo exija | Mismo código detrás de puertos | Disciplina de no llamar APIs del navegador fuera de adaptadores | — |

## Decisión
**PWA pura**, elegida por el usuario. Igualmente se respeta la regla de la guía §6: toda capacidad dependiente de plataforma (almacenamiento, notificaciones, archivos, reloj) es un **puerto** con adaptador, así que envolver con Tauri más adelante no reescribe la app.

Consecuencias de diseño para el MVP:
- El Pomodoro guarda `inicio` y `duración` y calcula el restante con el `Reloj`; nunca cuenta "ticks". Si Android congela la app, al volver el tiempo es correcto y la sesión se cierra con la hora real de fin.
- Al terminar con la app visible: sonido + vibración (`navigator.vibrate`, si existe) + notificación (`Notification`, si hay permiso). Con la app cerrada: no hay aviso; se muestra al volver.
- Recordatorios de entregas: se calculan y muestran **al abrir** la app (bandeja "Próximos vencimientos").

## Consecuencias
- Se acepta no tener aviso con pantalla bloqueada. **Disparador para revisar este ADR:** si el usuario reporta que el aviso perdido le hace fallar sesiones o entregas, abrir ADR para Tauri 2 (empaquetar la misma `web/`).
- En Zen/Firefox en Linux la PWA no se "instala" como app (soporte de instalación de PWA en Firefox para Linux aún en desarrollo a nov. 2026); funciona igual en una pestaña.
