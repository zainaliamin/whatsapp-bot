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

- Node.js 20+ + Express.js
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

## WhatsApp Message Recovery

Text and image sends now store their generated WhatsApp payload in MySQL before
the first relay. When a recipient asks for a resend, Baileys retrieves that exact
payload through `getMessage` and handles session refresh and resending with the
original message ID. API and bulk sends use the same path.

For an **existing database**, apply the additive migration before restarting the
updated backend. In the MySQL client, select your application's database and run:

```sql
SOURCE database/migrations/20261107_add_whatsapp_message_retries.sql;
```

New installations receive the table through `database/schema.sql`. The backend
checks all required table columns before starting workers or accepting requests
and reports a missing or incomplete schema. The migration creates one table with
`user_id`, `client_id`, `session_id`, `whatsapp_message_id`, `remote_jid`,
`message_log_id`, `message_payload`, `created_at`, and `expires_at`, a composite
primary key, an expiry index, and foreign keys to users, clients, and messages.
It does not alter existing table columns or existing message data. If the table
already exists with an incomplete schema, compare and repair that schema;
`CREATE TABLE IF NOT EXISTS` does not add missing columns to an existing table.
Keep existing WhatsApp session files when
deploying; rescanning the QR code is not required for this change.

The `whatsapp_message_retries` table holds encoded protocol payloads, including
media encryption metadata. Treat it as sensitive message data. Each lookup is
scoped to the user, client, linked identity, and original message ID. Device JIDs
are normalized; phone-number/LID pairs are verified with WhatsApp before serving
a payload to an alternate address. New pairings use a different identity scope.

Payloads are retained for seven days by default. Set
`WA_RETRY_RETENTION_SECONDS=604800` to adjust this period (positive integer seconds).
Invalid values, including fractional or non-positive values, stop startup with a
configuration error instead of being rounded or silently replaced.
Expired payloads cannot be returned. Cleanup runs at startup and every five
minutes, deleting up to ten batches of 1,000 expired rows per pass.

If the initial payload write fails, the message is not relayed and the API returns
HTTP 503 with code `WHATSAPP_RETRY_STORAGE_FAILED`. A failed or ambiguous relay
does not start a separate send with a new ID; its saved payload remains available
for a recipient retry. Baileys' existing retry handling and default limit of five
remain in use. A lookup failure returns no fabricated or empty message.
If recording the failed message's status also fails during a database outage,
the API preserves the original send/storage error and logs the status-write
failure separately.

Logs identify retry payload hits, missing/expired payloads, chat mismatches, and
lookup failures without printing payloads or media keys. A payload hit confirms
lookup, not recipient delivery. Existing `SENT` responses still mean the send
routine completed; recipient delivery tracking is separate.

Only messages sent through the updated backend have recoverable payloads. Older
message logs cannot supply the exact generated message needed for recovery. This
change enables retry recovery; other initial-delivery or encryption faults still
require investigation if they persist.

Run sanity checks and the regression suite with:

```bash
npm run sanity
npm test
```

The sanity command checks JavaScript/JSON syntax, loads all backend source
modules, validates the installed Baileys APIs/version and lockfile metadata,
and compares the retry migration with the fresh-install schema. It does not
connect to MySQL, start a WhatsApp socket, or start a background worker.

Tests use the pinned Baileys library for text/image generation and protobuf
round-trips, with simulated storage and sockets. They cover immediate retry,
socket replacement, media metadata, tenant/identity isolation, alternate JIDs,
expiry, corrupt data, storage failure, both API send paths, startup gating,
retention validation, bounded cleanup, and local HTTP health/authentication
smoke checks. A live MySQL
migration and WhatsApp delivery test remain deployment checks.

## Production Checkout Without Tests and Scripts

Keep tests and sanity scripts in GitHub and in development checkouts. To omit
them from a VPS working directory while continuing to deploy with `git pull`,
configure sparse checkout on the VPS only. Use a Git version that supports
`git sparse-checkout set`; begin with a normal full checkout and no uncommitted
tracked-file changes (`git status --short`).

From anywhere inside that VPS repository, run:

```bash
cd "$(git rev-parse --show-toplevel)"
git sparse-checkout set --no-cone '/*' '!**/backend/test/' '!**/backend/scripts/'
git pull --ff-only origin main
pm2 restart whatsapp-api --update-env
pm2 logs whatsapp-api --lines 50
```

The patterns support both `backend/` and `whatsapp-bot/backend/` repository
layouts. They omit only those two backend directories from the working tree;
runtime source, database migrations, frontend, and HTML image service remain.
Existing ignored `.env`, session, and dependency files are retained. These rules
are local to the VPS checkout and do not delete files from GitHub. Git history
still contains the excluded files.

Run `npm test` and `npm run sanity` in the full development checkout before
pushing. Those commands are unavailable on the reduced VPS checkout because
their files have been excluded. To restore the full checkout on the VPS, run:

```bash
git sparse-checkout disable
```

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
