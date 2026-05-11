# Required API Endpoints for Frontend Integration

> **Purpose:** This document lists API endpoints that the EduTrack frontend needs but that are absent from the current backend API guide. Each section describes what the frontend requires, why it needs it, and the expected request/response contract so the backend team can implement it.

---

## 1. Departments — Update & Delete

### Why needed
`DepartmentsPage` shows Edit and Delete buttons that are currently no-ops. Users expect to be able to rename or remove a department.

### 1.1 `PATCH /schools/:schoolId/departments/:departmentId`

🔒 👥 🛡 `owner, admin, director, hod`

**Request:**
```json
{
  "code": "CS",
  "name": "Computer Science"
}
```

| Field | Type | Constraints |
|---|---|---|
| `code` | `string?` | 2–32 characters; alphanumeric; unique within school |
| `name` | `string?` | 2–200 characters |

**Response `data`:** Updated `ApiDepartment` object.

---

### 1.2 `DELETE /schools/:schoolId/departments/:departmentId`

🔒 👥 🛡 `owner, admin`

**Response `data`:** `{ success: true }`

> Backend should guard against deletion when the department still has active courses or enrolled students.

---

## 2. Courses — Update & Delete

### Why needed
`CoursesPage` has Edit and Delete menu items that are currently no-ops.

### 2.1 `PATCH /schools/:schoolId/courses/:courseId`

🔒 👥 🛡 `owner, admin, hod`

**Request:**
```json
{
  "code":         "CS301",
  "title":        "Data Structures",
  "unitLoad":     3,
  "departmentId": "uuid"
}
```

All fields optional. **Response `data`:** Updated `ApiCourse`.

---

### 2.2 `DELETE /schools/:schoolId/courses/:courseId`

🔒 👥 🛡 `owner, admin, hod`

**Response `data`:** `{ success: true }`

> Guard against deletion if active course assignments or timetable slots reference this course.

---

## 3. Programs — Full CRUD

### Why needed
The frontend has a `ProgramsPage`, `ProgramDetailPage`, a `usePrograms` hook, and a `programsService` — but the backend API guide documents no `/programs` endpoint at all. The feature is complete on the frontend; it only needs corresponding backend routes.

> **Note:** In the API guide, the closest concept is "classes" (`/schools/:schoolId/classes`). If programs are the same as classes, map accordingly. If they are distinct, implement them as described here.

### 3.1 `GET /schools/:schoolId/programs`

🔒 👥

**Response `data`:**
```json
[
  {
    "id":            "uuid",
    "schoolId":      "uuid",
    "code":          "BSCS",
    "name":          "Bachelor of Science in Computer Science",
    "durationYears": 4,
    "departmentId":  "uuid"
  }
]
```

### 3.2 `POST /schools/:schoolId/programs`

🔒 👥 🛡 `owner, admin, hod`

**Request:**
```json
{
  "code":          "BSCS",
  "name":          "Bachelor of Science in Computer Science",
  "durationYears": 4,
  "departmentId":  "uuid"
}
```

| Field | Type | Constraints |
|---|---|---|
| `code` | `string` | 2–32 characters; unique within school |
| `name` | `string` | 2–200 characters |
| `durationYears` | `number` | Min 1 |
| `departmentId` | `string?` | UUID |

**Response `data`:** `ApiProgram`

### 3.3 `PATCH /schools/:schoolId/programs/:programId`

🔒 👥 🛡 `owner, admin, hod`

Same fields as POST, all optional. **Response `data`:** `ApiProgram`

### 3.4 `DELETE /schools/:schoolId/programs/:programId`

🔒 👥 🛡 `owner, admin`

**Response `data`:** `{ success: true }`

---

## 4. Classes

### Why needed
`ApiCourseAssignment` references a `classId`. Students are enrolled into classes (e.g. "L300-A"). The frontend needs to list classes to populate dropdowns in the Course Assignment and Enrollment flows.

### 4.1 `GET /schools/:schoolId/classes`

🔒 👥

**Response `data`:**
```json
[
  {
    "id":             "uuid",
    "schoolId":       "uuid",
    "academicYearId": "uuid",
    "name":           "L300-A",
    "programId":      "uuid",
    "level":          3
  }
]
```

### 4.2 `POST /schools/:schoolId/classes`

🔒 👥 🛡 `owner, admin`

**Request:**
```json
{
  "academicYearId": "uuid",
  "name":           "L300-A",
  "programId":      "uuid",
  "level":          3
}
```

| Field | Type | Constraints |
|---|---|---|
| `academicYearId` | `string` | UUID |
| `name` | `string` | Non-empty; unique within school+year |
| `programId` | `string?` | UUID |
| `level` | `number?` | Year/level integer |

**Response `data`:** `ApiClass`

### 4.3 `PATCH /schools/:schoolId/classes/:classId`

🔒 👥 🛡 `owner, admin`

Same shape as POST, all optional. **Response `data`:** `ApiClass`

### 4.4 `DELETE /schools/:schoolId/classes/:classId`

🔒 👥 🛡 `owner, admin`

**Response `data`:** `{ success: true }`

---

## 5. Semesters

### Why needed
The `SchoolSettingsPage` Academic tab lets admin configure a "semester system". The app has a `useSemesters` hook and a `semesters.service.ts`. The API guide documents no semester endpoints.

### 5.1 `GET /schools/:schoolId/semesters`

🔒 👥

**Response `data`:**
```json
[
  {
    "id":             "uuid",
    "academicYearId": "uuid",
    "name":           "First Semester",
    "startDate":      "2025-09-01",
    "endDate":        "2026-01-31",
    "isCurrent":      true
  }
]
```

### 5.2 `POST /schools/:schoolId/semesters`

🔒 👥 🛡 `owner, admin`

**Request:**
```json
{
  "academicYearId": "uuid",
  "name":           "First Semester",
  "startDate":      "2025-09-01",
  "endDate":        "2026-01-31",
  "isCurrent":      true
}
```

| Field | Type | Constraints |
|---|---|---|
| `academicYearId` | `string` | UUID |
| `name` | `string` | 2–64 characters |
| `startDate` | `string` | ISO date; must be within parent academic year |
| `endDate` | `string` | ISO date; after `startDate` |
| `isCurrent` | `boolean?` | Only one semester per school can be current at a time |

**Response `data`:** `ApiSemester`

### 5.3 `PATCH /schools/:schoolId/semesters/:semesterId`

🔒 👥 🛡 `owner, admin`

Same fields, all optional. **Response `data`:** `ApiSemester`

---

## 6. Self-Service Password Change

### Why needed
`ProfileSettingsPage` has a full 3-step "Change password" UI (current → new → confirm) that is currently a no-op. The admin password-reset endpoint (`POST /schools/:schoolId/users/:userId/password-reset`) doesn't apply here — users changing their own password need a different flow.

### `POST /auth/change-password`

🔒 — requires valid `Authorization` header

**Request:**
```json
{
  "currentPassword": "OldPass#1",
  "newPassword":     "NewPass#2"
}
```

| Field | Type | Constraints |
|---|---|---|
| `currentPassword` | `string` | Must match the user's stored password |
| `newPassword` | `string` | Min 8 characters |

**Response `data`:** `{ success: true }`

**Error cases:**
- `currentPassword` wrong → `error.code: 'VALIDATION'`, message: `"Current password is incorrect"`

---

## 7. Organization Update

### Why needed
`OrganizationProfilePage` and `OrgAdminPage` let owners rename/rebrand their organization, but there is no PATCH endpoint in the guide.

### `PATCH /organizations/:organizationId`

🔒 👥 (org-scoped) 🛡 `owner`

**Request:**
```json
{
  "name":    "New Org Name",
  "logoUrl": "https://cdn.example.com/logos/org.png"
}
```

| Field | Type | Constraints |
|---|---|---|
| `name` | `string?` | 2–200 characters |
| `code` | `string?` | 2–64 characters; globally unique |
| `logoUrl` | `string?` | Valid URL |

**Response `data`:** `ApiOrganization`

---

## 8. Student Attendance Summary (Aggregated)

### Why needed
`AttendancePage` (admin/lecturer view) currently shows per-session attendance records only. The "At Risk (<75%)" card and the per-student attendance rate table require an aggregated summary across all sessions.

### `GET /schools/:schoolId/students/:studentId/attendance/summary`

🔒 👥 🛡 `owner, admin, director, lecturer`

**Query params:**

| Param | Type | Description |
|---|---|---|
| `academicYearId` | `string?` | Filter by academic year |

**Response `data`:**
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

Alternatively, include summary fields on the existing `/students/:studentId/attendance` response via `?aggregate=true`.

---

## 9. Attendance Summary for All Students in a Session/School

### Why needed
`AttendancePage` overview table needs per-student attendance rates across all sessions — not just for one session.

### `GET /schools/:schoolId/attendance/summary`

🔒 👥 🛡 `owner, admin, director, lecturer`

**Query params:**

| Param | Type | Description |
|---|---|---|
| `academicYearId` | `string?` | Filter by academic year |
| `sessionId` | `string?` | Narrow to a specific session |

**Response `data`:**
```json
[
  {
    "studentId":     "uuid",
    "fullName":      "Kofi Atta",
    "matricNo":      "UG/CS/2023/001",
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

## 10. Reports — Enrollment & Attendance Trends

### Why needed
`ReportsPage` currently shows hardcoded chart data. The geo-compliance report endpoint exists (`GET /schools/:schoolId/reports/sessions/geo-compliance`), but enrollment and attendance trend data need dedicated endpoints.

### 10.1 `GET /schools/:schoolId/reports/enrollment`

🔒 👥 🛡 `owner, admin, director`

**Query params:**

| Param | Type | Default |
|---|---|---|
| `academicYearId` | `string?` | Current year |

**Response `data`:**
```json
{
  "totalStudents":    150,
  "approved":         130,
  "pending":           12,
  "rejected":           5,
  "waitlisted":         3,
  "byDepartment": [
    { "departmentId": "uuid", "name": "Computer Science", "count": 60 }
  ]
}
```

### 10.2 `GET /schools/:schoolId/reports/attendance`

🔒 👥 🛡 `owner, admin, director`

**Query params:**

| Param | Type | Default |
|---|---|---|
| `academicYearId` | `string?` | Current year |
| `period` | `'week' \| 'month'?` | `'week'` |

**Response `data`:**
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

## 11. Venue Management

### Why needed
The existing API guide documents venues but the frontend has no venue management UI yet. When the `SchoolSetupWizard` needs to assign a venue to a timetable slot, it requires:

- `GET /schools/:schoolId/venues` (already documented ✓)
- `POST /schools/:schoolId/venues` (already documented ✓)
- `PATCH /schools/:schoolId/venues/:venueId` (already documented ✓)
- `DELETE /schools/:schoolId/venues/:venueId` (already documented ✓)

**Frontend action needed:** Build a `VenuesPage` and wire to the existing service layer.

---

## 12. School Setup Wizard — Initial Structure Creation

### Why needed
`SchoolSetupWizard.tsx` currently uses `createDepartment` and `createProgram` from `mock-db`. It needs to call real endpoints to create the initial departments and programs immediately after school creation.

All required endpoints already exist:
- `POST /schools/:schoolId/departments` ✓
- `POST /schools/:schoolId/programs` (blocked — see §3 above)
- `POST /schools/:schoolId/academic-years` ✓

**Frontend action needed:** Replace `mock-db` calls in `SchoolSetupWizard` with the service layer once the Programs endpoint is available. Departments and Academic Years can be wired now.

---

## 13. Guardian — Linked Students

### Why needed
The `guardian` role can view linked students' timetable and attendance. There is no documented endpoint to fetch which students a guardian is linked to.

### `GET /schools/:schoolId/guardians/me/students`

🔒 👥 — must be authenticated as a guardian

**Response `data`:**
```json
[
  {
    "studentId": "uuid",
    "fullName":  "Kofi Atta",
    "matricNo":  "UG/CS/2023/001",
    "classId":   "uuid"
  }
]
```

---

## 14. Invitation Accept — Account Setup

### Why needed
`AcceptInvitation.tsx` calls `POST /invitations/accept/:token`. When a new user (no existing account) accepts, the backend must either:

a. Return a temporary token for the new user to set their password, OR  
b. Create the account with a generated temporary password and return tokens directly.

The API guide says the response is `{ success: true } or user object depending on whether account creation is needed`, which is ambiguous. Clarify:

**Option A (Recommended):** If the invited email has no account:
```json
{
  "requiresAccountSetup": true,
  "setupToken":           "otp_xyz..."
}
```

Then provide: `POST /invitations/setup-account`
```json
{
  "setupToken": "otp_xyz...",
  "password":   "NewPass#1",
  "fullName":   "Ama Boateng"
}
```
Returns `{ accessToken, refreshToken }`.

**Option B:** Auto-create the account and return tokens directly:
```json
{
  "accessToken":  "eyJ...",
  "refreshToken": "eyJ..."
}
```

Frontend `AcceptInvitation.tsx` currently handles both but needs the contract finalized.

---

## 15. Schools — Extended CRUD

### Current API state

| Operation | Endpoint | Status |
|---|---|---|
| Create | `POST /organizations/:orgId/schools` | ✅ Exists — fields: `name`, `code` |
| Read list | `GET /organizations/:orgId/schools` | ✅ Exists |
| Read single | `GET /organizations/:orgId/schools/:schoolId` | ✅ Exists |
| Update | `PATCH /organizations/:orgId/schools/:schoolId` | ⚠️ Partial — only `name` and `status` |
| Delete | `DELETE /organizations/:orgId/schools/:schoolId` | ❌ Missing |
| Filter / search | Query params on list endpoint | ❌ Missing |
| Extended settings | Extended PATCH fields | ❌ Missing |
| Logo management | Upload / remove logo | ❌ Missing |

---

### 15.1 `DELETE /organizations/:organizationId/schools/:schoolId`

🔒 👥 🛡 `owner`

**Why needed:** `SchoolSettingsPage` danger zone and the org admin panel need a way to remove a school.

**Response `data`:** `{ success: true }`

> **Recommendation:** Implement as a soft-delete — set `status: 'deleted'` and hide from lists — rather than a hard DELETE, to preserve historical attendance, session, and grade records. Alternatively, the existing `PATCH status: 'inactive'` already achieves deactivation; this endpoint handles permanent removal.

**Error cases:**
- School has active students or live sessions → `error.code: 'INVALIDSTATETRANSITION'`, message: `"School has active records and cannot be deleted"`

---

### 15.2 `PATCH /organizations/:organizationId/schools/:schoolId` — Extended Fields

🔒 👥 🛡 `owner, admin`

**Why needed:** The current PATCH only accepts `name` and `status`. `SchoolSettingsPage` has a General tab with address, contact details, and branding — none of which can be saved.

**Extended request body** (all fields optional, extend the existing DTO):

```json
{
  "name":          "School of Engineering",
  "status":        "active",
  "address":       "123 University Ave, Accra",
  "phone":         "+233 30 123 4567",
  "email":         "school@uni.edu.gh",
  "website":       "https://soe.uni.edu.gh",
  "logoUrl":       "https://cdn.example.com/logos/soe.png",
  "timezone":      "Africa/Accra",
  "sessionDurationMinutes": 60,
  "lateThresholdMinutes":   15,
  "requireGeoCheckin":      true,
  "allowLateCheckin":       true
}
```

| Field | Type | Constraints |
|---|---|---|
| `name` | `string?` | 2–200 characters |
| `status` | `'active' \| 'inactive'?` | |
| `address` | `string?` | Max 500 characters |
| `phone` | `string?` | Max 32 characters |
| `email` | `string?` | Valid email |
| `website` | `string?` | Valid URL |
| `logoUrl` | `string?` | Valid URL (see §15.3 for upload) |
| `timezone` | `string?` | IANA timezone string, e.g. `"Africa/Accra"` |
| `sessionDurationMinutes` | `number?` | Min 5, max 480 |
| `lateThresholdMinutes` | `number?` | Min 1 |
| `requireGeoCheckin` | `boolean?` | Enforce student geofence check-in |
| `allowLateCheckin` | `boolean?` | Accept attendance marks after session start |

**Response `data`:** Updated `ApiSchool` (extend the type to include all new fields).

**Extended `ApiSchool` type:**
```typescript
export interface ApiSchool {
  id:                      string;
  name:                    string;
  code:                    string;
  status:                  'active' | 'inactive';
  // Extended fields (all optional — omitted if not set)
  address?:                string | null;
  phone?:                  string | null;
  email?:                  string | null;
  website?:                string | null;
  logoUrl?:                string | null;
  timezone?:               string | null;
  sessionDurationMinutes?: number | null;
  lateThresholdMinutes?:   number | null;
  requireGeoCheckin?:      boolean;
  allowLateCheckin?:       boolean;
}
```

---

### 15.3 `POST /organizations/:organizationId/schools/:schoolId/logo`

🔒 👥 🛡 `owner, admin`

**Why needed:** `SchoolSettingsPage` has an "Upload Logo" button that is currently a no-op.

**Request:**
```json
{ "logoUrl": "https://cdn.example.com/logos/soe.png" }
```

| Field | Type | Constraints |
|---|---|---|
| `logoUrl` | `string` | Valid HTTPS URL pointing to the uploaded image |

**Response `data`:** Updated `ApiSchool` with `logoUrl` set.

> **Note:** The frontend is responsible for uploading the image file to your CDN/storage (e.g. S3, Cloudinary) and then calling this endpoint with the resulting URL. This endpoint stores the URL only.

---

### 15.4 `DELETE /organizations/:organizationId/schools/:schoolId/logo`

🔒 👥 🛡 `owner, admin`

Clears the school logo. **Response `data`:** Updated `ApiSchool` with `logoUrl: null`.

---

### 15.5 `GET /organizations/:organizationId/schools` — Filter & Search

🔒 👥

**Why needed:** `SchoolSelector.tsx` lists all schools but has no way to filter active schools or search by name.

**Extended query params:**

| Param | Type | Description |
|---|---|---|
| `status` | `'active' \| 'inactive'?` | Filter by school status |
| `q` | `string?` | Full-text search on school name or code |

**Example:** `GET /organizations/uuid/schools?status=active&q=engineering`

**Response `data`:** Array of matching `ApiSchool` objects (same shape as existing list endpoint).

---

### 15.6 `GET /schools/:schoolId` — Direct school lookup (no org context)

🔒

**Why needed:** Many school-scoped routes use `/schools/:schoolId` without the org prefix (e.g. venues, sessions, attendance). The frontend needs to fetch school details in contexts where `organizationId` is not in the URL path — for example, when displaying school info on the `SchoolWorkspaceLayout` sidebar.

**Response `data`:** `ApiSchool` (same shape as the org-scoped GET single).

> If this endpoint already exists and is undocumented, please confirm the exact path so the service layer can be updated.

---

## 16. Delete Organization

### Why needed
Owners need to be able to delete their organization.

### `DELETE /organizations/:organizationId`

🔒 👥 🛡 `owner`

**Response `data`:** `{ success: true }`

---

## 17. System Global Administration

### Why needed
Super-admins need a dedicated panel to oversee the entire platform, manage billing/status of organizations, and troubleshoot user accounts across all schools.

### 17.1 `GET /system/organizations`
🔒 🛡 `super-admin`
**Response:** List of all organizations with their school counts and owner details.

### 17.2 `PATCH /system/organizations/:orgId`
🔒 🛡 `super-admin`
**Request:**
```json
{
  "status": "suspended" 
}
```
**Purpose:** Temporarily disable an entire organization (e.g., for non-payment).

### 17.3 `GET /system/users`
🔒 🛡 `super-admin`
**Query Params:** `?q=email_or_name&orgId=uuid`
**Response:** Searchable list of every user on the platform.

### 17.4 `GET /system/stats`
🔒 🛡 `super-admin`
**Response:**
```json
{
  "totalUsers": 1500,
  "totalOrganizations": 45,
  "totalSchools": 120,
  "activeSessions": 12
}
```

---

## 18. User Context & Permissions

### 18.1 `GET /schools/:schoolId/my-permissions`
🔒 👥
**Why needed:** Used by the frontend whenever a user enters a school workspace to determine what sidebar modules to show.

**Response `data`:**
```json
["reports:export", "attendance:mark", "timetable:manage"]
```

---

## Priority Matrix

| § | Endpoint(s) | Blocks Feature | Priority |
|---|---|---|---|
| 6 | `POST /auth/change-password` | Profile Settings — change password | **Critical** |
| 15.2 | `PATCH /organizations/:orgId/schools/:schoolId` (extended fields) | School Settings — save general/academic/attendance config | **Critical** |
| 1 | `PATCH` + `DELETE /schools/:schoolId/departments/:id` | Departments — edit & delete | **High** |
| 2 | `PATCH` + `DELETE /schools/:schoolId/courses/:id` | Courses — edit & delete | **High** |
| 3 | Programs CRUD (`/schools/:schoolId/programs`) | Programs page + school setup wizard | **High** |
| 18 | `GET /schools/:schoolId/my-permissions` | Sidenav/UI Action masking | **High** |
| 4 | Classes CRUD (`/schools/:schoolId/classes`) | Course assignment & enrollment dropdowns | **High** |
| 14 | Invitation accept — account setup contract | Staff invitation onboarding | **High** |
| 15.1 | `DELETE /organizations/:orgId/schools/:schoolId` | School danger zone / deactivation | **High** |
| 15.5 | `GET /organizations/:orgId/schools?status&q` | School selector filtering & search | **Medium** |
| 15.3–4 | School logo upload/delete | School branding in settings | **Medium** |
| 9 | `GET /schools/:schoolId/attendance/summary` | Attendance overview table (all students) | **Medium** |
| 10 | Reports: enrollment + attendance trend endpoints | Reports page charts | **Medium** |
| 7 | `PATCH /organizations/:organizationId` | Organization profile / branding | **Medium** |
| 5 | Semesters CRUD (`/schools/:schoolId/semesters`) | Academic calendar configuration | **Medium** |
| 8 | `GET /schools/:schoolId/students/:id/attendance/summary` | Per-student at-risk indicator | **Medium** |
| 12 | School Setup Wizard wiring (programs endpoint) | First-time school structure creation | **Medium** |
| 15.6 | `GET /schools/:schoolId` (direct lookup, no org prefix) | School workspace layout sidebar | **Low** |
| 13 | `GET /schools/:schoolId/guardians/me/students` | Guardian dashboard | **Low** |
| 16 | `DELETE /organizations/:organizationId` | Owner account management | **Low** |
| 11 | Venue management UI (endpoints already exist) | Venue CRUD page build-out | **Low** |
