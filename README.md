# Bangladeshi Clinic & Diagnostic Management System (Backend)

A 100% production-grade, multi-tenant SaaS backend engineered for clinics and diagnostic centers across Bangladesh. Built with **NestJS**, **PostgreSQL 16**, **Drizzle ORM**, **Redis 7**, **BullMQ**, and **Cloudflare R2**.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology | Details |
|---|---|---|
| **Framework** | NestJS 11 | Strict TypeScript, Modular Architecture |
| **Database** | PostgreSQL 16 + Drizzle ORM | Native Enums, UUID PKs, Relations, Composite Indexes |
| **Caching & Locking** | Redis 7 + `ioredis` | Distributed locks via atomic Lua scripts |
| **Background Queues** | BullMQ + Redis | `sms-queue` (OTP & reminders), `pdf-queue` (Prescriptions & bills) |
| **Object Storage** | Cloudflare R2 + AWS SDK v3 | S3-compatible Presigned URLs, PDF & Image storage |
| **Auth & Multi-Tenancy** | Passport JWT + bcrypt | BD Mobile (`/^01[3-9]\d{8}$/`), OTP via Redis (3-min TTL), RBAC Guards |
| **API Documentation** | Swagger / OpenAPI | Integrated at `/api/docs` with Bearer Auth & `x-clinic-id` support |
| **Validation** | Zod + `class-validator` | Runtime environment validation and strict DTO pipes |

---

## 📁 Project Structure

```text
src/
├── common/
│   ├── decorators/          # @CurrentUser(), @CurrentTenant(), @Roles(), @Public()
│   ├── filters/             # Global AllExceptionsFilter (Standardized JSON error envelope)
│   ├── guards/              # JwtAuthGuard, TenantRoleGuard (Multi-tenant RBAC)
│   ├── interceptors/        # TransformInterceptor ({ success, statusCode, data, meta })
│   └── validators/          # IsBdPhoneNumber (Bangladeshi 11-digit mobile regex)
├── config/                  # Zod-validated environment schema & parser
├── database/
│   ├── schema/              # 17 Drizzle schema files, enums, relations, and barrel index
│   └── database.module.ts   # Global Drizzle PG Pool provider ('DRIZZLE_DB')
├── providers/
│   ├── redis/               # Global RedisService (ioredis + distributed lock helper)
│   ├── queues/              # BullMQ module, SmsProcessor, and PdfProcessor
│   └── storage/             # Cloudflare R2 StorageService (upload, delete, presigned URLs)
├── modules/
│   ├── auth/                # Phone + Password login, Patient OTP login (Redis TTL), Refresh token
│   ├── clinics/             # Multi-tenant Clinic creation & Member RBAC assignment
│   └── health/              # PostgreSQL & Redis connectivity health check
├── app.module.ts            # Root module wiring config, throttler, guards, filters
└── main.ts                  # Bootstrap: Helmet, CORS, Global Pipes, Swagger (/api/docs)
```

---

## 🗄️ Database Schema (17 Tables - Bangladesh Market Locked)

1. **`users`**: Unique 11-digit BD phone (`01XXXXXXXXX`), hashed passwords (or null for OTP patients), avatar R2 key, verification flags.
2. **`clinics`**: Tenant profiles with English name, Bengali name (`name_bn`), unique slug, DGHS license registration, SMS sender ID, prepaid SMS balance.
3. **`clinic_members`**: Tenant memberships with RBAC roles (`SUPER_ADMIN`, `CLINIC_ADMIN`, `DOCTOR`, `RECEPTIONIST`, `ASSISTANT`, `LAB_TECH`) with composite index `(clinic_id, user_id, role)`.
4. **`specialties`**: Medical disciplines with bilingual support (`name_en`, `name_bn`).
5. **`doctors`**: BMDC registration number (`bmdc_reg_no`), degrees, designations, prescription headers (Bangla & English), digital signature key.
6. **`clinic_doctors`**: Doctor chamber associations per clinic, consultation fee tiers (New, Follow-up, Report Show), validity periods, pre-printed prescription pad margins (`pad_print_settings` JSONB).
7. **`doctor_schedules`**: Morning/Evening shift schedules per day of week with patient quota and online booking caps.
8. **`doctor_schedule_exceptions`**: Emergency delayed start times and cancellation reasons.
9. **`patients`**: Readable patient codes (`PT-XXXXXX`), BD phone indexing, guardian relationships (S/O, W/O, B/O), age in years and months.
10. **`appointments`**: Serials per schedule, visit types (`NEW`, `FOLLOW_UP`, `REPORT_SHOW`), booking sources, and emergency/VIP flagging.
11. **`medicines`**: Indexed brand names and generic names with strengths, dosage forms, and manufacturers.
12. **`prescriptions`**: Structured clinical vitals (BP, pulse, weight, SpO2, RBS), Bangla dosage instructions (`medicines_prescribed`), lab tests advised, next visit dates, and async R2 PDF links.
13. **`prescription_templates`**: Doctor-saved templates for rapid prescription drafting.
14. **`clinic_lab_tests`**: Test codes, categories, pricing, sample collection rooms, and turnaround times in hours.
15. **`invoices`**: Consultation & diagnostic billing, item breakdown, discount audit remarks, payment status, and net payable/due tracking.
16. **`payment_transactions`**: Multi-channel collections (`CASH`, `BKASH`, `NAGAD`, `SSLCOMMERZ`, `POS_CARD`) with gateway transaction IDs.
17. **`lab_reports`**: Diagnostic report tracking, due amount check enforcement, and secure private Cloudflare R2 file keys.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** >= 20.x
- **PostgreSQL** 16 (or Docker)
- **Redis** 7 (or Docker)

### 2. Infrastructure via Docker Compose
To start PostgreSQL and Redis containers with persistent volumes:
```bash
docker compose up -d
```

### 3. Environment Configuration
Copy `.env.example` to `.env` and fill in your Cloudflare R2 credentials:
```bash
cp .env.example .env
```

### 4. Database Migrations
Generate and apply Drizzle migrations:
```bash
# Generate SQL migrations from schema
npm run db:generate

# Push schema directly to database (Dev)
npm run db:push

# Launch Drizzle Studio (Database GUI)
npm run db:studio
```

### 5. Running the Application
```bash
# Development mode with Hot Reload
npm run start:dev

# Production build
npm run build
npm run start:prod
```

### 6. Interactive API Documentation
Navigate to:
```text
http://localhost:8000/api/docs
```
- Includes interactive Swagger UI with Bearer JWT authorization and `x-clinic-id` tenant header injection.

---

## 🔒 Security & Multi-Tenant RBAC

- **Tenant Isolation**: Protected endpoints require the `x-clinic-id` header.
- **TenantRoleGuard**: Intercepts requests, queries `clinic_members` in PostgreSQL for the calling user, and verifies membership role against required `@Roles(...)`.
- **OTP Protection**: 6-digit OTP codes are stored in Redis with 3-minute TTL (180s) and single-use invalidation.
- **Refresh Token Rotation**: Refresh tokens are cryptographically hashed with `bcrypt` and cached in Redis.
- **Distributed Locking**: `RedisService.acquireLock()` & `releaseLock()` safeguard concurrent operations (e.g. appointment serial booking).
