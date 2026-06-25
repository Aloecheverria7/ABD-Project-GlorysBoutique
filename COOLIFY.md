# Guía de configuración en Coolify

Guía paso a paso para desplegar Glory's Boutique (API + cliente + MySQL) en Coolify v4.

Arquitectura del despliegue:

```
                    Internet
                        │
              ┌─────────┴──────────┐
   glorys.tudominio.com      api.tudominio.com
        (cliente Nginx :80)    (API Express :4000)
                        \          │
                         \         ▼
                          \    MySQL :3306
                           \   (red interna)
```

Hay dos caminos. Elige **uno**:

- **Opción A — 3 recursos separados** (MySQL + API + cliente). Más control, backups de BD desde la UI.
- **Opción B — un recurso Docker Compose** (todo junto). Más simple, la red entre servicios "just works".

---

## 0. Requisitos previos

1. Un servidor con Coolify instalado y funcionando.
2. Tu repositorio Git conectado a Coolify (GitHub App, Deploy Key o repo público).
3. Dos subdominios apuntando (registro **A**) a la IP de tu servidor Coolify:
   - `glorys.tudominio.com` → cliente
   - `api.tudominio.com` → API
4. Decide tus secretos: una contraseña de MySQL y un `JWT_SECRET` largo y aleatorio.

> Genera un `JWT_SECRET` con: `openssl rand -hex 32`

---

## Opción A — Tres recursos separados (recomendada)

### 1. Crear el proyecto

1. **Projects → + Add** → nombre `glorys-boutique` → entra a su entorno **Production**.
2. Todos los recursos siguientes van en este mismo proyecto/entorno (así comparten red interna).

### 2. Base de datos MySQL

1. **+ New → Database → MySQL** (versión 8).
2. Define el nombre de la base: `glorysboutique_BD` y una contraseña para `root`.
3. **Deploy**.
4. Abre el recurso y copia, de la sección de conexión **interna**, estos datos (los usarás en el API):
   - **Host interno** (un nombre tipo `mysql-xxxxxxxx` o el alias del servicio)
   - **Puerto**: `3306`
   - **Usuario**: `root`
   - **Password**: la que definiste
   - **Database**: `glorysboutique_BD`

> Importante: usa el host **interno**, no la URL pública. El API se conecta por la red privada de Coolify.

### 3. Aplicación API (`server`)

1. **+ New → Application →** elige tu repositorio.
2. **Build Pack: `Dockerfile`**.
3. **Base Directory**: `/server`
   **Dockerfile Location**: `/Dockerfile` (relativo a Base Directory).
4. **Ports Exposes**: `4000`
5. **Environment Variables** (todas de *runtime*, NO marques "Build Variable"):

   | Clave | Valor |
   |---|---|
   | `JWT_SECRET` | *(tu secreto aleatorio)* |
   | `CLIENT_ORIGIN` | `https://glorys.tudominio.com` |
   | `DB_HOST` | *(host interno del MySQL del paso 2)* |
   | `DB_PORT` | `3306` |
   | `DB_USER` | `root` |
   | `DB_PASSWORD` | *(password de MySQL)* |
   | `DB_NAME` | `glorysboutique_BD` |
   | `DB_AUTO_MIGRATE` | `true` |
   | `DB_SEED` | `true` *(solo el primer despliegue; luego `false`)* |
   | `DB_LOGGING` | `false` |

6. **Domains**: `https://api.tudominio.com` (Coolify provisiona SSL con Let's Encrypt).
7. **Health Checks** (Advanced/Healthcheck):
   - Path: `/api/health` · Port: `4000` · Method: `GET` · Status: `200`
   - (Usa `/api/health/ready` si quieres readiness estricta contra la BD.)
8. **Deploy**. Revisa los logs: debe decir *"Database connection established"* y *"API listening on ... :4000"*.

### 4. Aplicación cliente (`client`)

1. **+ New → Application →** el mismo repositorio.
2. **Build Pack: `Dockerfile`**.
3. **Base Directory**: `/client` · **Dockerfile Location**: `/Dockerfile`
4. **Ports Exposes**: `80`
5. **Environment Variables** → añade `VITE_API_URL` y **marca la casilla "Build Variable"**
   (es de tiempo de *build*; Vite la incrusta en el bundle):

   | Clave | Valor | Build Variable |
   |---|---|---|
   | `VITE_API_URL` | `https://api.tudominio.com/api` | ✅ Sí |

6. **Domains**: `https://glorys.tudominio.com`
7. **Deploy**.

> Si cambias `VITE_API_URL` más tarde, debes **Redeploy** del cliente (no basta reiniciar: el valor se "hornea" al compilar).

### 5. Verificación

1. Abre `https://api.tudominio.com/api/health` → `{ "ok": true, ... }`.
2. Abre `https://glorys.tudominio.com` → pantalla de login.
3. Entra con `admin1` / `123` (si sembraste datos).
4. Vuelve al API: cambia `DB_SEED` a `false` y guarda (no hace falta redeploy inmediato).

---

## Opción B — Un recurso Docker Compose

1. **+ New → Resource → Docker Compose** (o "Application" con Build Pack **Docker Compose**) → tu repositorio.
2. **Compose file location**: `/docker-compose.yml` (en la raíz del repo).
3. **Environment Variables** del recurso:

   | Clave | Valor |
   |---|---|
   | `DB_PASSWORD` | *(password de MySQL)* |
   | `JWT_SECRET` | *(secreto aleatorio)* |
   | `CLIENT_ORIGIN` | `https://glorys.tudominio.com` |
   | `VITE_API_URL` | `https://api.tudominio.com/api` |
   | `DB_NAME` | `glorysboutique_BD` *(opcional)* |
   | `DB_SEED` | `true` *(primer arranque; luego `false`)* |

4. Tras leer el compose, Coolify lista los servicios. Asigna **dominios**:
   - servicio `client` (puerto `80`) → `https://glorys.tudominio.com`
   - servicio `server` (puerto `4000`) → `https://api.tudominio.com`
5. **Deploy**. La BD `db` queda en la red del compose; el API la alcanza por el host `db` (ya configurado).

> En el compose, `server` espera a que `db` esté *healthy* (`depends_on`), y `DB_AUTO_MIGRATE=true` crea el esquema al primer arranque. La BD persiste en el volumen `db-data`.

---

## Referencia de variables

| Variable | App | Momento | Descripción |
|---|---|---|---|
| `JWT_SECRET` | API | runtime | Firma de JWT. **Obligatoria** (el API no arranca sin ella). |
| `CLIENT_ORIGIN` | API | runtime | Origen permitido por CORS = dominio del cliente. |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | API | runtime | Conexión MySQL. |
| `DB_AUTO_MIGRATE` | API | runtime | `true` crea/migra el esquema (Sequelize `sync`) al arrancar. |
| `DB_SEED` | API | runtime | `true` siembra datos de ejemplo (solo la primera vez). |
| `PORT` | API | runtime | Puerto del API (por defecto `4000`). |
| `VITE_API_URL` | Cliente | **build** | URL pública del API **con `/api`**. Marca "Build Variable". |

---

## Solución de problemas

- **El API se reinicia / "JWT_SECRET no está definido"** → falta la variable `JWT_SECRET`.
- **Login falla / "Network Error" en el navegador** → revisa que `VITE_API_URL` apunte a `https://api.../api` y que el cliente se haya **reconstruido** tras fijarla. Comprueba también CORS: `CLIENT_ORIGIN` debe ser exactamente el dominio del cliente (con `https://`, sin `/` final).
- **`/api/health` responde pero la app no usa la BD** → revisa `/api/health/ready`; si da `503`, el API no llega a MySQL (host interno incorrecto, password, o la BD no está en el mismo proyecto/red).
- **Las tablas no existen** → asegúrate de `DB_AUTO_MIGRATE=true` en el primer despliegue y revisa los logs del API.
- **Mixed content (HTTP/HTTPS)** → si el cliente está en `https`, `VITE_API_URL` también debe ser `https`.
- **No quiero datos de ejemplo** → deja `DB_SEED=false` desde el inicio (tendrás que crear usuarios/datos manualmente).

Cuentas iniciales con `DB_SEED=true` (contraseña `123`): `admin1`, `admin2`, `admin3`, `dueno` (admin) y `empleado` (vendedor).
