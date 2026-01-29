

# Plan: Gestor de Recibos para Contador

## Objetivo
Sistema web donde clientes suben recibos en PDF y el contador los gestiona con estados de seguimiento. Diseño profesional y minimalista.

---

## 1. Sistema de Autenticación y Roles

### Flujo de registro y acceso:
- **Página de login** para todos los usuarios (email + contraseña)
- **Página de registro público** donde los clientes pueden crear cuenta
- **Sistema de aprobación**: Las cuentas nuevas quedan en estado "pendiente" hasta que el admin las apruebe
- **Dos roles**: `CLIENT` y `ADMIN`

### Permisos:
- **CLIENT pendiente**: Solo ve mensaje "Tu cuenta está pendiente de aprobación"
- **CLIENT aprobado**: Ve y gestiona únicamente sus propios recibos
- **ADMIN**: Acceso completo a todos los recibos y gestión de usuarios

---

## 2. Panel del Cliente (Aprobado)

### Vista "Mis Recibos"
- Lista de recibos en tabla con columnas:
  - Nombre original del archivo
  - Fecha de gasto (la que asignó el cliente)
  - Fecha de subida (automática)
  - Estado (badge de color: Nuevo, Revisado, Facturado, Archivado)
  - Acciones: Ver/Descargar PDF
- Ordenamiento por fecha de gasto o fecha de subida (ascendente/descendente)
- Filtros básicos por estado

### Formulario "Subir Recibo"
- Campo para seleccionar archivo PDF (solo acepta PDF, máximo 20MB)
- Selector de fecha de gasto (obligatorio)
- Validación de tipo de archivo antes de subir
- Feedback visual del progreso de subida

---

## 3. Panel de Administración (Contador)

### Dashboard principal
- Resumen rápido: Total recibos, nuevos hoy, pendientes de revisar

### Gestión de Recibos
- Vista de todos los recibos de todos los clientes
- Filtros por:
  - Cliente
  - Estado (Nuevo, Revisado, Facturado, Archivado)
  - Rango de fechas
- Acciones en cada recibo:
  - Cambiar estado (dropdown)
  - Editar fecha de gasto
  - Ver/Descargar PDF
- Ordenamiento por cualquier columna

### Gestión de Usuarios/Clientes
- Lista de clientes registrados
- Ver estado: Pendiente / Aprobado / Inactivo
- Botón para aprobar cuentas pendientes
- Botón para desactivar cuentas si es necesario

---

## 4. Modelo de Datos

### Tabla `profiles`
- ID de usuario (enlazado a autenticación)
- Nombre completo
- Rol (CLIENT / ADMIN)
- Estado de cuenta (pending / approved / inactive)
- Fecha de creación

### Tabla `receipts`
- ID único (UUID para seguridad)
- ID del cliente propietario
- Nombre original del archivo (para mostrar)
- Ruta del archivo en storage (nombre seguro generado)
- Fecha de gasto (ingresada por cliente)
- Fecha de subida (automática)
- Estado: NEW, REVIEWED, INVOICED, ARCHIVED
- Notas del admin (opcional, para futuro)

---

## 5. Seguridad

- **Validación de PDF**: Por extensión y content-type
- **Límite de tamaño**: 20MB máximo
- **Nombres de archivo seguros**: Generados con UUID, sin usar nombre original en paths
- **Row Level Security (RLS)**: Clientes solo acceden a sus propios recibos
- **Contraseñas**: Hasheadas automáticamente por Supabase
- **Storage seguro**: Bucket privado con políticas de acceso

---

## 6. Diseño Visual

- **Estilo profesional y minimalista**
- Colores neutros (grises, azul oscuro para acentos)
- Tipografía limpia y legible
- Sidebar de navegación colapsable
- Tablas con bordes suaves y buen espaciado
- Badges de colores para estados:
  - Nuevo: Azul
  - Revisado: Amarillo
  - Facturado: Verde
  - Archivado: Gris

---

## 7. Navegación

### Para Clientes:
- Mis Recibos
- Subir Recibo
- Mi Perfil / Cerrar sesión

### Para Admin:
- Dashboard
- Todos los Recibos
- Gestión de Clientes
- Mi Perfil / Cerrar sesión

---

## Lo que NO incluye este MVP (pero se puede agregar después)
- Notificaciones por email
- Exportación de reportes
- Búsqueda por texto en nombre de archivo
- Categorías de gastos
- Comentarios en recibos

