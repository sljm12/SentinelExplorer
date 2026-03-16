# SentinelExplorer Project Overview

SentinelExplorer is a full-stack application designed to search and explore satellite imagery from the Copernicus DataSpace. It provides an interactive map interface for selecting areas of interest and filtering satellite data based on various criteria.

## Main Technologies
- **Frontend:** React (v19) with TypeScript, Vite, and Tailwind CSS.
- **Mapping:** OpenLayers (v10.x) for interactive map rendering and spatial filtering.
- **Backend:** Express server acting as a proxy for the Copernicus OData API to handle CORS and provide a unified API endpoint.
- **Icons:** Lucide React for consistent UI iconography.
- **Animation:** Motion (formerly Framer Motion) for UI transitions.

## Architecture
The project follows a client-server architecture:
- The **Express server** (`server.ts`) handles API proxying and serves the static frontend assets in production.
- The **React frontend** (`src/App.tsx`) manages the user interface, map interactions, and search state.
- **OData API:** The application integrates with the Copernicus DataSpace OData API for querying satellite products.

## Building and Running

### Prerequisites
- Node.js (v18 or higher recommended)

### Development
1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Set up environment variables:**
   Create a `.env` file (referencing `.env.example`) and add your `GEMINI_API_KEY`.
3. **Run the application:**
   ```bash
   npm run dev
   ```
   This command starts the Express server using `tsx`, which also integrates Vite's development middleware.

### Production
1. **Build the project:**
   ```bash
   npm run build
   ```
2. **Preview the build:**
   ```bash
   npm run preview
   ```

## Development Conventions
- **Component Style:** Functional components using React hooks (`useState`, `useEffect`, `useRef`).
- **Styling:** Utility-first CSS using Tailwind CSS.
- **Type Safety:** TypeScript is used across the project; run `npm run lint` for type checking.
- **API Requests:** External API calls should ideally be proxied through the Express backend to manage headers and avoid CORS issues.
- **Map Integration:** OpenLayers is used for all spatial operations. Coordinates are typically handled in `EPSG:4326` (Lon/Lat) and transformed to `EPSG:3857` (Web Mercator) for display.

## Key Files
- `server.ts`: The Express backend implementation and API proxy logic.
- `src/App.tsx`: The primary React component containing the search UI and map logic.
- `src/main.tsx`: The application entry point.
- `vite.config.ts`: Configuration for Vite and Tailwind CSS integration.
- `metadata.json`: Application metadata, including potential integration points for Gemini-powered features.
