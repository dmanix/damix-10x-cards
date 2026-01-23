# REST API Plan

## 1. Resources
- `flashcards` → table `public.flashcards`
- `generations` → table `public.generations`
- `app-config` → table `public.app_config`
- `auth` (registration/login/logout/session) → Supabase Auth `auth.users`

## 2. Endpoints

### 2.2 Generations (AI flashcard generation)
- **POST** `/generations`
  - Description: Start synchronous generation; enforces daily limit (UTC), input length 1k–20k chars, logs row in `generations`.
  - Request JSON: `{ "text": string }`
  - Response:  
    - On success: `201 Created`  
      `{ "generation": { "id": uuid, "status": "succeeded", "createdAt": ts }, "proposals": [ { "front": string, "back": string }... ], "dailyLimit": { "remaining": number, "limit": number, "resetsAtUtc": ts } }`
    - On detected low-quality input: `422 Unprocessable Entity { "code": "low_quality_input", "message": "...", "remaining": number }`
  - Errors: `400` length invalid, `403` limit exceeded, `500` provider error (also logs `status=failed`, `error_code`, `error_message`).
- **GET** `/generations`
  - Description: List user generations (for history/limit diagnostics).
  - Query: `status? (pending|succeeded|failed)`, `page?`, `pageSize?` (default 20, max 100), `sort?=createdAt|finishedAt`, `order?=desc|asc`.
  - Response: `200 OK { "items": [...], "page": number, "pageSize": number, "total": number }`
  - Errors: `401` unauthenticated.
- **GET** `/generations/{id}`
  - Description: Get generation detail and counters.
  - Response: `200 OK { "id": uuid, "status": string, "createdAt": ts, "finishedAt": ts|null, "generatedCount": number|null, "acceptedOriginalCount": number|null, "acceptedEditedCount": number|null, "error": { "code": string|null, "message": string|null } }`
  - Errors: `404` not found (not owner), `401` unauthenticated.
- **GET** `/generations/quota`
  - Description: Return remaining daily generation quota and reset timestamp (UTC).
  - Response: `200 OK { "remaining": number, "limit": number, "resetsAtUtc": ts }`

### 2.4 Flashcards (manual + accepted AI)
- **GET** `/flashcards`
  - Description: List authenticated user flashcards.
  - Query: `page?`, `pageSize?` (default 20, max 100), `sort?=createdAt|updatedAt`, `order?=desc|asc`, `source?=ai|ai-edited|manual`, `search?` (front/back ILIKE), `since?` (ISO ts).
  - Response: `200 OK { "items": [ { "id": uuid, "front": string, "back": string, "source": string, "generationId": uuid|null, "createdAt": ts, "updatedAt": ts }... ], "page": number, "pageSize": number, "total": number }`
- **GET** `/flashcards/{id}`
  - Description: Get single flashcard (owner-only).
  - Response: `200 OK { ... }`
  - Errors: `404` not found, `401` unauthenticated.
- **POST** `/flashcards`
  - Description: Create one or more flashcards (manual or AI-generated). For manual cards: `source="manual"`, `generation_id=null`. For AI cards: `source="ai"|"ai-edited"`, `generation_id` required.
  - Logic: Updates related generations entity (fields: **accepted_original_count** and **accepted_edited_count** in table **generations**) if new AI-generated flashcards are being created
  - Request JSON: `{ "flashcards": [ { "front": string, "back": string, "source": "manual"|"ai"|"ai-edited", "generationId"?: uuid } ] }`
  - Response: `201 Created { "created": [ { "id": uuid, "front": string, "back": string, "source": string, "generationId": uuid|null } ] }`
  - Errors: `400` validation (invalid source, missing generationId for AI cards, front/back length), `401` unauthenticated, `403` generationId ownership mismatch.
- **PUT** `/flashcards/{id}`
  - Description: Update front/back (owner-only). For AI cards, keep `generation_id` and update `source` to `"ai-edited"` if modified.
  - Logic: Updates related generations entity (fields: **accepted_original_count** and **accepted_edited_count** in table **generations**) if original AI-generated flashcard is being edited
  - Request JSON: `{ "front"?: string, "back"?: string }`
  - Response: `200 OK { "id": uuid, "source": string, "updatedAt": ts }`
  - Errors: `400` validation, `404` not found.
- **DELETE** `/flashcards/{id}`
  - Description: Hard delete flashcard (owner-only).
  - Response: `204 No Content`
  - Errors: `404` not found.

## 3. Authentication and Authorization
- Supabase Auth JWT bearer in `Authorization: Bearer <access_token>`.
- RLS enforces owner-only access on `flashcards` and `generations`;
- All non-auth endpoints require authenticated user.
- Rate limiting: apply per-IP and per-user on auth and generation endpoints; stricter on `/generations`.

## 4. Validation and Business Logic
- `POST /generations`: `text` length 1,000–20,000 chars; check daily quota (`daily_generation_limit` from `app_config`); compute `input_hash` (SHA-256) and store `input_length`; set `status` to `pending` then `succeeded|failed`; `generated_count` etc. updated after proposals created.
- Proposal acceptance endpoints: enforce `generation_id` non-null and `source` rules; prevent duplicate accept/reject per proposal index; update `accepted_original_count` / `accepted_edited_count`.
- Flashcards:
  - `front`: 1–200 chars; `back`: 1–500 chars.
  - Manual create: `source="manual"`, `generation_id=null`.
  - AI accept: `source="ai"` or `"ai-edited"` with `generation_id` required.
  - PUT on AI card that changes content flips `source` to `"ai-edited"`.
- Pagination defaults: `page=1`, `pageSize=20`, cap `pageSize=100`; sorting uses indexed columns (`created_at`, `updated_at`).
- Error model: `{ "code": string, "message": string, "details"?: any }`; consistent codes like `limit_exceeded`, `validation_failed`, `not_found`, `unauthorized`, `low_quality_input`, `provider_error`.

## 5. Performance and Security
- Indices leveraged: `flashcards (user_id, created_at/updated_at, source)`, `generations (user_id, created_at, status)` for list endpoints.
- Use cursor or keyset pagination if total counts become heavy; initial MVP uses offset with total.
- Rate-limit high-cost endpoints (`/generations`, auth).
- Input normalization + hashing for duplicate detection and diagnostics (`input_hash`).
- Log generation failures with `error_code`/`error_message`; avoid storing raw input text.
- `app_config` dostępne do odczytu dla wszystkich użytkowników.

