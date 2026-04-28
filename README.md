# Glory's Boutique

Full-stack starter for the Glory's Boutique database with an Express/Sequelize/MySQL backend and a React frontend.

## Project Structure

- `database/schema.mysql.sql` - MySQL-compatible database, triggers, views, procedures, and seed data.
- `server` - Express API using Sequelize with the MySQL dialect.
- `client` - Vite React dashboard for products, clients, inventory, and sales.

## Database

Import the schema into MySQL:

```bash
mysql -u root -p < database/schema.mysql.sql
```

The original SQL file was SQL Server syntax, so this project includes a MySQL conversion.

## Backend

```bash
cd server
copy .env.example .env
npm install
npm run db:migrate
npm run dev
```

Edit `server/.env` if your MySQL user, password, host, or database name differs.
If `nodemon` is blocked by your Windows execution environment, use `npm run dev:node`.

The backend can also migrate on startup by setting this in `server/.env`:

```bash
DB_AUTO_MIGRATE=true
```

`npm run db:migrate` creates the database if needed, syncs Sequelize models, and inserts starter data unless `DB_SEED=false`.

API base URL: `http://localhost:4000/api`

Main endpoints:

- `GET /api/health`
- `GET /api/catalog/lookups`
- `GET|POST|PUT|DELETE /api/customers`
- `GET|POST|PUT|DELETE /api/products`
- `GET /api/products/variants`
- `POST /api/products/:id/variants`
- `GET|PUT /api/inventory`
- `GET|POST /api/sales`

## Frontend

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173`.

If the backend runs somewhere else, create `client/.env`:

```bash
VITE_API_URL=http://localhost:4000/api
```
