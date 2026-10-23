# WhatsApp Bot SaaS Backend

Production-ready backend for a multi-tenant WhatsApp bot SaaS platform using Node.js, Express, MySQL, Socket.IO, and Baileys.

## Features

- JWT authentication with role-based access (`admin`, `user`)
- Secure password hashing with bcrypt
- Baileys WhatsApp Web integration per user account
- One WhatsApp client per user (enforced)
- Real-time QR and client lifecycle events over Socket.IO
- API token generation when client becomes `READY`
- External messaging APIs using API token
- Message persistence with statuses (`PENDING`, `SENT`, `FAILED`)
- Admin user management and reporting APIs
- Global + per-user message rate limiting (70/min)
- Layered modular architecture

## Tech Stack

- Node.js + Express.js
- MySQL (`mysql2`)
- Socket.IO (WebSocket)
- Baileys (`@whiskeysockets/baileys`)
- JWT (`jsonwebtoken`)
- bcrypt (`bcryptjs`)
- Joi validation
- express-rate-limit

## Project Structure

```text
.
|- server.js
|- database/
|  |- schema.sql
|- src/
|  |- config/
|  |- controllers/
|  |- services/
|  |- repositories/
|  |- routes/
|  |- middlewares/
|  |- sockets/
|  |- baileys/
|  |- utils/
|  |- models/
|- sessions/
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env
```

3. Create database and apply schema:

```sql
CREATE DATABASE whatsapp_saas;
USE whatsapp_saas;
SOURCE database/schema.sql;
```

4. Start development server:

```bash
npm run dev
```

Server runs at `http://localhost:4000` by default.

## Authentication

### Register

`POST /api/auth/register`

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "StrongPass123"
}
```

### Login

`POST /api/auth/login`

Returns:

- `accessToken`
- `userId`
- `role`

Use JWT in `Authorization: Bearer <JWT_TOKEN>` for protected endpoints.

## Socket.IO

Connect with JWT as socket auth token:

```js
const socket = io("http://localhost:4000", {
  auth: { token: "JWT_TOKEN" }
});
```

### Socket Events

- `client:qr` -> includes base64 QR
- `client:connected` -> connection in progress
- `client:ready` -> client ready + generated API token
- `client:disconnected` -> disconnected
- `client:error` -> lifecycle errors

## Client Lifecycle APIs

- `POST /api/client/create` -> initialize Baileys client for current user
- `GET /api/client/status` -> fetch status
- `POST /api/client/logout` -> logout client and revoke API token
- `DELETE /api/client/delete` -> delete client/session and revoke API token

## API Token Flow

When a client reaches `READY`, the system generates a user API token and stores it in `api_tokens`.

User can fetch current token:

- `GET /api/users/api-token` (JWT required)

External systems must use this token:

`Authorization: Bearer API_TOKEN`

## Messaging APIs (External)

These endpoints require API token and are rate-limited to `70 requests/minute/user`.

### Send Text

`POST /api/messages/send-text`

```json
{
  "recipientNumber": "201001112233",
  "messageText": "Hello from external app",
  "sourceApplication": "crm-system"
}
```

### Send Image

`POST /api/messages/send-image`

```json
{
  "recipientNumber": "201001112233",
  "imageUrl": "https://example.com/image.jpg",
  "caption": "Invoice copy",
  "sourceApplication": "billing-system"
}
```

### User Message History

- `GET /api/messages/my?limit=100` (JWT required)

## Admin APIs

All admin endpoints require JWT with role `admin`.

- `POST /api/admin/users` -> create user
- `GET /api/admin/users` -> list users
- `PATCH /api/admin/users/:userId` -> update user/expiry date/role
- `DELETE /api/admin/users/:userId` -> delete user
- `GET /api/admin/reports` -> aggregate reports

Report payload includes:

- total messages sent
- messages per user
- messages per day
- active client count

## Security Notes

- SQL queries use parameterized statements (`pool.execute`)
- Passwords hashed using bcrypt
- JWT verification for protected routes
- Role-based authorization middleware
- Input validation via Joi
- Environment-based secrets (`.env`)

## Default Admin

On startup, if no user exists with `ADMIN_EMAIL`, a default admin account is auto-created using:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Change both values in `.env` before production deployment.
