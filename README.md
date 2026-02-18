# Restaurant Reservation Service

A Node.js/Express microservice for managing restaurant table reservations.

## Tech Stack
- **Node.js 20** / **Express 4**
- **Sequelize** ORM
- **Joi** for validation
- **Swagger** for API docs (swagger-jsdoc + swagger-ui-express)
- **PostgreSQL 16**

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/reservations` | Book a table |
| `GET` | `/api/reservations` | List reservations (filter: `date`, `table_id`, `status`) |
| `GET` | `/api/reservations/:id` | Get reservation details (includes table info) |
| `PATCH` | `/api/reservations/:id/cancel` | Cancel a reservation (1hr+ before slot) |
| `GET` | `/api/tables/:tableId/availability` | Check availability for a date |
| `GET` | `/health` | Health check |
| `GET` | `/api-docs` | Swagger UI |

## Business Rules
- Fixed **2-hour** time slots
- Guest count must not exceed table capacity
- No double-booking (same table, date, slot)
- Cancellation allowed only **1+ hour** before reservation

## Local Development

```bash
npm install
cp .env.example .env
npm run dev
```

## Testing

```bash
npm test
```

## Docker

```bash
docker build -t restaurant-reservation-service .
docker run -p 5002:5002 --env-file .env restaurant-reservation-service
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/restaurant_db` |
| `TABLE_SERVICE_URL` | URL of the Table Service | `http://localhost:5001` |
| `PORT` | Service port | `5002` |
