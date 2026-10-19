# Guía de Configuración - Chatsito Backend

Esta guía explica cómo configurar el entorno de desarrollo local para trabajar en el backend de Chatsito.

## Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

- **Node.js** v22.20.0 o superior
- **npm** v10.9.3 o superior
- **Docker Desktop** (para la base de datos PostgreSQL)
- **Git**

## Pasos de Configuración

### 1. Clonar el Repositorio

```bash
git clone <url-del-repositorio>
cd chatsito_backend
```

### 2. Crear Archivo de Variables de Entorno

El proyecto necesita un archivo `.env` que no está en el repositorio por seguridad. Crea el archivo en la raíz del proyecto:

```bash
# Crea el archivo .env
```

Copia el siguiente contenido en `.env`:

```env
POSTGRES_USER=chatsito
POSTGRES_PASSWORD=chatsito123
POSTGRES_DB=chatsito_db
DATABASE_URL=postgresql://chatsito:chatsito123@localhost:5432/chatsito_db
JWT_SECRET=tu-secreto-largo-y-aleatorio-aqui
JWT_EXPIRES_IN="1d"
UPLOADS_DIR="uploads"
```

**Importante:** Genera un `JWT_SECRET` seguro ejecutando:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Copia el resultado y úsalo como valor de `JWT_SECRET`.

### 3. Levantar la Base de Datos con Docker

El proyecto usa PostgreSQL en un contenedor Docker para desarrollo local.

```bash
docker compose up -d
```

Esto descargará la imagen de PostgreSQL y creará las tablas automáticamente usando el script `db/init.sql`.

Verifica que el contenedor esté corriendo:
```bash
docker compose ps
```

Deberías ver algo como:
```
NAME                          STATUS
chatsito_backend-postgres-1   Up (healthy)
```

### 4. Instalar Dependencias

```bash
npm install
```

### 5. Generar Prisma Client

Prisma necesita generar el cliente de TypeScript basado en el esquema de la base de datos:

```bash
npx prisma generate
```

### 6. Correr el Backend en Modo Desarrollo

```bash
npm run start:dev
```

El servidor arrancará en `http://localhost:3000`.

### 7. Verificar que Todo Funciona

Prueba el endpoint de salud:
```bash
curl http://localhost:3000/api/health
```

Deberías recibir:
```json
{"status":"ok","database":"up"}
```

## Comandos Útiles

### Desarrollo
- `npm run start:dev` - Correr en modo watch (recarga automática)
- `npm run start` - Correr en modo normal
- `npm run build` - Compilar el proyecto
- `npm run start:prod` - Correr en modo producción

### Base de Datos
- `docker compose up -d` - Levantar la base de datos
- `docker compose down` - Detener la base de datos
- `docker compose down -v` - Detener y borrar los datos (cuidado)
- `docker compose ps` - Ver estado de contenedores
- `docker compose exec postgres psql -U chatsito -d chatsito_db` - Entrar a la consola de PostgreSQL

### Prisma
- `npx prisma generate` - Regenerar el cliente de Prisma
- `npx prisma studio` - Abrir Prisma Studio (GUI para ver la BD)

### Testing
- `npm run test` - Correr tests unitarios
- `npm run test:e2e` - Correr tests end-to-end
- `npm run test:cov` - Correr tests con cobertura

## Estructura del Proyecto

```
chatsito_backend/
├── db/
│   └── init.sql              # Script de inicialización de la base de datos
├── prisma/
│   ├── schema.prisma         # Esquema de Prisma (generado desde la BD)
│   └── migrations/           # Migraciones de Prisma
├── src/
│   ├── database/
│   │   ├── prisma.service.ts # Servicio de Prisma con conexión PostgreSQL
│   │   └── prisma.module.ts  # Módulo global de Prisma
│   ├── modules/              # Módulos de negocio (users, messages, etc.)
│   ├── health.controller.ts  # Endpoint de verificación de estado
│   ├── app.module.ts         # Módulo principal
│   └── main.ts               # Punto de entrada
├── compose.yaml              # Configuración de Docker Compose
├── .env.example              # Ejemplo de variables de entorno
└── SETUP.md                  # Este archivo
```

## Solución de Problemas

### Error: "docker: command not found"
Asegúrate de tener Docker Desktop instalado y corriendo. Descárgalo desde https://www.docker.com/products/docker-desktop

### Error: "Cannot find module '../generated/prisma'"
Ejecuta `npx prisma generate` para regenerar el cliente de Prisma.

### Error: "Database connection failed"
Verifica que Docker esté corriendo y que el contenedor de PostgreSQL esté healthy:
```bash
docker compose ps
```

Si el contenedor no está corriendo, levántalo con:
```bash
docker compose up -d
```

### Error: "Module not found" en npm install
Borra `node_modules` y `package-lock.json`, luego reinstala:
```bash
rm -rf node_modules package-lock.json
npm install
```

## Notas Importantes

- Cada desarrollador tiene su propia base de datos local (no se comparten datos)
- El archivo `.env` no está en git por seguridad (credenciales)
- No modifiques `db/init.sql` a menos que todos los desarrolladores necesiten cambios
- Para cambios en el esquema de la base de datos, coordina con el equipo

## Siguiente: Desarrollo

Una vez configurado el entorno, puedes empezar a desarrollar. Los módulos están en `src/modules/`:
- `users/` - Gestión de usuarios
- `messages/` - Mensajes del chat
- `groups/` - Grupos y conversaciones
- `media/` - Archivos multimedia

El prefijo global de la API es `/api`, por ejemplo:
- `http://localhost:3000/api/health` - Verificación de estado
- `http://localhost:3000/api/users` - Usuarios (cuando se implemente)
