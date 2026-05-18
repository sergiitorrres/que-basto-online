# ¡Que Basto! - Juego de Cartas Online

Un simulador online del clásico juego de cartas "El Culo" (también conocido como Presidente), desarrollado con un stack moderno basado en JavaScript. Permite partidas públicas y privadas con amigos en tiempo real.

## 🚀 Tecnologías Utilizadas

### Frontend
- **React 19**: Interfaz de usuario dinámica y reactiva.
- **Vite**: Herramienta de construcción ultra rápida.
- **Framer Motion**: Animaciones fluidas para las cartas y transiciones.
- **CSS Modules**: Estilos encapsulados por componente.
- **Socket.io-client**: Comunicación en tiempo real con el servidor.

### Backend
- **Node.js & Express**: Servidor de aplicaciones y API.
- **Socket.io**: Motor de comunicación bidireccional basado en eventos.
- **Nodemon**: Gestión del entorno de desarrollo.

### Infraestructura
- **Docker & Docker Compose**: Contenerización para un despliegue sencillo y consistente.

## 📂 Estructura del Proyecto

```text
├── client/          # Aplicación Frontend (React + Vite)
├── server/          # Lógica del Servidor y del Juego (Node.js)
├── docker-compose.yml
└── package.json     # Scripts globales para el monorepo
```

## 🛠️ Instalación y Ejecución Local

### Requisitos Previos
- Node.js (v18 o superior)
- npm

### Pasos
1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/sergiitorrres/juego-cartas-culo-online.git
   cd juego-cartas-culo-online
   ```

2. **Instalar todas las dependencias:**
   ```bash
   npm run install-all
   ```

3. **Ejecutar en modo desarrollo:**
   ```bash
   npm run dev
   ```
   *Esto iniciará el cliente en `http://localhost:5173` y el servidor en `http://localhost:3000` simultáneamente.*

## 🐳 Ejecución con Docker

Si prefieres usar Docker, puedes levantar todo el sistema con un solo comando:

```bash
docker-compose up --build
```

El juego estará disponible en `http://localhost:5173`.

## 🎮 Reglas del Juego
El objetivo es quedarse sin cartas. Dependiendo del orden de finalización, los jugadores obtienen roles para la siguiente ronda (Presidente, Vicepresidente, Neutro, Viceculo, Culo), lo que afecta al intercambio de cartas inicial.

---
