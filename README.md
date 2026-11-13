# KEINER // Space Arcade Portfolio

Portafolio personal estilo videojuego retro espacial dentro de un monitor CRT, optimizado para correr a 60 FPS en cualquier equipo.

## Stack Tecnológico
- **React 19 + TypeScript** — Componentes tipados y estado predecible.
- **Vite** — Servidor de desarrollo instantáneo y bundle optimizado.
- **Tailwind CSS v4** — Diseño responsivo y utilidades sin CSS muerto.
- **HTML5 Canvas + CSS GPU** — Starfield en parallax y efectos CRT ligeros.

## Estructura del Proyecto
```text
src/
├── components/
│   ├── effects/      # Efectos visuales ligeros (Starfield, etc.)
│   └── layout/       # Carcasa CRT, HUD y navegación
├── features/         # Pantallas independientes (start, missions, stats, comms)
├── data/             # Contenido del portafolio separado de la UI
├── types/            # Tipos e interfaces de TypeScript
└── utils/            # Helpers puros (ej. sintetizador 8-bit Web Audio)
```

## Flujo de Trabajo en Git
- `main`: Código estable de producción. **No se hacen commits directos.**
- `develop`: Rama de integración para probar cambios antes de pasar a `main`.
- `feat/*`, `fix/*`, `chore/*`: Ramas de trabajo por tarea usando [Conventional Commits](https://www.conventionalcommits.org/).

## Comandos
```bash
npm install      # Instalar dependencias
npm run dev      # Levantar entorno local
npm run lint     # Revisar reglas con oxlint
npm run build    # Verificar tipos TypeScript y compilar producción
```
