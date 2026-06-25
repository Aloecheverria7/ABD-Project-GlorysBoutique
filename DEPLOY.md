# Despliegue en Coolify

El repo trae un `Dockerfile` por aplicacion y un `docker-compose.yml` opcional.
Hay dos formas de desplegar; elige una.

## Variables clave

| Variable | Dónde | Descripción |
|---|---|---|
| `JWT_SECRET` | API (runtime) | Secreto para firmar los JWT. **Obligatorio**: el API no arranca sin él. |
| `CLIENT_ORIGIN` | API (runtime) | URL pública del cliente (CORS), p. ej. `https://glorys.tudominio.com`. |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | API (runtime) | Conexión a MySQL. |
| `DB_AUTO_MIGRATE` | API (runtime) | `true` para crear/migrar el esquema (Sequelize `sync`) al arrancar. |
| `DB_SEED` | API (runtime) | `true` para sembrar datos de ejemplo en la primera migración. |
| `VITE_API_URL` | Cliente (**build**) | URL pública del API **incluyendo `/api`**, p. ej. `https://api.tudominio.com/api`. Vite la incrusta al compilar, por eso es un *build arg*, no runtime. |

---

## Opción A — Dos aplicaciones separadas (recomendada)

Crea una base de datos MySQL en Coolify (o usa una externa). Luego:

**API (`server`)**
1. Nueva aplicación → desde tu repositorio Git.
2. Build Pack: **Dockerfile**. Base Directory: `/server`.
3. Variables de entorno (runtime): `JWT_SECRET`, `CLIENT_ORIGIN`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_AUTO_MIGRATE=true`, `DB_SEED` (la primera vez).
4. Puerto expuesto: **4000**. Asigna su dominio (p. ej. `api.tudominio.com`).

**Cliente (`client`)**
1. Nueva aplicación → mismo repositorio.
2. Build Pack: **Dockerfile**. Base Directory: `/client`.
3. Build Variable / build arg: `VITE_API_URL=https://api.tudominio.com/api`.
4. Puerto expuesto: **80**. Asigna su dominio (p. ej. `glorys.tudominio.com`).

> Si cambias `VITE_API_URL` debes **reconstruir** el cliente (es valor de build, no de runtime).

---

## Opción B — Un solo recurso con Docker Compose

1. Nuevo recurso → **Docker Compose** → apunta a este repo (`docker-compose.yml` en la raíz).
   Incluye MySQL, API y cliente.
2. Define en Environment Variables: `DB_PASSWORD`, `JWT_SECRET`, `CLIENT_ORIGIN`, `VITE_API_URL`
   (y opcionalmente `DB_NAME`, `DB_SEED`).
3. Asigna dominios a los servicios `server` (puerto 4000) y `client` (puerto 80) desde la UI de Coolify.

La BD persiste en el volumen `db-data`. `DB_AUTO_MIGRATE=true` ya viene fijado para crear el
esquema al primer arranque.

---

## Health checks

El API expone dos sondas (ya integradas en el `HEALTHCHECK` del Dockerfile):

| Ruta | Tipo | Devuelve |
|---|---|---|
| `GET /api/health` (alias `/health`) | Liveness | `200` siempre que el proceso responda. Es la que debe consultar Coolify. |
| `GET /api/health/ready` (alias `/ready`) | Readiness | `200` si MySQL responde; `503` si la base de datos está caída. |

En Coolify, configura el Health Check de la app `server` con:
- **Path**: `/api/health`  ·  **Port**: `4000`  ·  método `GET`, status esperado `200`.

Usa `/api/health/ready` si prefieres que el contenedor se marque como no sano cuando MySQL
no esté disponible (readiness estricta).

El cliente (Nginx) responde `200` en `/`, que sirve como su propio health check.

## Notas

- Cuentas iniciales (si `DB_SEED=true`), contraseña `123`: `admin1`, `admin2`, `admin3`, `dueno` (admin) y `empleado` (vendedor).
- Tras el primer arranque puedes poner `DB_SEED=false` para no reinsertar datos de ejemplo.
- El cliente se sirve con Nginx (build estático de Vite) con *fallback* SPA a `index.html`.
