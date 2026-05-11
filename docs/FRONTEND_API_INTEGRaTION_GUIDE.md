# EduTrack — Frontend Integration Guide

> **Audience:** Frontend engineers integrating with the EduTrack REST API.
> **Derived from:** Live source code — `src/` as of May 2026.
> **Base URL:** `http(s)://<host>/api/v1` (configured via `VITE_API_BASE_URL`)

---

## Table of Contents

1. [HTTP Client Setup](#1-http-client-setup)
2. [Response Envelope](#2-response-envelope)
3. [Error Handling](#3-error-handling)
4. [Authentication](#4-authentication)
5. [Multi-Tenancy Model](#5-multi-tenancy-model)
6. [Role System](#6-role-system)
7. [API Reference](#7-api-reference)
   - 7.1 [Auth](#71-auth)
   - 7.2 [User Profile](#72-user-profile)
   - 7.3 [Organizations](#73-organizations)
   - 7.4 [Schools](#74-schools)
   - 7.5 [Venues](#75-venues)
   - 7.6 [Staff Users](#76-staff-users)
   - 7.7 [Roles & Permissions](#77-roles--permissions)
   - 7.8 [Invitations](#78-invitations)
   - 7.9 [Academic Years](#79-academic-years)
   - 7.10 [Departments](#710-departments)
   - 7.11 [Courses](#711-courses)
   - 7.12 [Course Assignments](#712-course-assignments)
   - 7.13 [Students](#713-students)
   - 7.14 [Timetable](#714-timetable)
   - 7.15 [Sessions](#715-sessions)
   - 7.16 [Attendance](#716-attendance)
   - 7.17 [Results](#717-results)
   - 7.18 [Bulk Imports](#718-bulk-imports)
   - 7.19 [Audit Logs](#719-audit-logs)
   - 7.20 [Reports](#720-reports)
8. [TypeScript Type Definitions](#8-typescript-type-definitions)
9. [Common Patterns & Recipes](#9-common-patterns--recipes)

---

## 1. HTTP Client Setup

### 1.1 Base configuration

Every request that is not explicitly marked as public requires a `Bearer` token.

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api/v1',
  headers: { 'Content-Type': 'application/json' },
});
```

### 1.2 Request interceptor — attach token

```typescript
api.interceptors.request.use((config) => {
  const token = getAccessToken(); // read from your auth store
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

### 1.3 Response interceptor — unwrap envelope + handle 401

The server wraps every success response in an envelope (see §2). Unwrap it here so service functions receive the payload directly.

```typescript
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (response) => response.data.data ?? response.data, // unwrap envelope
  async (error) => {
    const original = error.config;

    // Token expired — attempt silent refresh once
    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        // Queue the retry until refresh completes
        return new Promise((resolve) => {
          refreshQueue.push((newToken) => {
            original.headers.Authorization = `Bearer ${newToken}`;
            resolve(api(original));
          });
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { accessToken, refreshToken } = await refreshTokens();
        persistTokens(accessToken, refreshToken);
        refreshQueue.forEach((cb) => cb(accessToken));
        refreshQueue = [];
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        clearTokens();
        window.location.href = '/auth/sign-in';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    // Promote server error message for catch blocks
    if (error.response?.data) {
      error.message = error.response.data.message ?? error.message;
      error.code    = error.response.data.error?.code;
      error.details = error.response.data.error?.details;
    }

    return Promise.reject(error);
  },
);
```

> **Note:** `POST /auth/logout` returns `204 No Content` — `.data` will be empty. Handle that case in your logout service.

---

## 2. Response Envelope

### 2.1 Success response

```json
{
  "success":    true,
  "statusCode": 200,
  "message":    "OK",
  "data":       { },
  "meta":       null,
  "timestamp":  "2026-05-08T12:00:00.000Z",
  "requestId":  "req_x7k2p9m"
}
```

**Unwrapping logic (server-side):**

```
data field = payload?.items ?? payload?.data ?? payload
```

This means:
- If your service returns `{ items: [...], meta: {...} }`, the envelope `data` is the `items` array and `meta` is passed through.
- If your service returns any other object or array directly, it goes straight into `data`.

### 2.2 Paginated response

```json
{
  "success":    true,
  "statusCode": 200,
  "message":    "OK",
  "data":       [ ],
  "meta": {
    "page":     1,
    "pageSize": 20,
    "total":    347
  },
  "timestamp":  "2026-05-08T12:00:00.000Z",
  "requestId":  "req_x7k2p9m"
}
```

`meta` is only present when the service explicitly includes it. Most list endpoints currently return the full array without pagination metadata.

---

## 3. Error Handling

### 3.1 Error envelope

Every error (validation, auth, domain, server) returns the same structure:

```json
{
  "success":    false,
  "statusCode": 400,
  "message":    "Session is not live",
  "error": {
    "code":    "NOTFOUND",
    "details": null
  },
  "timestamp":  "2026-05-08T12:00:00.000Z",
  "requestId":  "req_x7k2p9m"
}
```

### 3.2 Error codes

> **Critical:** Do **not** branch on HTTP status codes for domain errors — they all map to `400`. Discriminate exclusively on `error.code`.

| `error.code` | Trigger | Recommended UI action |
|---|---|---|
| `NOTFOUND` | Resource does not exist | Show "Not found" message, possibly navigate back |
| `CONFLICT` | Duplicate key / conflicting state | Show field-level error (e.g. "Code already taken") |
| `VALIDATION` | Domain-layer validation failed | Show `message` as a toast or inline error |
| `FORBIDDEN` | Authenticated but lacks permission | Show 403 page or hide the action |
| `UNAUTHORIZED` | Not authenticated (domain layer) | Force logout, redirect to `/auth/sign-in` |
| `TENANTSCOPE` | User not a member of the tenant | Redirect to organization selector |
| `INVALIDSTATETRANSITION` | Invalid operation given current state | Show `message` explaining the issue |
| `SCHEDULINGCONFLICT` | Timetable/session time clash | Show `message` and optionally `details` |
| `VALIDATION_ERROR` | Input failed class-validator rules | Map `error.details` object to form field errors |
| `HTTP_ERROR` | NestJS framework error | Fall back to `message` |
| `INTERNAL_SERVER_ERROR` | Unhandled exception | Show generic "Something went wrong" |

### 3.3 Validation errors in detail

When the input fails DTO validation, `error.code` is `VALIDATION_ERROR` and `error.details` is a field-keyed object:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "details": {
      "email":    "email must be an email",
      "password": "password must be longer than or equal to 8 characters"
    }
  }
}
```

Map this directly to your form state:

```typescript
} catch (err) {
  if (err.code === 'VALIDATION_ERROR' && err.details) {
    Object.entries(err.details).forEach(([field, msg]) => {
      form.setError(field, { message: msg as string });
    });
  } else {
    toast.error(err.message);
  }
}
```

### 3.4 HTTP status codes reference

| Status | When |
|---|---|
| `200 OK` | Standard success |
| `201 Created` | (reserved — API currently returns 200 for POST) |
| `204 No Content` | `POST /auth/logout` only |
| `400 Bad Request` | Validation errors AND all domain errors (NOTFOUND, FORBIDDEN, etc.) |
| `401 Unauthorized` | JWT missing, expired, or malformed — triggers silent refresh |
| `429 Too Many Requests` | Rate limit exceeded on `/auth/login` or `/auth/refresh` |
| `500 Internal Server Error` | Unhandled exception |

### 3.5 Rate limits

| Endpoint | Limit |
|---|---|
| `POST /auth/login` | 10 requests per 60 seconds per IP |
| `POST /auth/refresh` | 20 requests per 60 seconds per IP |

Show a cooldown message when `429` is received.

---

## 4. Authentication

### 4.1 Token lifecycle

| Token | Recommended TTL | Storage |
|---|---|---|
| `accessToken` | 15 minutes | In-memory or `localStorage` |
| `refreshToken` | 7–30 days | `localStorage` (persisted) |

### 4.2 `POST /auth/login` — Obtain token pair

**Public route — no `Authorization` header needed.**

**Request:**
```json
{
  "email":    "admin@school.edu",
  "password": "min8chars"
}
```

| Field | Type | Constraints |
|---|---|---|
| `email` | `string` | Valid email format |
| `password` | `string` | Minimum 8 characters |

**Response `data`:**
```json
{
  "accessToken":  "eyJhbGci...",
  "refreshToken": "eyJhbGci..."
}
```

After login, call `GET /auth/me` to hydrate the current user into your store.

### 4.3 `POST /auth/refresh` — Rotate token pair

**Public route.**

**Request:**
```json
{ "refreshToken": "eyJhbGci..." }
```

| Field | Type | Constraints |
|---|---|---|
| `refreshToken` | `string` | Minimum 20 characters |

**Response `data`:** Same shape as login — a new `{ accessToken, refreshToken }` pair.
Both tokens are rotated. Discard the previous pair immediately.

If this endpoint returns `401`, the refresh token is invalid or expired. Force logout.

### 4.4 `POST /auth/logout` — Revoke refresh token

**Requires `Authorization` header.**

**Request:**
```json
{ "refreshToken": "eyJhbGci..." }
```

**Response:** `204 No Content` — no body.

### 4.5 `GET /auth/me` — Current user identity

**Requires `Authorization` header.**

**Response `data`:**
```json
{
  "id":    "550e8400-e29b-41d4-a716-446655440000",
  "email": "admin@school.edu",
  "profile": {
    "fullName":  "Kwame Mensah",
    "phone":     "+233201234567",
    "avatarUrl": "https://cdn.example.com/avatars/usr_abc.webp"
  }
}
```

Call this on app boot to validate the stored token and populate the user store.

---

## 5. Multi-Tenancy Model

The API enforces a two-level tenancy hierarchy. Every school-scoped endpoint carries `schoolId` in the URL path. The server validates membership at each level automatically.

```
Organization  (/organizations/:organizationId)
└── School    (/organizations/:organizationId/schools/:schoolId)
              (also referenced as /schools/:schoolId in most school-scoped routes)
```

**Tenant membership validation** runs on every route decorated with `@TenantScope`. If the authenticated user is not a member of the requested school or organization, the server returns:

```json
{
  "error": { "code": "TENANTSCOPE" },
  "message": "User is not a member of the requested tenant"
}
```

Your route guard should catch this and redirect to the organization/school selector.

---

## 6. Role System

### 6.1 Roles

| Role | Scope | Notes |
|---|---|---|
| `owner` | Organization | Full access across all schools in the org |
| `admin` | School | Full CRUD on all school entities |
| `director` | School | Same capabilities as admin |
| `hod` | School / Department | Department-level management (courses, timetable) |
| `lecturer` | School | Own courses, sessions, attendance |
| `student` | School | Own timetable, attendance records |
| `guardian` | School | Read-only view of linked students |
| `follower` | Organization | Observer role, no mutations |

### 6.2 Role enforcement

The server enforces roles on every endpoint. A `403`-equivalent response (`error.code: 'FORBIDDEN'`) is returned when the user's role is insufficient. The frontend should mirror this by hiding role-gated UI elements, but **always rely on the server as the authority** — never skip calls based on client-side role checks alone.

### 6.3 Capability matrix

| Action | owner | admin | director | hod | lecturer | student | guardian |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Create organization | ✓ | | | | | | |
| Create school | ✓ | | | | | | |
| Manage school settings | ✓ | ✓ | ✓ | | | | |
| Manage departments | ✓ | ✓ | ✓ | | | | |
| Manage programs / courses | ✓ | ✓ | ✓ | ✓ | | | |
| Invite staff | ✓ | ✓ | | | | | |
| Assign roles | ✓ | ✓ | | | | | |
| Enroll students | ✓ | ✓ | | | | | |
| Manage timetable | ✓ | ✓ | ✓ | ✓ | | | |
| View timetable | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create / schedule sessions | ✓ | ✓ | ✓ | | | | |
| Start / end sessions | ✓ | ✓ | | | ✓ | | |
| Mark attendance | ✓ | ✓ | | | ✓ | | |
| View attendance | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Bulk import | ✓ | ✓ | | | | | |
| View audit logs | ✓ | ✓ | ✓ | | | | |
| View geo-compliance report | ✓ | ✓ | ✓ | | | | |

---

## 7. API Reference

> **Legend**
> - 🔓 Public — no `Authorization` header required
> - 🔒 JWT required — `Authorization: Bearer <accessToken>`
> - 👥 Tenant-scoped — server validates membership in the path's `schoolId` / `organizationId`
> - 🛡 Role-gated — minimum roles listed; server returns `FORBIDDEN` if insufficient

---

### 7.1 Auth

#### `POST /auth/login` 🔓

| | |
|---|---|
| Rate limit | 10 req / 60 s |
| Request | `{ email: string, password: string }` |
| Response `data` | `{ accessToken: string, refreshToken: string }` |

#### `POST /auth/refresh` 🔓

| | |
|---|---|
| Rate limit | 20 req / 60 s |
| Request | `{ refreshToken: string }` |
| Response `data` | `{ accessToken: string, refreshToken: string }` |

#### `POST /auth/logout` 🔒

| | |
|---|---|
| HTTP status | `204 No Content` |
| Request | `{ refreshToken: string }` |
| Response | _(empty body)_ |

#### `GET /auth/me` 🔒

| | |
|---|---|
| Response `data` | `{ id: string, email: string, profile: UserProfile }` |

---

### 7.2 User Profile

Base path: `/profiles`

#### `GET /profiles/me` 🔒

Returns the authenticated user's profile.

**Response `data`:**
```json
{
  "id":        "uuid",
  "fullName":  "Kwame Mensah",
  "phone":     "+233201234567",
  "avatarUrl": null
}
```

#### `PATCH /profiles/me` 🔒

**Request:**
```json
{
  "fullName": "Kwame Mensah",
  "phone":    "+233201234567"
}
```

| Field | Type | Constraints |
|---|---|---|
| `fullName` | `string?` | 1–200 characters |
| `phone` | `string?` | 0–32 characters |

#### `POST /profiles/me/avatar` 🔒

**Request:**
```json
{ "avatarUrl": "https://cdn.example.com/avatars/user.webp" }
```

| Field | Type | Constraints |
|---|---|---|
| `avatarUrl` | `string` | Valid URL |

#### `DELETE /profiles/me/avatar` 🔒

Clears the avatar. **Response `data`:** updated profile.

---

### 7.3 Organizations

Base path: `/organizations`

#### `GET /organizations` 🔒

Returns all organizations the authenticated user is a member of.

**Response `data`:**
```json
[
  {
    "id":         "uuid",
    "name":       "University of Ghana",
    "code":       "UG",
    "logoUrl":    null,
    "memberRole": "owner"
  }
]
```

#### `POST /organizations` 🔒

**Request:**
```json
{
  "name":    "University of Ghana",
  "code":    "ug",
  "logoUrl": null
}
```

| Field | Type | Constraints |
|---|---|---|
| `name` | `string` | 2–200 characters |
| `code` | `string` | 2–64 characters; lowercase alphanumeric, hyphens, underscores; globally unique |
| `logoUrl` | `string?` | Valid URL |

**Response `data`:** `ApiOrganization`

#### `GET /organizations/:organizationId` 🔒 👥 (org-scoped)

**Response `data`:** `ApiOrganization`

---

### 7.4 Schools

Base path: `/organizations/:organizationId/schools`

All routes require `👥` organization membership.

#### `GET /organizations/:organizationId/schools` 🔒 👥

**Response `data`:**
```json
[
  {
    "id":     "uuid",
    "name":   "School of Computing",
    "code":   "SOC",
    "status": "active"
  }
]
```

#### `POST /organizations/:organizationId/schools` 🔒 👥 🛡 `owner, admin`

**Request:**
```json
{
  "name": "School of Computing",
  "code": "SOC"
}
```

| Field | Type | Constraints |
|---|---|---|
| `name` | `string` | 2–200 characters |
| `code` | `string` | 2–64 characters; unique within org |

**Response `data`:** `ApiSchool`

#### `GET /organizations/:organizationId/schools/:schoolId` 🔒 👥 (school-scoped)

**Response `data`:** `ApiSchool`

#### `PATCH /organizations/:organizationId/schools/:schoolId` 🔒 👥 🛡 `owner, admin`

**Request:**
```json
{
  "name":   "School of Engineering",
  "status": "inactive"
}
```

| Field | Type | Constraints |
|---|---|---|
| `name` | `string?` | 2–200 characters |
| `status` | `'active' \| 'inactive'?` | |

**Response `data`:** `ApiSchool`

---

### 7.5 Venues

Base path: `/schools/:schoolId/venues`

All routes are `🔒 👥` (school-scoped).

#### `GET /schools/:schoolId/venues` 🛡 `owner, admin, director, hod, lecturer`

**Response `data`:**
```json
[
  {
    "id":        "uuid",
    "name":      "LT-101",
    "latitude":  5.6037,
    "longitude": -0.1870
  }
]
```

#### `POST /schools/:schoolId/venues` 🛡 `owner, admin`

**Request:**
```json
{
  "name":      "LT-101",
  "latitude":  5.6037,
  "longitude": -0.1870
}
```

| Field | Type | Constraints |
|---|---|---|
| `name` | `string` | Non-empty, unique within school |
| `latitude` | `number?` | WGS-84 decimal degrees |
| `longitude` | `number?` | WGS-84 decimal degrees |

**Response `data`:** `ApiVenue`

#### `PATCH /schools/:schoolId/venues/:venueId` 🛡 `owner, admin`

**Request:** Same shape as `POST`, all fields optional.

#### `DELETE /schools/:schoolId/venues/:venueId` 🛡 `owner, admin`

**Response `data`:** The deleted venue.

---

### 7.6 Staff Users

Base path: `/schools/:schoolId/users`

All routes are `🔒 👥` (school-scoped).

#### `GET /schools/:schoolId/users` 🛡 `owner, admin, director`

**Response `data`:**
```json
[
  {
    "id":        "uuid",
    "email":     "lecturer@school.edu",
    "fullName":  "Ama Boateng",
    "phone":     null,
    "avatarUrl": null,
    "role":      "lecturer",
    "isActive":  true
  }
]
```

#### `GET /schools/:schoolId/users/search` 🛡 `owner, admin, director`

**Query params:**

| Param | Type | Description |
|---|---|---|
| `q` | `string?` | Full-text search on name / email |
| `role` | `UserRole?` | Filter by role |
| `limit` | `number?` | Default `20` |
| `offset` | `number?` | Default `0` |

**Response `data`:** `{ items: ApiUser[], meta: { total, limit, offset } }`

#### `GET /schools/:schoolId/users/:userId` 🛡 `owner, admin, director`

**Response `data`:** `ApiUser`

#### `POST /schools/:schoolId/users` 🛡 `owner, admin`

**Request:**
```json
{
  "email":    "new.lecturer@school.edu",
  "fullName": "Kofi Amoah",
  "role":     "lecturer",
  "password": "TempPass#1"
}
```

| Field | Type | Constraints |
|---|---|---|
| `email` | `string` | Valid email |
| `fullName` | `string` | Non-empty |
| `role` | `UserRole` | See §6.1 |
| `password` | `string?` | Min 8 characters; if omitted a random one is generated |

**Response `data`:** `ApiUser`

#### `PATCH /schools/:schoolId/users/:userId` 🛡 `owner, admin`

**Request:**
```json
{
  "fullName": "Kofi Amoah Jr.",
  "phone":    "+233209876543",
  "isActive": false
}
```

All fields optional. **Response `data`:** `ApiUser`

#### `DELETE /schools/:schoolId/users/:userId` 🛡 `owner, admin`

Removes the user from the school. **Response:** `204 No Content`.

#### `POST /schools/:schoolId/users/:userId/password-reset` 🛡 `owner, admin`

**Request:**
```json
{ "password": "NewSecure#1" }
```

| Field | Type | Constraints |
|---|---|---|
| `password` | `string` | Min 8 characters |

**Response `data`:** `{ success: true }`

---

### 7.7 Roles & Permissions

Base path: `/schools/:schoolId/user-roles`

All routes are `🔒 👥` (school-scoped).

#### `GET /schools/:schoolId/user-roles/:userId` 🛡 `owner, admin, director`

Returns all role assignments for the given user in this school.

**Response `data`:**
```json
[
  {
    "id":           "uuid",
    "userId":       "uuid",
    "role":         "lecturer",
    "departmentId": null,
    "assignedAt":   "2026-01-15T08:00:00.000Z"
  }
]
```

#### `POST /schools/:schoolId/user-roles` 🛡 `owner, admin`

**Request:**
```json
{
  "userId":       "uuid",
  "role":         "lecturer",
  "roleId":       null,
  "departmentId": null
}
```

| Field | Type | Constraints |
|---|---|---|
| `userId` | `string` | Valid UUID |
| `role` | `UserRole` | See §6.1 |
| `roleId` | `string?` | UUID — reference to a custom dynamic role |
| `departmentId` | `string?` | UUID — required when scoping to a department |

**Response `data`:** The created role assignment.

#### `DELETE /schools/:schoolId/user-roles/:userId/:role` 🛡 `owner, admin`

Removes a specific role from a user. **Response `data`:** `{ success: true }`

#### `GET /schools/:schoolId/user-roles/permissions/catalog` 🛡 `owner, admin`

Returns all available permission codes for the school.

**Response `data`:** `Array<{ code: string, description: string }>`

#### `POST /schools/:schoolId/user-roles/permissions` 🛡 `owner`

**Request:**
```json
{
  "code":        "reports:export",
  "description": "Can export report data"
}
```

| Field | Type | Constraints |
|---|---|---|
| `code` | `string` | Format `domain:action`; e.g. `attendance:mark` |
| `description` | `string?` | |

#### `POST /schools/:schoolId/user-roles/:userId/permissions` 🛡 `owner, admin`

Grants a permission to a specific user.

**Request:**
```json
{ "permissionCode": "reports:export" }
```

#### `DELETE /schools/:schoolId/user-roles/:userId/permissions/:permissionCode` 🛡 `owner, admin`

Revokes a permission. **Response `data`:** `{ success: true }`

#### `GET /schools/:schoolId/user-roles/roles/catalog` 🛡 `owner, admin`

Returns all custom dynamic roles defined for the school.

**Response `data`:** `Array<{ id: string, code: string, name: string }>`

#### `POST /schools/:schoolId/user-roles/roles` 🛡 `owner, admin`

**Request:**
```json
{ "code": "lab-supervisor", "name": "Lab Supervisor" }
```

#### `POST /schools/:schoolId/user-roles/permissions/bulk-assign-role` 🛡 `owner, admin`

Assigns a permission to everyone with a given role.

**Request:**
```json
{ "role": "hod", "permissionCode": "reports:export" }
```

---

### 7.8 Invitations

#### Staff invitations — Base path: `/schools/:schoolId/invitations` 🔒 👥

##### `GET /schools/:schoolId/invitations` 🛡 `owner, admin`

**Response `data`:**
```json
[
  {
    "id":           "uuid",
    "email":        "newstaff@school.edu",
    "role":         "lecturer",
    "departmentId": null,
    "status":       "pending",
    "expiresAt":    "2026-06-01T00:00:00.000Z"
  }
]
```

##### `POST /schools/:schoolId/invitations` 🛡 `owner, admin`

**Request:**
```json
{
  "email":        "newstaff@school.edu",
  "role":         "lecturer",
  "departmentId": null
}
```

| Field | Type | Constraints |
|---|---|---|
| `email` | `string` | Valid email |
| `role` | `UserRole` | See §6.1 |
| `departmentId` | `string?` | UUID |

**Response `data`:** The created invitation.

##### `DELETE /schools/:schoolId/invitations/:id` 🛡 `owner, admin`

Cancels a pending invitation. **Response `data`:** `{ success: true }`

#### Invitation acceptance — Base path: `/invitations` 🔓

##### `POST /invitations/accept/:token`

Accepts an invitation using the token from the invitation email.

**Response `data`:** `{ success: true }` or user object depending on whether account creation is needed.

---

### 7.9 Academic Years

Base path: `/schools/:schoolId/academic-years`

All routes are `🔒 👥` (school-scoped).

#### `GET /schools/:schoolId/academic-years`

**Response `data`:**
```json
[
  {
    "id":        "uuid",
    "name":      "2025/2026",
    "startDate": "2025-09-01",
    "endDate":   "2026-07-31",
    "isActive":  true
  }
]
```

#### `POST /schools/:schoolId/academic-years` 🛡 `owner, admin`

**Request:**
```json
{
  "name":      "2025/2026",
  "startDate": "2025-09-01",
  "endDate":   "2026-07-31",
  "isActive":  true
}
```

| Field | Type | Constraints |
|---|---|---|
| `name` | `string` | 2–64 characters |
| `startDate` | `string` | ISO date `YYYY-MM-DD` |
| `endDate` | `string` | ISO date `YYYY-MM-DD`; must be after `startDate` |
| `isActive` | `boolean?` | Marks the current academic year |

#### `PATCH /schools/:schoolId/academic-years/:academicYearId` 🛡 `owner, admin`

Same fields as `POST`, all optional.

---

### 7.10 Departments

Base path: `/schools/:schoolId/departments`

All routes are `🔒 👥` (school-scoped).

#### `GET /schools/:schoolId/departments`

**Response `data`:**
```json
[
  {
    "id":   "uuid",
    "code": "CS",
    "name": "Computer Science"
  }
]
```

#### `POST /schools/:schoolId/departments` 🛡 `owner, admin`

**Request:**
```json
{
  "code": "CS",
  "name": "Computer Science"
}
```

| Field | Type | Constraints |
|---|---|---|
| `code` | `string` | 2–32 characters; alphanumeric; unique within school |
| `name` | `string` | 2–200 characters |

---

### 7.11 Courses

Base path: `/schools/:schoolId/courses`

All routes are `🔒 👥` (school-scoped).

#### `GET /schools/:schoolId/courses`

**Response `data`:**
```json
[
  {
    "id":           "uuid",
    "code":         "CS301",
    "title":        "Data Structures",
    "unitLoad":     3,
    "departmentId": "uuid"
  }
]
```

#### `POST /schools/:schoolId/courses` 🛡 `owner, admin, hod`

**Request:**
```json
{
  "code":         "CS301",
  "title":        "Data Structures",
  "unitLoad":     3,
  "departmentId": "uuid"
}
```

| Field | Type | Constraints |
|---|---|---|
| `code` | `string` | 2–32 characters; alphanumeric; unique within school |
| `title` | `string` | 2–200 characters |
| `unitLoad` | `number?` | Min 1; defaults to `2` |
| `departmentId` | `string?` | UUID |

> **Note:** `unitLoad` is required by the controller despite being typed as optional in the DTO. Always send it.

---

### 7.12 Course Assignments

Base path: `/schools/:schoolId/course-assignments`

All routes are `🔒 👥` (school-scoped).

#### `GET /schools/:schoolId/course-assignments`

**Query params:**

| Param | Type | Description |
|---|---|---|
| `lecturerUserId` | `string?` | Filter by assigned lecturer |
| `academicYearId` | `string?` | Filter by academic year |

**Response `data`:**
```json
[
  {
    "id":             "uuid",
    "courseId":       "uuid",
    "classId":        "uuid",
    "lecturerUserId": "uuid",
    "academicYearId": "uuid"
  }
]
```

#### `POST /schools/:schoolId/course-assignments` 🛡 `owner, admin, hod`

**Request:**
```json
{
  "courseId":       "uuid",
  "classId":        "uuid",
  "lecturerUserId": "uuid",
  "academicYearId": "uuid"
}
```

All fields required; all must be valid UUIDs referencing entities in the same school.

---

### 7.13 Students

Base path: `/schools/:schoolId/students`

All routes are `🔒 👥` (school-scoped).

#### `GET /schools/:schoolId/students` 🛡 `owner, admin, director`

**Query params:**

| Param | Type | Description |
|---|---|---|
| `status` | `string?` | Filter: `pending`, `approved`, `rejected`, `waitlisted` |
| `programId` | `string?` | UUID |
| `level` | `number?` | Year/level number |
| `limit` | `number?` | Max records returned |
| `offset` | `number?` | Pagination offset |

**Response `data`:**
```json
[
  {
    "id":              "uuid",
    "schoolId":        "uuid",
    "matricNo":        "UG/CS/2023/001",
    "classId":         "uuid",
    "status":          "approved",
    "rejectionReason": null,
    "appliedAt":       "2023-09-01T10:00:00.000Z",
    "user": {
      "id":       "uuid",
      "fullName": "Kofi Atta",
      "email":    "kofi@school.edu",
      "avatarUrl": null
    }
  }
]
```

#### `GET /schools/:schoolId/students/:studentId` 🛡 `owner, admin, director, lecturer`

**Response `data`:** Single student object (same shape).

#### `POST /schools/:schoolId/students` 🛡 `owner, admin`

**Request:**
```json
{
  "userId":   "uuid",
  "matricNo": "UG/CS/2023/001",
  "classId":  "uuid"
}
```

| Field | Type | Constraints |
|---|---|---|
| `userId` | `string` | UUID of an existing user |
| `matricNo` | `string?` | Unique within school |
| `classId` | `string?` | UUID |

**Response `data`:** Created student object.

#### `PATCH /schools/:schoolId/students/:studentId` 🛡 `owner, admin`

Updates enrollment status.

**Request:**
```json
{
  "status":          "approved",
  "rejectionReason": null
}
```

| Field | Type | Values |
|---|---|---|
| `status` | `string` | `'approved'`, `'rejected'`, `'waitlisted'` |
| `rejectionReason` | `string?` | Required when `status` is `'rejected'` |

#### `DELETE /schools/:schoolId/students/:studentId` 🛡 `owner, admin`

Permanently removes the student record. **Response `data`:** `{ success: true }`

---

### 7.14 Timetable

Base path: `/schools/:schoolId/timetable`

All routes are `🔒 👥` (school-scoped).

#### `GET /schools/:schoolId/timetable` 🛡 `owner, admin, director, hod, lecturer, student, guardian`

**Response `data`:**
```json
[
  {
    "id":                 "uuid",
    "academicYearId":     "uuid",
    "courseAssignmentId": "uuid",
    "dayOfWeek":          1,
    "startTime":          "08:00",
    "endTime":            "10:00",
    "venue":              "LT-101"
  }
]
```

`dayOfWeek`: `0` = Sunday … `6` = Saturday.

#### `POST /schools/:schoolId/timetable` 🛡 `owner, admin, hod`

**Request:**
```json
{
  "academicYearId":     "uuid",
  "courseAssignmentId": "uuid",
  "dayOfWeek":          1,
  "startTime":          "08:00",
  "endTime":            "10:00",
  "venue":              "LT-101"
}
```

| Field | Type | Constraints |
|---|---|---|
| `academicYearId` | `string` | UUID |
| `courseAssignmentId` | `string` | UUID |
| `dayOfWeek` | `number` | Integer 0–6 |
| `startTime` | `string` | `HH:MM` 24-hour format |
| `endTime` | `string` | `HH:MM`; must be after `startTime` |
| `venue` | `string?` | Name of venue; must match an existing venue's `name` in this school |

> **Overlap detection:** The server returns `error.code: 'SCHEDULINGCONFLICT'` if the slot overlaps with an existing slot for the same course assignment.

#### `PATCH /schools/:schoolId/timetable/:slotId` 🛡 `owner, admin, hod`

**Request:** All fields from `POST` are optional.

#### `DELETE /schools/:schoolId/timetable/:slotId` 🛡 `owner, admin, hod`

**Response `data`:** `{ success: true }`

---

### 7.15 Sessions

Base path: `/schools/:schoolId/sessions`

All routes are `🔒 👥` (school-scoped).

#### `GET /schools/:schoolId/sessions` 🛡 `owner, admin, director, hod, lecturer, student, guardian`

**Response `data`:**
```json
[
  {
    "id":            "uuid",
    "status":        "scheduled",
    "scheduledDate": "2026-05-10",
    "courseCode":    "CS301",
    "courseTitle":   "Data Structures",
    "className":     "L300-A",
    "lecturerName":  "Dr. Ama Boateng"
  }
]
```

Session `status` values:

| Status | Description |
|---|---|
| `scheduled` | Created, not yet started |
| `live` | Currently in progress |
| `completed` | Ended normally |
| `cancelled` | Cancelled before starting |

#### `POST /schools/:schoolId/sessions` 🛡 `owner, admin, hod`

**Request:**
```json
{
  "courseAssignmentId": "uuid",
  "timetableSlotId":   "uuid",
  "scheduledDate":     "2026-05-10"
}
```

| Field | Type | Constraints |
|---|---|---|
| `courseAssignmentId` | `string` | UUID |
| `timetableSlotId` | `string?` | UUID; links session to a timetable slot (enables geofencing) |
| `scheduledDate` | `string` | ISO date `YYYY-MM-DD` |

**Response `data`:**
```json
{
  "id":            "uuid",
  "status":        "scheduled",
  "scheduledDate": "2026-05-10"
}
```

#### `POST /schools/:schoolId/sessions/:sessionId/start` 🛡 `owner, admin, lecturer`

Transitions the session from `scheduled` → `live`. Optionally validates that the lecturer is within the venue's geofence.

**Request:**
```json
{
  "lat":      5.6037,
  "lng":      -0.1870,
  "accuracy": 15.0
}
```

| Field | Type | Constraints |
|---|---|---|
| `lat` | `number?` | Decimal degrees |
| `lng` | `number?` | Decimal degrees |
| `accuracy` | `number?` | GPS accuracy in metres |

**Geofence behaviour:** If the timetable slot has a linked venue with coordinates, and the lecturer's location is more than **100 metres** away, the server rejects the request:

```json
{
  "error": {
    "code": "VALIDATION",
    "details": {
      "code": "GEOFENCE_VIOLATION",
      "distanceMeters": 145,
      "threshold": 100
    }
  },
  "message": "You are too far from the venue (LT-101). Current distance: 145m."
}
```

Show this as a dismissable warning with the distance. If no venue coordinates exist, the call succeeds without geo validation.

**Response `data`:**
```json
{
  "id":        "uuid",
  "status":    "live",
  "startedAt": "2026-05-10T08:03:22.000Z"
}
```

#### `POST /schools/:schoolId/sessions/:sessionId/end` 🛡 `owner, admin, lecturer`

Transitions the session from `live` → `completed`. No request body required.

**Response `data`:**
```json
{
  "id":      "uuid",
  "status":  "completed",
  "endedAt": "2026-05-10T10:01:55.000Z"
}
```

**Error cases:**
- Session not in `live` state → `error.code: 'NOTFOUND'`, message: `"Session is not live"`

---

### 7.16 Attendance

Base path: `/schools/:schoolId`

All routes are `🔒 👥` (school-scoped).

#### `GET /schools/:schoolId/sessions/:sessionId/attendance`

Returns all attendance records for a session.

**Response `data`:**
```json
[
  {
    "id":           "uuid",
    "sessionId":    "uuid",
    "studentId":    "uuid",
    "status":       "present",
    "markedAt":     "2026-05-10T08:15:00.000Z",
    "markedByUserId": "uuid"
  }
]
```

Attendance `status` values: `present`, `absent`, `late`, `excused`

#### `GET /schools/:schoolId/students/:studentId/attendance`

Returns full attendance history for a student in this school.

**Response `data`:** Array of attendance records (same shape as above, includes `sessionId`).

#### `POST /schools/:schoolId/sessions/:sessionId/attendance` 🛡 `lecturer, admin, owner`

Marks attendance for a single student.

**Request:**
```json
{
  "studentId": "uuid",
  "status":    "present"
}
```

| Field | Type | Values |
|---|---|---|
| `studentId` | `string` | UUID |
| `status` | `string` | `'present'`, `'absent'`, `'late'`, `'excused'` |

#### `POST /schools/:schoolId/sessions/:sessionId/attendance/bulk` 🛡 `lecturer, admin, owner`

Marks attendance for multiple students in one request. Prefer this over calling the single endpoint in a loop.

**Request:**
```json
{
  "entries": [
    { "studentId": "uuid-1", "status": "present" },
    { "studentId": "uuid-2", "status": "absent" },
    { "studentId": "uuid-3", "status": "late" }
  ]
}
```

**Response `data`:** Array of created/updated attendance records.

---

### 7.17 Results

Base path: `/schools/:schoolId`

All routes are `🔒 👥` (school-scoped).

#### `POST /schools/:schoolId/results/bulk` 🛡 `lecturer, admin, owner`

Submits grade data in bulk. Request shape TBD by grading system integration.

#### `GET /schools/:schoolId/students/:studentId/results`

**Query params:**

| Param | Type | Description |
|---|---|---|
| `academicYearId` | `string?` | Filter by academic year |

**Response `data`:** Array of result records for the student.

---

### 7.18 Bulk Imports

Base path: `/schools/:schoolId/imports`

All routes are `🔒 👥` (school-scoped).

Imports run asynchronously: `POST` creates a job, the frontend polls until `status` reaches a terminal state.

#### Import job status lifecycle

```
pending → processing → awaiting_confirmation → committed
                    ↘ failed
```

#### `GET /schools/:schoolId/imports` 🛡 `owner, admin, director`

**Response `data`:**
```json
[
  {
    "id":            "uuid",
    "type":          "students",
    "sourceFileUrl": "https://cdn.example.com/imports/file.csv",
    "status":        "awaiting_confirmation",
    "createdAt":     "2026-05-08T11:00:00.000Z"
  }
]
```

#### `POST /schools/:schoolId/imports` 🛡 `owner, admin`

**Request:**
```json
{
  "type":          "students",
  "sourceFileUrl": "https://cdn.example.com/imports/file.csv"
}
```

| Field | Type | Values |
|---|---|---|
| `type` | `string` | `'students'`, `'staff'`, `'courses'`, `'timetable'` |
| `sourceFileUrl` | `string?` | Valid URL to the uploaded file |

**Response `data`:** `ApiImportJob`

#### `GET /schools/:schoolId/imports/:importId` 🛡 `owner, admin`

Poll this until `status` is terminal. **Response `data`:** `ApiImportJob`

#### `POST /schools/:schoolId/imports/:importId/commit` 🛡 `owner, admin`

Confirms and applies a job in `awaiting_confirmation` state.

**Response `data`:** Updated `ApiImportJob` with `status: 'committed'`

#### `DELETE /schools/:schoolId/imports/:importId` 🛡 `owner, admin`

Cancels or deletes the import job. **Response `data`:** `ApiImportJob`

---

### 7.19 Audit Logs

Base path: `/schools/:schoolId/audit-logs`

All routes are `🔒 👥` (school-scoped).

#### `GET /schools/:schoolId/audit-logs` 🛡 `owner, admin, director`

**Query params:**

| Param | Type | Default |
|---|---|---|
| `page` | `number?` | `1` |
| `pageSize` | `number?` | `20` |

**Response `data`:** Array of audit log entries.
**Response `meta`:** `{ page, pageSize, total }`

```json
[
  {
    "id":           "uuid",
    "actorUserId":  "uuid",
    "action":       "session:start",
    "resourceType": "session",
    "resourceId":   "uuid",
    "metadata":     { "venue": "LT-101", "distanceMeters": 12 },
    "createdAt":    "2026-05-10T08:03:22.000Z"
  }
]
```

---

### 7.20 Reports

Base path: `/schools/:schoolId/reports`

All routes are `🔒 👥` (school-scoped).

#### `GET /schools/:schoolId/reports/sessions/geo-compliance` 🛡 `owner, admin, director`

Returns sessions where the lecturer started the session too far from the registered venue, or where no location data was captured.

**Query params:**

| Param | Type | Default |
|---|---|---|
| `limit` | `number?` | Server default |
| `offset` | `number?` | `0` |

**Response `data`:**
```json
[
  {
    "sessionId":      "uuid",
    "courseCode":     "CS301",
    "lecturerName":   "Dr. Ama Boateng",
    "scheduledDate":  "2026-05-10",
    "venueName":      "LT-101",
    "distanceMeters": 145,
    "violation":      "geofence_exceeded"
  }
]
```

---

## 8. TypeScript Type Definitions

Copy these into your frontend project. They are derived directly from the DTO and service source code.

```typescript
// ─── Auth ────────────────────────────────────────────────────────────────────

export interface TokenPair {
  accessToken:  string;
  refreshToken: string;
}

export interface AuthUser {
  id:      string;
  email:   string;
  profile: UserProfile;
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export interface UserProfile {
  id:        string;
  fullName:  string;
  phone:     string | null;
  avatarUrl: string | null;
}

// ─── Organizations ────────────────────────────────────────────────────────────

export interface ApiOrganization {
  id:         string;
  name:       string;
  code:       string;
  logoUrl:    string | null;
  memberRole?: UserRole;
}

// ─── Schools ──────────────────────────────────────────────────────────────────

export interface ApiSchool {
  id:     string;
  name:   string;
  code:   string;
  status: 'active' | 'inactive';
}

// ─── Venues ───────────────────────────────────────────────────────────────────

export interface ApiVenue {
  id:        string;
  name:      string;
  latitude:  number | null;
  longitude: number | null;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export type UserRole =
  | 'owner'
  | 'admin'
  | 'director'
  | 'hod'
  | 'lecturer'
  | 'student'
  | 'guardian'
  | 'follower';

export interface ApiUser {
  id:        string;
  email:     string;
  fullName:  string;
  phone:     string | null;
  avatarUrl: string | null;
  role:      UserRole;
  isActive:  boolean;
}

// ─── Academic ─────────────────────────────────────────────────────────────────

export interface ApiAcademicYear {
  id:        string;
  name:      string;
  startDate: string; // YYYY-MM-DD
  endDate:   string; // YYYY-MM-DD
  isActive:  boolean;
}

export interface ApiDepartment {
  id:   string;
  code: string;
  name: string;
}

export interface ApiCourse {
  id:           string;
  code:         string;
  title:        string;
  unitLoad:     number;
  departmentId: string | null;
}

export interface ApiCourseAssignment {
  id:             string;
  courseId:       string;
  classId:        string;
  lecturerUserId: string;
  academicYearId: string;
}

// ─── Students ─────────────────────────────────────────────────────────────────

export type StudentStatus = 'pending' | 'approved' | 'rejected' | 'waitlisted';

export interface ApiStudent {
  id:              string;
  schoolId:        string;
  matricNo:        string | null;
  classId:         string | null;
  status:          StudentStatus;
  rejectionReason: string | null;
  appliedAt:       string;
  user: {
    id:        string;
    fullName:  string;
    email:     string;
    avatarUrl: string | null;
  };
}

// ─── Timetable ────────────────────────────────────────────────────────────────

export interface ApiTimetableSlot {
  id:                 string;
  academicYearId:     string;
  courseAssignmentId: string;
  dayOfWeek:          0 | 1 | 2 | 3 | 4 | 5 | 6;
  startTime:          string; // HH:MM
  endTime:            string; // HH:MM
  venue:              string | null;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export type SessionStatus = 'scheduled' | 'live' | 'completed' | 'cancelled';

export interface ApiSession {
  id:            string;
  status:        SessionStatus;
  scheduledDate: string;        // YYYY-MM-DD
  courseCode:    string;
  courseTitle:   string;
  className:     string;
  lecturerName:  string;
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface ApiAttendanceRecord {
  id:             string;
  sessionId:      string;
  studentId:      string;
  status:         AttendanceStatus;
  markedAt:       string;
  markedByUserId: string;
}

// ─── Imports ──────────────────────────────────────────────────────────────────

export type ImportType   = 'students' | 'staff' | 'courses' | 'timetable';
export type ImportStatus = 'pending' | 'processing' | 'awaiting_confirmation' | 'committed' | 'failed';

export interface ApiImportJob {
  id:            string;
  type:          ImportType;
  sourceFileUrl: string | null;
  status:        ImportStatus;
  createdAt:     string;
}

// ─── Invitations ──────────────────────────────────────────────────────────────

export interface ApiInvitation {
  id:           string;
  email:        string;
  role:         UserRole;
  departmentId: string | null;
  status:       'pending' | 'accepted' | 'cancelled';
  expiresAt:    string;
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export interface ApiAuditLog {
  id:           string;
  actorUserId:  string;
  action:       string;
  resourceType: string;
  resourceId:   string;
  metadata:     Record<string, unknown>;
  createdAt:    string;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export type ApiErrorCode =
  | 'NOTFOUND'
  | 'CONFLICT'
  | 'VALIDATION'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'
  | 'TENANTSCOPE'
  | 'INVALIDSTATETRANSITION'
  | 'SCHEDULINGCONFLICT'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_SERVER_ERROR'
  | 'HTTP_ERROR';

export interface ApiError {
  code:    ApiErrorCode;
  details: Record<string, string> | null;
}

export interface ApiErrorResponse {
  success:    false;
  statusCode: number;
  message:    string;
  error:      ApiError;
  timestamp:  string;
  requestId:  string;
}
```

---

## 9. Common Patterns & Recipes

### 9.1 Centralised error handler

```typescript
import type { ApiErrorCode } from './types';

export function handleApiError(err: any, form?: UseFormReturn<any>): void {
  const code: ApiErrorCode = err.code;

  switch (code) {
    case 'VALIDATION_ERROR':
      if (form && err.details) {
        Object.entries(err.details).forEach(([field, msg]) =>
          form.setError(field as any, { message: msg as string }),
        );
      } else {
        toast.error(err.message);
      }
      break;

    case 'TENANTSCOPE':
      router.push('/organizations');
      break;

    case 'UNAUTHORIZED':
      clearTokens();
      router.push('/auth/sign-in');
      break;

    case 'FORBIDDEN':
      toast.error('You do not have permission to perform this action.');
      break;

    case 'NOTFOUND':
      toast.error('The requested resource was not found.');
      break;

    default:
      toast.error(err.message ?? 'Something went wrong. Please try again.');
  }
}
```

### 9.2 Token refresh helper

```typescript
export async function refreshTokens(): Promise<TokenPair> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token');

  // Call the raw axios instance, NOT the intercepted one, to avoid infinite loops
  const { data } = await axios.post(
    `${import.meta.env.VITE_API_BASE_URL}/auth/refresh`,
    { refreshToken },
  );
  return data.data; // envelope is NOT unwrapped here
}
```

### 9.3 Polling an import job

```typescript
async function waitForImport(schoolId: string, importId: string): Promise<ApiImportJob> {
  const TERMINAL = new Set(['committed', 'failed']);
  const POLL_MS  = 2000;

  while (true) {
    const job = await api.get<ApiImportJob>(
      `/schools/${schoolId}/imports/${importId}`,
    );
    if (TERMINAL.has(job.status)) return job;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}
```

### 9.4 Starting a session with geofence handling

```typescript
async function startSession(
  schoolId: string,
  sessionId: string,
  position?: GeolocationPosition,
) {
  try {
    return await api.post(
      `/schools/${schoolId}/sessions/${sessionId}/start`,
      position
        ? { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy }
        : {},
    );
  } catch (err) {
    if (
      err.code === 'VALIDATION' &&
      err.details?.code === 'GEOFENCE_VIOLATION'
    ) {
      throw new GeofenceError(
        err.message,
        err.details.distanceMeters,
        err.details.threshold,
      );
    }
    throw err;
  }
}
```

### 9.5 Building a bulk attendance payload

```typescript
interface StudentRow { studentId: string; status: AttendanceStatus }

async function submitBulkAttendance(
  schoolId:  string,
  sessionId: string,
  rows:      StudentRow[],
) {
  return api.post(
    `/schools/${schoolId}/sessions/${sessionId}/attendance/bulk`,
    { entries: rows },
  );
}
```

### 9.6 Invitation accept flow

```typescript
// On the /accept-invitation?token=<token> page
const token = new URLSearchParams(window.location.search).get('token');

async function acceptInvitation(token: string) {
  const result = await api.post(`/invitations/accept/${token}`);
  // Log the user in if the endpoint returns tokens
  if (result?.accessToken) {
    persistTokens(result.accessToken, result.refreshToken);
    router.push('/onboarding');
  }
}
```

---

## Appendix: Endpoint Quick-Reference

| Method | Path | Auth | Roles |
|---|---|---|---|
| POST | `/auth/login` | 🔓 | — |
| POST | `/auth/refresh` | 🔓 | — |
| POST | `/auth/logout` | 🔒 | — |
| GET | `/auth/me` | 🔒 | — |
| GET | `/profiles/me` | 🔒 | — |
| PATCH | `/profiles/me` | 🔒 | — |
| POST | `/profiles/me/avatar` | 🔒 | — |
| DELETE | `/profiles/me/avatar` | 🔒 | — |
| GET | `/organizations` | 🔒 | — |
| POST | `/organizations` | 🔒 | — |
| GET | `/organizations/:orgId` | 🔒 👥 | — |
| GET | `/organizations/:orgId/schools` | 🔒 👥 | — |
| POST | `/organizations/:orgId/schools` | 🔒 👥 | owner, admin |
| GET | `/organizations/:orgId/schools/:schoolId` | 🔒 👥 | — |
| PATCH | `/organizations/:orgId/schools/:schoolId` | 🔒 👥 | owner, admin |
| GET | `/schools/:schoolId/venues` | 🔒 👥 | owner, admin, director, hod, lecturer |
| POST | `/schools/:schoolId/venues` | 🔒 👥 | owner, admin |
| PATCH | `/schools/:schoolId/venues/:venueId` | 🔒 👥 | owner, admin |
| DELETE | `/schools/:schoolId/venues/:venueId` | 🔒 👥 | owner, admin |
| GET | `/schools/:schoolId/users` | 🔒 👥 | owner, admin, director |
| GET | `/schools/:schoolId/users/search` | 🔒 👥 | owner, admin, director |
| GET | `/schools/:schoolId/users/:userId` | 🔒 👥 | owner, admin, director |
| POST | `/schools/:schoolId/users` | 🔒 👥 | owner, admin |
| PATCH | `/schools/:schoolId/users/:userId` | 🔒 👥 | owner, admin |
| DELETE | `/schools/:schoolId/users/:userId` | 🔒 👥 | owner, admin |
| POST | `/schools/:schoolId/users/:userId/password-reset` | 🔒 👥 | owner, admin |
| GET | `/schools/:schoolId/user-roles/:userId` | 🔒 👥 | owner, admin, director |
| POST | `/schools/:schoolId/user-roles` | 🔒 👥 | owner, admin |
| DELETE | `/schools/:schoolId/user-roles/:userId/:role` | 🔒 👥 | owner, admin |
| GET | `/schools/:schoolId/user-roles/permissions/catalog` | 🔒 👥 | owner, admin |
| POST | `/schools/:schoolId/user-roles/permissions` | 🔒 👥 | owner |
| POST | `/schools/:schoolId/user-roles/:userId/permissions` | 🔒 👥 | owner, admin |
| DELETE | `/schools/:schoolId/user-roles/:userId/permissions/:code` | 🔒 👥 | owner, admin |
| GET | `/schools/:schoolId/user-roles/roles/catalog` | 🔒 👥 | owner, admin |
| POST | `/schools/:schoolId/user-roles/roles` | 🔒 👥 | owner, admin |
| POST | `/schools/:schoolId/user-roles/permissions/bulk-assign-role` | 🔒 👥 | owner, admin |
| GET | `/schools/:schoolId/invitations` | 🔒 👥 | owner, admin |
| POST | `/schools/:schoolId/invitations` | 🔒 👥 | owner, admin |
| DELETE | `/schools/:schoolId/invitations/:id` | 🔒 👥 | owner, admin |
| POST | `/invitations/accept/:token` | 🔓 | — |
| GET | `/schools/:schoolId/academic-years` | 🔒 👥 | — |
| POST | `/schools/:schoolId/academic-years` | 🔒 👥 | owner, admin |
| PATCH | `/schools/:schoolId/academic-years/:yearId` | 🔒 👥 | owner, admin |
| GET | `/schools/:schoolId/departments` | 🔒 👥 | — |
| POST | `/schools/:schoolId/departments` | 🔒 👥 | owner, admin |
| GET | `/schools/:schoolId/courses` | 🔒 👥 | — |
| POST | `/schools/:schoolId/courses` | 🔒 👥 | owner, admin, hod |
| GET | `/schools/:schoolId/course-assignments` | 🔒 👥 | — |
| POST | `/schools/:schoolId/course-assignments` | 🔒 👥 | owner, admin, hod |
| GET | `/schools/:schoolId/students` | 🔒 👥 | owner, admin, director |
| GET | `/schools/:schoolId/students/:studentId` | 🔒 👥 | owner, admin, director, lecturer |
| POST | `/schools/:schoolId/students` | 🔒 👥 | owner, admin |
| PATCH | `/schools/:schoolId/students/:studentId` | 🔒 👥 | owner, admin |
| DELETE | `/schools/:schoolId/students/:studentId` | 🔒 👥 | owner, admin |
| GET | `/schools/:schoolId/timetable` | 🔒 👥 | all roles |
| POST | `/schools/:schoolId/timetable` | 🔒 👥 | owner, admin, hod |
| PATCH | `/schools/:schoolId/timetable/:slotId` | 🔒 👥 | owner, admin, hod |
| DELETE | `/schools/:schoolId/timetable/:slotId` | 🔒 👥 | owner, admin, hod |
| GET | `/schools/:schoolId/sessions` | 🔒 👥 | all roles |
| POST | `/schools/:schoolId/sessions` | 🔒 👥 | owner, admin, hod |
| POST | `/schools/:schoolId/sessions/:sessionId/start` | 🔒 👥 | owner, admin, lecturer |
| POST | `/schools/:schoolId/sessions/:sessionId/end` | 🔒 👥 | owner, admin, lecturer |
| GET | `/schools/:schoolId/sessions/:sessionId/attendance` | 🔒 👥 | — |
| GET | `/schools/:schoolId/students/:studentId/attendance` | 🔒 👥 | — |
| POST | `/schools/:schoolId/sessions/:sessionId/attendance` | 🔒 👥 | lecturer, admin, owner |
| POST | `/schools/:schoolId/sessions/:sessionId/attendance/bulk` | 🔒 👥 | lecturer, admin, owner |
| POST | `/schools/:schoolId/results/bulk` | 🔒 👥 | lecturer, admin, owner |
| GET | `/schools/:schoolId/students/:studentId/results` | 🔒 👥 | — |
| GET | `/schools/:schoolId/imports` | 🔒 👥 | owner, admin, director |
| POST | `/schools/:schoolId/imports` | 🔒 👥 | owner, admin |
| GET | `/schools/:schoolId/imports/:importId` | 🔒 👥 | owner, admin |
| POST | `/schools/:schoolId/imports/:importId/commit` | 🔒 👥 | owner, admin |
| DELETE | `/schools/:schoolId/imports/:importId` | 🔒 👥 | owner, admin |
| GET | `/schools/:schoolId/audit-logs` | 🔒 👥 | owner, admin, director |
| GET | `/schools/:schoolId/reports/sessions/geo-compliance` | 🔒 👥 | owner, admin, director |
