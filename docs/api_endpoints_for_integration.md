# EduTrack API — Frontend Integration Reference

> **Audience:** Frontend engineers integrating with the EduTrack NestJS backend.
> **Base URL:** `http://localhost:3001/api/v1` (dev) — set via `GLOBAL_PREFIX` in `.env`.
> **Last updated:** 2026-05-11

---

## Table of Contents

1. [Global Concepts](#1-global-concepts)
2. [Authentication](#2-authentication)
3. [Multi-Tenancy Model](#3-multi-tenancy-model)
4. [Profile (current user)](#4-profile-current-user)
5. [Organizations](#5-organizations)
6. [Schools](#6-schools)
7. [Academic Structure](#7-academic-structure)
8. [Users & Roles](#8-users--roles)
9. [Attendance & Sessions](#9-attendance--sessions)
10. [Timetable](#10-timetable)
11. [Students](#11-students)
12. [Venues](#12-venues)
13. [Invitations](#13-invitations)
14. [Import Jobs](#14-import-jobs)
15. [Results](#15-results)
16. [Reports](#16-reports)
17. [Audit Logs](#17-audit-logs)
18. [System Administration](#18-system-administration)
19. [Known Gaps](#19-known-gaps)

---

## 1. Global Concepts

### 1.1 Request Format

All mutation requests must set:
```
Content-Type: application/json
Authorization: Bearer <accessToken>
```

### 1.2 Standard Error Envelope

Every error response — regardless of source — uses this shape:

```json
{
  "success":    false,
  "statusCode": 400,
  "message":    "A record with this information already exists.",
  "error": {
    "code":    "CONFLICT",
    "details": null
  },
  "timestamp": "2026-05-11T14:22:00.000Z",
  "requestId": "req_abc123"
}
```

| `error.code` | HTTP status | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 / 422 | DTO validation failed; `details` is a field→message map |
| `CONFLICT` | 400 | Unique constraint violation (duplicate code, email, etc.) |
| `VALIDATION` | 400 | Not-null constraint or business rule failure |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | Authenticated but insufficient role / not in tenant |
| `NOT_FOUND` | 404 | Resource not found |
| `SCHEMA_MISMATCH` | 400 | Migrations not run — contact backend |
| `DATABASE_ERROR` | 400 | Unexpected DB error |
| `INTERNAL_SERVER_ERROR` | 500 | Unhandled server exception |

**Tip:** On 400/422 with `VALIDATION_ERROR`, read `error.details` for per-field messages:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "details": {
      "email": "email must be an email",
      "password": "password must be longer than or equal to 8 characters"
    }
  }
}
```

### 1.3 Successful Responses

Successful responses return the resource directly (not wrapped in a `data` envelope):
```json
{ "id": "uuid", "name": "...", ... }
```
or an array:
```json
[{ "id": "uuid" }, ...]
```

Deletes return either HTTP `204 No Content` or `{ "success": true }` — see each endpoint.

### 1.4 Request ID

Every response includes `requestId`. Include the value from `X-Request-Id` header in support tickets or error reports.

### 1.5 Rate Limiting

| Route | Limit |
|---|---|
| `POST /auth/login` | 10 requests / 60 s |
| `POST /auth/refresh` | 20 requests / 60 s |
| All other routes | 120 requests / 60 s |

Exceeded limits → HTTP `429 Too Many Requests`.

---

## 2. Authentication

### 2.1 Login

```
POST /auth/login
```
Public (no Authorization header needed).

**Request:**
```json
{
  "email":    "admin@school.edu",
  "password": "MyPassword1!"
}
```

| Field | Type | Rules |
|---|---|---|
| `email` | `string` | Valid email |
| `password` | `string` | Min 8 characters |

**Response `200`:**
```json
{
  "accessToken":      "eyJhbGci...",
  "refreshToken":     "dGhpcyBp...",
  "accessExpiresIn":  "15m",
  "refreshExpiresIn": "7d"
}
```

> **Integration note:** Store `accessToken` in memory (not localStorage); store `refreshToken` in an HttpOnly cookie or secure storage. The access token expires after 15 minutes — use the refresh flow to get a new pair silently.

---

### 2.2 Refresh Tokens

```
POST /auth/refresh
```
Public.

**Request:**
```json
{ "refreshToken": "dGhpcyBp..." }
```

**Response `200`:** Same `TokenPair` shape as login.

> Refresh tokens are rotated on every use — the old token is invalidated. If the call fails with `401`, send the user to the login screen.

---

### 2.3 Logout

```
POST /auth/logout
```
🔒 Requires Authorization header.

**Request:**
```json
{ "refreshToken": "dGhpcyBp..." }
```

**Response `204`:** No body. The refresh token is revoked server-side.

---

### 2.4 Current User

```
GET /auth/me
```
🔒

**Response `200`:**
```json
{
  "id":      "uuid",
  "email":   "admin@school.edu",
  "profile": { "fullName": "Jane Doe", "phone": "...", "avatarUrl": null }
}
```

---

### 2.5 Change Own Password

```
PATCH /auth/change-password
```
🔒

**Request:**
```json
{
  "currentPassword": "OldPass#1",
  "newPassword":     "NewPass#2"
}
```

| Field | Type | Rules |
|---|---|---|
| `currentPassword` | `string` | Must match stored hash |
| `newPassword` | `string` | Min 8 characters |

**Response `200`:** `{ "success": true }`

**Error:** Wrong current password → `400 VALIDATION` — _"Current password is incorrect"_

---

## 3. Multi-Tenancy Model

EduTrack uses a two-level tenant hierarchy:

```
Organization (e.g. "University of Accra")
  └─ School (e.g. "School of Engineering")
       └─ Users, Courses, Sessions, etc.
```

- A user belongs to an organization via `organization_memberships`.
- A user belongs to a school via `school_memberships` and has one or more roles in `user_roles`.
- All school-scoped endpoints require the user to be a member of that school (enforced by `TenantGuard`).
- Role-gated endpoints are labelled with the minimum role(s) required.

**Auth token only contains `userId` and `email`.** The backend resolves roles at request time from the database — there is no role claim in the JWT.

---

## 4. Profile (Current User)

Base: `/profiles`

### 4.1 Get My Profile

```
GET /profiles/me
```
🔒

**Response:**
```json
{
  "id":        "uuid",
  "fullName":  "Jane Doe",
  "phone":     "+233 30 123 4567",
  "avatarUrl": "https://cdn.example.com/avatars/jane.jpg"
}
```

---

### 4.2 Update My Profile

```
PATCH /profiles/me
```
🔒

**Request (all optional):**
```json
{
  "fullName": "Jane K. Doe",
  "phone":    "+233 30 987 6543"
}
```

| Field | Rules |
|---|---|
| `fullName` | 1–200 characters |
| `phone` | Max 32 characters |

**Response:** Updated profile object.

---

### 4.3 Set / Remove Avatar

```
POST   /profiles/me/avatar
DELETE /profiles/me/avatar
```
🔒

**POST request:**
```json
{ "avatarUrl": "https://cdn.example.com/avatars/jane.jpg" }
```
The frontend uploads the image to your CDN first, then sends the resulting URL here.

**POST response:** Updated profile.
**DELETE response:** `{ "success": true }`

---

## 5. Organizations

Base: `/organizations`

### 5.1 List My Organizations

```
GET /organizations
```
🔒

Returns only organizations the authenticated user belongs to.

**Response:** `ApiOrganization[]`
```json
[
  {
    "id":      "uuid",
    "name":    "University of Accra",
    "code":    "uoa",
    "logoUrl": null
  }
]
```

---

### 5.2 Create Organization

```
POST /organizations
```
🔒

**Request:**
```json
{
  "name":    "University of Accra",
  "code":    "uoa",
  "logoUrl": null
}
```

| Field | Type | Rules |
|---|---|---|
| `name` | `string` | 2–200 characters |
| `code` | `string` | 2–64 characters; lowercase alphanumeric |
| `logoUrl` | `string?` | Valid URL |

**Response:** Created `ApiOrganization`.

---

### 5.3 Get Organization

```
GET /organizations/:organizationId
```
🔒 Must be a member of the organization.

**Response:** `ApiOrganization`.

---

### 5.4 Update Organization

```
PATCH /organizations/:organizationId
```
🔒 Role: `owner`

**Request (all optional):**
```json
{
  "name":    "University of Ghana",
  "code":    "uog",
  "logoUrl": "https://cdn.example.com/logos/uog.png"
}
```

**Response:** Updated `ApiOrganization`.

---

### 5.5 Delete Organization

```
DELETE /organizations/:organizationId
```
🔒 Role: `owner`

**Response:** `{ "success": true }`

> Soft-delete — sets `status: 'deleted'`. Historical data is preserved.

---

## 6. Schools

### 6.1 List Schools

```
GET /organizations/:organizationId/schools
```
🔒 Must be an org member.

**Query params (all optional):**

| Param | Type | Description |
|---|---|---|
| `status` | `'active' \| 'inactive'` | Filter by status |
| `q` | `string` | Full-text search on name or code |

**Example:** `GET /organizations/uuid/schools?status=active&q=engineering`

**Response:** `ApiSchool[]`
```json
[
  {
    "id":     "uuid",
    "name":   "School of Engineering",
    "code":   "soe",
    "status": "active",
    "address": null,
    "phone":   null,
    "email":   null,
    "website": null,
    "logoUrl": null,
    "timezone": null,
    "sessionDurationMinutes": null,
    "lateThresholdMinutes":   null,
    "requireGeoCheckin": false,
    "allowLateCheckin":  false
  }
]
```

---

### 6.2 Create School

```
POST /organizations/:organizationId/schools
```
🔒 Role: `owner, admin`

**Request:**
```json
{
  "name": "School of Engineering",
  "code": "soe"
}
```

| Field | Rules |
|---|---|
| `name` | 2–200 characters |
| `code` | 2–64 characters; lowercase alphanumeric |

**Response:** Created `ApiSchool`.

---

### 6.3 Get School (org-scoped)

```
GET /organizations/:organizationId/schools/:schoolId
```
🔒 Must be a school member.

**Response:** `ApiSchool`.

---

### 6.4 Get School (direct lookup — no org prefix)

```
GET /schools/:schoolId
```
🔒 Must be a school member.

Same response shape as 6.3. Use this when `organizationId` is not available in the route context (e.g., school workspace layout).

---

### 6.5 Update School

```
PATCH /organizations/:organizationId/schools/:schoolId
```
🔒 Role: `owner, admin`

**Request (all fields optional):**
```json
{
  "name":                    "School of Engineering",
  "status":                  "active",
  "address":                 "123 University Ave, Accra",
  "phone":                   "+233 30 123 4567",
  "email":                   "soe@uni.edu.gh",
  "website":                 "https://soe.uni.edu.gh",
  "logoUrl":                 "https://cdn.example.com/logos/soe.png",
  "timezone":                "Africa/Accra",
  "sessionDurationMinutes":  60,
  "lateThresholdMinutes":    15,
  "requireGeoCheckin":       true,
  "allowLateCheckin":        false
}
```

| Field | Type | Rules |
|---|---|---|
| `name` | `string?` | 2–200 characters |
| `status` | `'active' \| 'inactive'?` | — |
| `address` | `string?` | Max 500 characters |
| `phone` | `string?` | Max 32 characters |
| `email` | `string?` | Valid email |
| `website` | `string?` | Valid URL |
| `logoUrl` | `string?` | Valid URL |
| `timezone` | `string?` | IANA timezone, e.g. `"Africa/Accra"` |
| `sessionDurationMinutes` | `number?` | 5–480 |
| `lateThresholdMinutes` | `number?` | Min 1 |
| `requireGeoCheckin` | `boolean?` | Enforce geofence check-in |
| `allowLateCheckin` | `boolean?` | Accept marks after session start |

**Response:** Updated `ApiSchool`.

---

### 6.6 School Logo

```
POST   /organizations/:organizationId/schools/:schoolId/logo
DELETE /organizations/:organizationId/schools/:schoolId/logo
```
🔒 Role: `owner, admin`

**POST request:**
```json
{ "logoUrl": "https://cdn.example.com/logos/soe.png" }
```

Upload the image to your CDN first; send only the URL here.

**POST / DELETE response:** Updated `ApiSchool` with the new `logoUrl` (or `null` on DELETE).

---

### 6.7 Delete School

```
DELETE /organizations/:organizationId/schools/:schoolId
```
🔒 Role: `owner`

**Response:** `{ "success": true }`

---

## 7. Academic Structure

All routes in this section are school-scoped: `🔒 Must be a school member.`

---

### 7.1 Academic Years

Base: `/schools/:schoolId/academic-years`

#### List

```
GET /schools/:schoolId/academic-years
```

**Response:**
```json
[
  {
    "id":        "uuid",
    "schoolId":  "uuid",
    "name":      "2024-2025",
    "startDate": "2024-09-01",
    "endDate":   "2025-07-31",
    "isActive":  true
  }
]
```

#### Create

```
POST /schools/:schoolId/academic-years
```
Role: `owner, admin`

```json
{
  "name":      "2024-2025",
  "startDate": "2024-09-01",
  "endDate":   "2025-07-31",
  "isActive":  true
}
```

| Field | Rules |
|---|---|
| `name` | 2–64 characters |
| `startDate` | ISO date (`YYYY-MM-DD`) |
| `endDate` | ISO date; must be after `startDate` |
| `isActive` | `boolean?` — only one active year per school |

**Response:** Created academic year.

#### Update

```
PATCH /schools/:schoolId/academic-years/:academicYearId
```
Role: `owner, admin` — same fields, all optional.

> **Gap:** DELETE is not yet implemented. To deactivate a year, PATCH `isActive: false`.

---

### 7.2 Departments

Base: `/schools/:schoolId/departments`

#### List
```
GET /schools/:schoolId/departments
```
**Response:**
```json
[{ "id": "uuid", "schoolId": "uuid", "code": "GI", "name": "Génie Informatique" }]
```

#### Create
```
POST /schools/:schoolId/departments
```
Role: `owner, admin`

```json
{ "code": "GI", "name": "Génie Informatique" }
```

| Field | Rules |
|---|---|
| `code` | 2–32 characters; alphanumeric; unique within school |
| `name` | 2–200 characters |

#### Update
```
PATCH /schools/:schoolId/departments/:departmentId
```
Role: `owner, admin, director, hod` — fields same as POST, all optional.

#### Delete
```
DELETE /schools/:schoolId/departments/:departmentId
```
Role: `owner, admin` — **Response:** `{ "success": true }`

---

### 7.3 Programs

Base: `/schools/:schoolId/programs`

#### List
```
GET /schools/:schoolId/programs
```
**Response:**
```json
[
  {
    "id":            "uuid",
    "schoolId":      "uuid",
    "code":          "BTS-GI",
    "name":          "BTS Génie Informatique",
    "durationYears": 2,
    "departmentId":  "uuid"
  }
]
```

#### Create
```
POST /schools/:schoolId/programs
```
Role: `owner, admin, hod`

```json
{
  "code":          "BTS-GI",
  "name":          "BTS Génie Informatique",
  "durationYears": 2,
  "departmentId":  "uuid"
}
```

| Field | Rules |
|---|---|
| `code` | 2–32 characters; alphanumeric; unique within school |
| `name` | 2–200 characters |
| `durationYears` | Integer, min 1 |
| `departmentId` | `string?` UUID |

#### Update
```
PATCH /schools/:schoolId/programs/:programId
```
Role: `owner, admin, hod` — same fields, all optional.

#### Delete
```
DELETE /schools/:schoolId/programs/:programId
```
Role: `owner, admin` — **Response:** `{ "success": true }`

---

### 7.4 Courses

Base: `/schools/:schoolId/courses`

#### List
```
GET /schools/:schoolId/courses
```
**Response:**
```json
[
  {
    "id":           "uuid",
    "schoolId":     "uuid",
    "code":         "INFO101",
    "title":        "Introduction à la Programmation",
    "unitLoad":     4,
    "departmentId": "uuid"
  }
]
```

#### Create
```
POST /schools/:schoolId/courses
```
Role: `owner, admin, hod`

```json
{
  "code":         "INFO101",
  "title":        "Introduction à la Programmation",
  "unitLoad":     4,
  "departmentId": "uuid"
}
```

| Field | Rules |
|---|---|
| `code` | 2–32 characters; alphanumeric; unique within school |
| `title` | 2–200 characters |
| `unitLoad` | `integer?` min 1, default 2 |
| `departmentId` | `string?` UUID |

#### Update
```
PATCH /schools/:schoolId/courses/:courseId
```
Role: `owner, admin, hod` — same fields, all optional.

#### Delete
```
DELETE /schools/:schoolId/courses/:courseId
```
Role: `owner, admin, hod` — **Response:** `{ "success": true }`

---

### 7.5 Classes

Base: `/schools/:schoolId/classes`

#### List
```
GET /schools/:schoolId/classes?academicYearId=uuid
```

`academicYearId` is optional but recommended to narrow results.

**Response:**
```json
[
  {
    "id":             "uuid",
    "schoolId":       "uuid",
    "academicYearId": "uuid",
    "programId":      "uuid",
    "specialtyId":    "uuid",
    "name":           "BTS-GI/DEV-LOG — L1",
    "level":          1
  }
]
```

#### Create
```
POST /schools/:schoolId/classes
```
Role: `owner, admin, hod`

```json
{
  "academicYearId": "uuid",
  "name":           "BTS-GI/DEV-LOG — L1",
  "programId":      "uuid",
  "specialtyId":    "uuid",
  "level":          1
}
```

| Field | Rules |
|---|---|
| `academicYearId` | Required UUID |
| `name` | 1–100 characters; unique within school+year |
| `programId` | `string?` UUID |
| `specialtyId` | `string?` UUID |
| `level` | `integer?` min 1 |

#### Update
```
PATCH /schools/:schoolId/classes/:classId
```
Role: `owner, admin` — `name`, `programId`, `level` — all optional.

#### Delete
```
DELETE /schools/:schoolId/classes/:classId
```
Role: `owner, admin` — **Response:** `{ "success": true }`

---

### 7.6 Semesters

Base: `/schools/:schoolId/semesters`

#### List
```
GET /schools/:schoolId/semesters?academicYearId=uuid
```

`academicYearId` is **required** — the API will not return results without it.

**Response:**
```json
[
  {
    "id":             "uuid",
    "academicYearId": "uuid",
    "name":           "Semestre 1",
    "startDate":      "2024-09-01",
    "endDate":        "2025-01-31",
    "isCurrent":      true
  }
]
```

#### Create
```
POST /schools/:schoolId/semesters
```
Role: `owner, admin`

```json
{
  "academicYearId": "uuid",
  "name":           "Semestre 1",
  "startDate":      "2024-09-01",
  "endDate":        "2025-01-31",
  "isCurrent":      false
}
```

| Field | Rules |
|---|---|
| `academicYearId` | Required UUID |
| `name` | 2–64 characters |
| `startDate` | ISO date; within the parent academic year's range |
| `endDate` | ISO date; after `startDate` |
| `isCurrent` | `boolean?` — setting `true` auto-unsets any other current semester |

#### Update
```
PATCH /schools/:schoolId/semesters/:semesterId
```
Role: `owner, admin` — same fields, all optional.

> **Gap:** DELETE semester is not yet implemented.

---

### 7.7 Specialties

Base: `/schools/:schoolId/specialties`

#### List
```
GET /schools/:schoolId/specialties?programId=uuid
```
`programId` is optional.

**Response:**
```json
[{ "id": "uuid", "schoolId": "uuid", "programId": "uuid", "code": "DEV-LOG", "name": "Développement Logiciel" }]
```

#### Create
```
POST /schools/:schoolId/specialties/programs/:programId
```
Role: `owner, admin, hod`

```json
{ "code": "DEV-LOG", "name": "Développement Logiciel" }
```

---

### 7.8 Program Levels

Base: `/schools/:schoolId/programs/:programId/levels`

#### List
```
GET /schools/:schoolId/programs/:programId/levels
```

#### Create
```
POST /schools/:schoolId/programs/:programId/levels
```
Role: `owner, admin, hod`

```json
{ "level": 1, "name": "Niveau 1 — Première Année" }
```

| Field | Rules |
|---|---|
| `level` | Integer, min 1 |
| `name` | 1–100 characters |

---

### 7.9 Course Assignments

Links a course, class, lecturer, and academic year.

Base: `/schools/:schoolId/course-assignments`

#### List
```
GET /schools/:schoolId/course-assignments?lecturerUserId=uuid&academicYearId=uuid
```
Both query params are optional.

#### Create
```
POST /schools/:schoolId/course-assignments
```
Role: `owner, admin, hod`

```json
{
  "courseId":        "uuid",
  "classId":         "uuid",
  "lecturerUserId":  "uuid",
  "academicYearId":  "uuid"
}
```

All fields required UUIDs.

---

## 8. Users & Roles

### 8.1 List Users

```
GET /schools/:schoolId/users
```
🔒 Role: `owner, admin, director`

**Response:**
```json
[
  {
    "id":       "uuid",
    "email":    "user@school.edu",
    "isActive": true,
    "fullName": "Jean-Baptiste Nkolo",
    "phone":    "+237677000001",
    "avatarUrl": null,
    "joinedAt": "2024-09-01T00:00:00.000Z",
    "roles": [
      { "role": "owner", "departmentId": null }
    ]
  }
]
```

---

### 8.2 Search Users

```
GET /schools/:schoolId/users/search
```
🔒 Role: `owner, admin, director`

**Query params:**

| Param | Type | Default |
|---|---|---|
| `q` | `string?` | — (search email and full name) |
| `role` | `UserRole?` | — (filter by role) |
| `limit` | `number?` | 20 |
| `offset` | `number?` | 0 |

**Response:**
```json
{
  "items": [ /* UserListItemDto[] */ ],
  "meta":  { "total": 42, "limit": 20, "offset": 0 }
}
```

---

### 8.3 Get User

```
GET /schools/:schoolId/users/:userId
```
🔒 Role: `owner, admin, director` — same shape as list item.

---

### 8.4 Create User

```
POST /schools/:schoolId/users
```
🔒 Role: `owner, admin`

```json
{
  "email":    "newuser@school.edu",
  "fullName": "Ama Boateng",
  "role":     "lecturer",
  "password": "TempPass#1"
}
```

| Field | Rules |
|---|---|
| `email` | Valid email |
| `fullName` | Non-empty string |
| `role` | One of: `owner \| admin \| director \| hod \| lecturer \| student \| guardian \| follower` |
| `password` | `string?` min 8 — if omitted, a random password is generated |

> If the email already exists on the platform, the user is linked to the school without creating a new account (no duplicate users). The call fails if they are already a member of this school.

**Response:** Created `UserListItemDto`.

---

### 8.5 Update User

```
PATCH /schools/:schoolId/users/:userId
```
🔒 Role: `owner, admin`

```json
{
  "fullName": "Ama K. Boateng",
  "phone":    "+233 55 123 4567",
  "isActive": false
}
```
All fields optional. **Response:** Updated `UserListItemDto`.

---

### 8.6 Remove User from School

```
DELETE /schools/:schoolId/users/:userId
```
🔒 Role: `owner, admin`

Removes school membership — does not delete the global account. **Response:** `{ "success": true }`

---

### 8.7 Admin Password Reset

```
POST /schools/:schoolId/users/:userId/password-reset
```
🔒 Role: `owner, admin`

```json
{ "password": "NewTemp#Pass1" }
```

**Response:** `{ "success": true }`

---

### 8.8 Role Assignment

Base: `/schools/:schoolId/user-roles`

#### List roles for a user
```
GET /schools/:schoolId/user-roles/:userId
```
Role: `owner, admin, director`

**Response:**
```json
[{ "role": "hod", "departmentId": "uuid" }]
```

#### Assign role
```
POST /schools/:schoolId/user-roles
```
Role: `owner, admin`

```json
{
  "userId":       "uuid",
  "role":         "hod",
  "departmentId": "uuid"
}
```

| Field | Rules |
|---|---|
| `userId` | UUID |
| `role` | `UserRole` enum |
| `roleId` | `string?` UUID — for dynamic roles |
| `departmentId` | `string?` UUID |

#### Revoke role
```
DELETE /schools/:schoolId/user-roles/:userId/:role
```
Role: `owner, admin` — **Response:** HTTP `204`

---

### 8.9 Permissions

```
GET  /schools/:schoolId/user-roles/permissions/catalog   → All permissions
POST /schools/:schoolId/user-roles/permissions           → Create permission (owner only)
POST /schools/:schoolId/user-roles/:userId/permissions   → Assign to user
DELETE /schools/:schoolId/user-roles/:userId/permissions/:permissionCode
GET  /schools/:schoolId/user-roles/roles/catalog         → Dynamic roles for school
POST /schools/:schoolId/user-roles/roles                 → Create dynamic role
POST /schools/:schoolId/user-roles/permissions/bulk-assign-role
```

**Create permission request:**
```json
{ "code": "report:export", "description": "Can export reports" }
```
`code` must follow `domain:action` format.

**Assign permission request body:** `{ "permissionCode": "report:export" }`

**Bulk-assign permission to role:**
```json
{ "role": "lecturer", "permissionCode": "attendance:mark" }
```

---

## 9. Attendance & Sessions

### 9.1 Sessions

Base: `/schools/:schoolId/sessions`

#### List sessions
```
GET /schools/:schoolId/sessions
```
🔒 All roles (including student, guardian).

#### Create session
```
POST /schools/:schoolId/sessions
```
Role: `owner, admin, hod`

```json
{
  "courseAssignmentId": "uuid",
  "timetableSlotId":    "uuid",
  "scheduledDate":      "2025-10-01"
}
```

#### Start session
```
POST /schools/:schoolId/sessions/:sessionId/start
```
Role: `owner, admin, lecturer`

```json
{ "lat": 5.6037, "lng": -0.1870, "accuracy": 10 }
```
Sets status to `live` and records geolocation.

#### End session
```
POST /schools/:schoolId/sessions/:sessionId/end
```
Role: `owner, admin, lecturer` — no body. Sets status to `ended`.

---

### 9.2 Mark Attendance

```
POST /schools/:schoolId/sessions/:sessionId/attendance
```
🔒 Role: `lecturer, admin, owner`

```json
{
  "studentId": "uuid",
  "status":    "present"
}
```

`status` values: `present | absent | late | excused`

**Response:** Created `AttendanceRecord`.

---

### 9.3 Bulk Mark Attendance

```
POST /schools/:schoolId/sessions/:sessionId/attendance/bulk
```
Role: `lecturer, admin, owner`

```json
{
  "entries": [
    { "studentId": "uuid-1", "status": "present" },
    { "studentId": "uuid-2", "status": "absent"  }
  ]
}
```

**Response:** `AttendanceRecord[]`

---

### 9.4 Get Attendance for a Session

```
GET /schools/:schoolId/sessions/:sessionId/attendance
```
🔒 All school members.

---

### 9.5 Get Attendance for a Student

```
GET /schools/:schoolId/students/:studentId/attendance
```
🔒 All school members.

---

### 9.6 Attendance Summary — All Students

```
GET /schools/:schoolId/attendance/summary
```
Role: `owner, admin, director, lecturer`

**Query params (optional):**

| Param | Description |
|---|---|
| `academicYearId` | Filter by year |
| `sessionId` | Narrow to a single session |

**Response:**
```json
[
  {
    "studentId":     "uuid",
    "fullName":      "Kofi Atta",
    "matricNo":      "IUT-GI-2024-001",
    "present":        18,
    "late":            3,
    "absent":          2,
    "excused":         1,
    "totalSessions":  24,
    "attendanceRate": 87.5
  }
]
```

---

### 9.7 Attendance Summary — Single Student

```
GET /schools/:schoolId/students/:studentId/attendance/summary
```
Role: `owner, admin, director, lecturer`

**Query params:** `academicYearId?`

**Response:**
```json
{
  "studentId":      "uuid",
  "totalSessions":  24,
  "present":        18,
  "late":            3,
  "absent":          2,
  "excused":         1,
  "attendanceRate": 87.5
}
```

---

## 10. Timetable

Base: `/schools/:schoolId/timetable`

### List slots
```
GET /schools/:schoolId/timetable
```
🔒 All school roles (including student, guardian).

### Create slot
```
POST /schools/:schoolId/timetable
```
Role: `owner, admin, hod`

```json
{
  "academicYearId":      "uuid",
  "courseAssignmentId":  "uuid",
  "dayOfWeek":           1,
  "startTime":           "08:00",
  "endTime":             "10:00",
  "venue":               "Hall A"
}
```

| Field | Rules |
|---|---|
| `dayOfWeek` | 0 (Sun) – 6 (Sat) |
| `startTime` | `HH:MM` format |
| `endTime` | `HH:MM` format; after `startTime` |
| `venue` | `string?` |

### Update slot
```
PATCH /schools/:schoolId/timetable/:slotId
```
Role: `owner, admin, hod` — same fields, all optional.

### Delete slot
```
DELETE /schools/:schoolId/timetable/:slotId
```
Role: `owner, admin, hod` — **Response:** deleted slot object.

---

## 11. Students

Base: `/schools/:schoolId/students`

### List students
```
GET /schools/:schoolId/students
```
🔒 Role: `owner, admin, director`

**Query params (all optional):**

| Param | Description |
|---|---|
| `status` | `'approved' \| 'rejected' \| 'waitlisted'` |
| `programId` | Filter by program |
| `level` | Filter by class level |
| `limit` | Default unset |
| `offset` | Default 0 |

### Get student
```
GET /schools/:schoolId/students/:studentId
```
Role: `owner, admin, director, lecturer`

### Enroll student
```
POST /schools/:schoolId/students
```
Role: `owner, admin`

```json
{
  "userId":   "uuid",
  "matricNo": "IUT-GI-2024-001",
  "classId":  "uuid"
}
```

### Update student status
```
PATCH /schools/:schoolId/students/:studentId
```
Role: `owner, admin`

```json
{
  "status":           "approved",
  "rejectionReason":  null
}
```
`status` values: `approved | rejected | waitlisted`

### Remove student
```
DELETE /schools/:schoolId/students/:studentId
```
Role: `owner, admin` — **Response:** deleted student object.

---

### 11.1 Guardian — Linked Students

```
GET /schools/:schoolId/guardians/me/students
```
🔒 Must be authenticated as a guardian in that school.

**Response:**
```json
[
  {
    "studentId": "uuid",
    "fullName":  "Kofi Atta",
    "matricNo":  "IUT-GI-2024-001",
    "classId":   "uuid"
  }
]
```

---

## 12. Venues

Base: `/schools/:schoolId/venues`

### List
```
GET /schools/:schoolId/venues
```
Role: `owner, admin, director, hod, lecturer`

**Response:**
```json
[{ "id": "uuid", "name": "Amphi A", "latitude": 3.848, "longitude": 11.502 }]
```

### Create
```
POST /schools/:schoolId/venues
```
Role: `owner, admin`

```json
{
  "name":      "Amphi A",
  "latitude":  3.848,
  "longitude": 11.502
}
```

`latitude` and `longitude` are optional — required only if `requireGeoCheckin` is enabled on the school.

### Update
```
PATCH /schools/:schoolId/venues/:venueId
```
Role: `owner, admin` — same fields, all optional.

### Delete
```
DELETE /schools/:schoolId/venues/:venueId
```
Role: `owner, admin` — **Response:** deleted venue object.

---

## 13. Invitations

### List invitations
```
GET /schools/:schoolId/invitations
```
Role: `owner, admin`

### Send invitation
```
POST /schools/:schoolId/invitations
```
Role: `owner, admin`

```json
{
  "email":        "newstaff@school.edu",
  "role":         "lecturer",
  "departmentId": "uuid"
}
```

`departmentId` is optional — required only for `hod` role.

### Cancel invitation
```
DELETE /schools/:schoolId/invitations/:invitationId
```
Role: `owner, admin`

### Accept invitation (public)

```
POST /invitations/accept/:token
```
No Authorization header required.

**Response:** `{ "success": true, "user": { ... } }`

> The token is included in the invitation email link. If the email is new to the platform, the account is created automatically with a temporary password. The frontend should redirect to the change-password flow after acceptance.

---

## 14. Import Jobs

Base: `/schools/:schoolId/imports`

Used to bulk-import data (students, users, etc.) via a file URL.

### List jobs
```
GET /schools/:schoolId/imports
```
Role: `owner, admin, director`

### Create job
```
POST /schools/:schoolId/imports
```
Role: `owner, admin`

```json
{
  "type":          "students",
  "sourceFileUrl": "https://cdn.example.com/uploads/students.csv"
}
```

### Get job (with validation details)
```
GET /schools/:schoolId/imports/:importId
```
Role: `owner, admin`

### Commit job
```
POST /schools/:schoolId/imports/:importId/commit
```
Role: `owner, admin` — applies the validated import to the database.

### Delete / cancel job
```
DELETE /schools/:schoolId/imports/:importId
```
Role: `owner, admin`

---

## 15. Results

### Submit bulk results
```
POST /schools/:schoolId/results/bulk
```
Role: `lecturer, admin, owner`

Accepts a grades payload (consult results service for exact shape).

### Get student results
```
GET /schools/:schoolId/students/:studentId/results
```
🔒 All school members.

**Query params:** `academicYearId?`

---

## 16. Reports

Base: `/schools/:schoolId/reports`

Role for all: `owner, admin, director`

### Geo-compliance (sessions)
```
GET /schools/:schoolId/reports/sessions/geo-compliance
```
**Query params:** `limit?`, `offset?`

### Enrollment report
```
GET /schools/:schoolId/reports/enrollment
```
**Query params:** `academicYearId?` (defaults to current year)

**Response:**
```json
{
  "totalStudents": 150,
  "approved":      130,
  "pending":        12,
  "rejected":        5,
  "waitlisted":      3,
  "byDepartment": [
    { "departmentId": "uuid", "name": "Génie Informatique", "count": 60 }
  ]
}
```

### Attendance trend report
```
GET /schools/:schoolId/reports/attendance
```
**Query params:** `academicYearId?`, `period?: 'week' | 'month'` (default `'week'`)

**Response:**
```json
{
  "averageRate": 87.3,
  "atRiskCount": 5,
  "byPeriod": [
    { "label": "Week 1", "rate": 90.2 },
    { "label": "Week 2", "rate": 85.1 }
  ]
}
```

---

## 17. Audit Logs

```
GET /schools/:schoolId/audit-logs
```
🔒 Role: `owner, admin, director`

**Query params:**

| Param | Default |
|---|---|
| `page` | 1 |
| `pageSize` | 20 |

**Response:**
```json
{
  "items": [
    {
      "id":           "uuid",
      "action":       "user:create_in_school",
      "resourceType": "user",
      "resourceId":   "uuid",
      "actorUserId":  "uuid",
      "metadata":     { "email": "...", "role": "lecturer" },
      "createdAt":    "2025-10-01T14:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 84 }
}
```

---

## 18. System Administration

Base: `/system`

All routes require a valid JWT **and** `is_system_admin = true` on the account. Regular school owners/admins are blocked.

To create a super-admin account, run:
```bash
pnpm migration:run
pnpm seed:super-admin   # creates superadmin@edutrack.io / SuperAdmin2024!
```

### List all organizations
```
GET /system/organizations
```
**Response:** All organizations with school counts.

### Update organization status
```
PATCH /system/organizations/:orgId
```
```json
{ "status": "suspended" }
```
`status` values: `active | suspended | deleted`

### Delete organization
```
DELETE /system/organizations/:orgId
```

### List all users (platform-wide)
```
GET /system/users
```

### Promote / demote system admin
```
PATCH /system/users/:userId/system-admin
```
```json
{ "isSystemAdmin": true }
```

### Platform stats
```
GET /system/stats
```
```json
{
  "totalUsers":          1500,
  "totalOrganizations":    45,
  "totalSchools":         120,
  "activeSessions":        12,
  "timestamp":  "2026-05-11T14:00:00.000Z"
}
```

---

## 19. Known Gaps

The following items are **not yet implemented** in the backend:

| Feature | What's missing | Impact |
|---|---|---|
| `GET /schools/:schoolId/my-permissions` | No dedicated endpoint; permissions resolved only via guards | Frontend cannot pre-fetch the permission set to conditionally render sidebar items |
| `DELETE /schools/:schoolId/academic-years/:id` | Only list, create, update exist | Cannot remove a year — use PATCH `isActive: false` as workaround |
| `DELETE /schools/:schoolId/semesters/:id` | Only list, create, update exist | Cannot remove a semester |
| Invitation account-setup flow | `POST /invitations/accept/:token` creates the account silently; no `setupToken` flow | Frontend `AcceptInvitation.tsx` handles both paths — confirm chosen contract with backend |
| `GET /schools/:schoolId/users/search` filtering by `role` | The `role` query param hits a type mismatch (see §1.2 error codes) | Search works without the `role` filter; role filtering is blocked pending a fix |
