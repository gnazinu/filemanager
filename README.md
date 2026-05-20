# GestorDoc

Sistema de gestión de recibos y documentos contables. Permite a contadores (admin) gestionar clientes y sus recibos, y a los clientes subir y consultar sus documentos.

## Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: shadcn/ui + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Routing**: React Router v6
- **Forms**: React Hook Form + Zod
- **Estado del servidor**: TanStack Query

## Requisitos

- Node.js 18+
- npm

## Desarrollo local

```bash
npm install
npm run dev
```

La app corre en `http://localhost:8080`.

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run preview` | Preview del build |
| `npm run test` | Ejecutar tests |
| `npm run lint` | Linting |

## Estructura del proyecto

```
src/
├── features/         # Módulos de negocio (auth, admin, receipts, users)
├── components/       # Componentes compartidos (layout, ui)
├── hooks/            # Custom hooks globales
├── integrations/     # Clientes externos (Supabase)
├── lib/              # Utilidades
├── pages/            # Páginas raíz (login, register, etc.)
└── types/            # Tipos TypeScript
```

## Roles

- **ADMIN**: Contador. Gestiona clientes, aprueba cuentas, revisa recibos.
- **CLIENT**: Cliente. Sube y consulta sus propios recibos.

## Variables de entorno

El cliente de Supabase se configura en `src/integrations/supabase/client.ts`. Las credenciales se obtienen del proyecto Supabase correspondiente.
