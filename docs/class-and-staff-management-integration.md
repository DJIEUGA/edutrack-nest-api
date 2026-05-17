# EduTrack — Class & Staff Management Integration Guide

> **Audience:** Frontend engineers  
> **Covers:** All changes shipped in the Class Management and Staff Management features (May 2026)  
> **Prerequisite:** Read the base integration guide first (`FRONTEND_API_INTEGRaTION_GUIDE.md`) for auth setup, error envelopes, and the multi-tenancy model.

---

## Table of Contents

1. [What Changed — Quick Overview](#1-what-changed--quick-overview)
2. [New Permissions to Be Aware Of](#2-new-permissions-to-be-aware-of)
3. [Class Management](#3-class-management)
   - 3.1 [Data Model](#31-data-model)
   - 3.2 [Class CRUD](#32-class-crud)
   - 3.3 [Capacity & Auto-Split](#33-capacity--auto-split)
   - 3.4 [Class Students & Roster](#34-class-students--roster)
   - 3.5 [Enrollment Requests](#35-enrollment-requests)
   - 3.6 [Student Transfers](#36-student-transfers)
   - 3.7 [Student Portal — My Class](#37-student-portal--my-class)
4. [Staff Management](#4-staff-management)
   - 4.1 [Management Hierarchy](#41-management-hierarchy)
   - 4.2 [Invitation Flow (End-to-End)](#42-invitation-flow-end-to-end)
   - 4.3 [Invitation Endpoints](#43-invitation-endpoints)
   - 4.4 [Staff Roster Endpoints](#44-staff-roster-endpoints)
   - 4.5 [Change Role (Atomic)](#45-change-role-atomic)
   - 4.6 [Remove Staff](#46-remove-staff)
   - 4.7 [Extra Permission Grant / Revoke](#47-extra-permission-grant--revoke)
5. [TypeScript Type Definitions](#5-typescript-type-definitions)
6. [UI Flows & Recipes](#6-ui-flows--recipes)
7. [Error Reference](#7-error-reference)

---

## 1. What Changed — Quick Overview

| Area | What's new |
|------|------------|
| Classes | `maxCapacity`, `parentClassId`, `isGroup`, `splitAt` fields on every class object |
| Classes | Auto-split fires when enrollment reaches `maxCapacity` |
| Classes | Formal enrollment request flow (`pending → approved / rejected`) |
| Classes | Full audit trail of student class transfers |
| Classes | Student portal endpoint — one call returns timetable, sessions, courses, classmates, attendance, grades |
| Staff invitations | Director and HoD can now send invitations (scoped by hierarchy) |
| Staff invitations | `GET /validate/:token` + `POST /complete/:token` replace the old accept flow |
| Staff invitations | `POST /:id/resend` refreshes an expired invitation |
| Staff invitations | Duplicate-email detection returns `userExists` flag instead of throwing |
| Staff roster | New `GET /schools/:id/staff` endpoint (staff-only list, filterable) |
| Staff roster | Atomic role-change (`PATCH /staff/:id/role`) |
| Staff roster | Hierarchy-enforced permission grant/revoke on staff |
| Roles | `assignRole` and `revokeRole` now enforce the management hierarchy at the service layer |

---

## 2. New Permissions to Be Aware Of

These are now seeded for every school. Use them for UI visibility gating.

| Code | Description | Roles with it by default |
|------|-------------|--------------------------|
| `manage:classes` | Create, update, delete, split classes | owner, admin, director, hod |
| `manage:enrollments` | Approve or reject enrollment requests | owner, admin, director |
| `view:classmates` | View other students in the same class | all roles |

Check the user's permissions array (returned in `GET /schools/:id/user-roles/:userId`) before rendering management UI.

---

## 3. Class Management

### 3.1 Data Model

```typescript
interface Class {
  id: string;
  schoolId: string;
  academicYearId: string;
  programId: string | null;
  specialtyId: string | null;
  name: string;               // e.g. "SWE1"
  level: number | null;
  maxCapacity: number | null; // null = no cap enforced
  parentClassId: string | null; // null = root class; set = sub-class
  isGroup: boolean;           // true = this class was split; students live in sub-classes
  splitAt: string | null;     // ISO timestamp of when the split occurred
  createdAt: string;
  updatedAt: string;
}
```

**Key rendering rule:** when `isGroup === true`, the class is a label only — do not show it as a class a student can enroll in. Render its children (filtered by `parentClassId === this.id`) instead.

---

### 3.2 Class CRUD

All class endpoints are under `schools/:schoolId/classes`.

#### List classes

```
GET /schools/:schoolId/classes?academicYearId=<uuid>
```

No role restriction — any school member can list classes. Pass `academicYearId` to narrow results.

**Response** — array of `Class` objects (see shape above).

**Rendering hierarchy:** after fetching, separate root classes (`parentClassId === null && !isGroup`) from groups and sub-classes for display.

```typescript
const roots    = classes.filter(c => !c.parentClassId && !c.isGroup);
const groups   = classes.filter(c => c.isGroup);
const subClasses = classes.filter(c => c.parentClassId !== null);
```

---

#### Get single class

```
GET /schools/:schoolId/classes/:classId
```

---

#### Create class

```
POST /schools/:schoolId/classes
Authorization: Bearer <token>  — roles: owner | admin | director | hod
```

```json
{
  "academicYearId": "uuid",
  "name": "SWE1",
  "programId": "uuid",        // optional
  "specialtyId": "uuid",      // optional
  "level": 1,                 // optional
  "maxCapacity": 30           // optional — enables auto-split when reached
}
```

---

#### Update class

```
PATCH /schools/:schoolId/classes/:classId
Authorization: Bearer <token>  — roles: owner | admin | director | hod
```

All fields optional. You may update `maxCapacity` here or via the dedicated capacity endpoint.

---

#### Delete class

```
DELETE /schools/:schoolId/classes/:classId
Authorization: Bearer <token>  — roles: owner | admin | director | hod
```

Returns `{ "success": true }`. **Cannot delete a group class that still has sub-classes** — error `CONFLICT` is returned.

---

### 3.3 Capacity & Auto-Split

#### Get current capacity status

```
GET /schools/:schoolId/classes/:classId/capacity
Authorization: Bearer <token>  — roles: owner | admin | director | hod
```

```json
{
  "maxCapacity": 30,
  "currentCount": 28,
  "atCapacity": false
}
```

Show a warning badge in the UI when `currentCount / maxCapacity >= 0.9`.

---

#### Set / update capacity

```
PATCH /schools/:schoolId/classes/:classId/capacity
Authorization: Bearer <token>  — roles: owner | admin | director | hod
```

```json
{ "maxCapacity": 30 }
```

---

#### Manual split

```
POST /schools/:schoolId/classes/:classId/split
Authorization: Bearer <token>  — roles: owner | admin | director
```

No body required.

**Response:**

```json
{
  "classA": { ...Class },
  "classB": { ...Class },
  "movedToA": 15,
  "movedToB": 15
}
```

**Auto-split** fires automatically when an enrollment is approved and the resulting count reaches `maxCapacity`. The approval response includes `splitTriggered: true` in that case — your UI should refresh the class list when you see this flag.

**What happens on split (for UI rendering):**

| | Before split | After split |
|-|-------------|-------------|
| Original class (SWE1) | normal, students enrolled | `isGroup = true`, 0 students |
| SWE1A | doesn't exist | has all students from first half + all existing courses, timetable, sessions |
| SWE1B | doesn't exist | has all students from second half + **no courses** (admin must assign manually) |

Show a prompt to admins: "SWE1B has no courses yet. Go to course assignments to set them up."

---

### 3.4 Class Students & Roster

```
GET /schools/:schoolId/classes/:classId/students
Authorization: Bearer <token>  — roles: owner | admin | director | hod | lecturer
```

**Response** — array of:

```json
{
  "id": "student-uuid",
  "matricNo": "STU/2024/001",
  "status": "approved",
  "user": {
    "id": "user-uuid",
    "fullName": "Alice Nguyen",
    "email": "alice@example.com",
    "avatarUrl": null
  }
}
```

---

### 3.5 Enrollment Requests

The enrollment request flow replaces direct class assignment. A student (or admin on their behalf) submits a request; an admin approves or rejects.

#### Submit a request

```
POST /schools/:schoolId/classes/:classId/enrollment-requests
Authorization: Bearer <token>  — roles: owner | admin | director | student
```

```json
{
  "studentId": "uuid",
  "notes": "Transferring from SWE2 due to credit mismatch" // optional
}
```

**Response — normal case:**

```json
{
  "request": { ...EnrollmentRequest },
  "warning": null
}
```

**Response — at-capacity warning:**

```json
{
  "request": { ...EnrollmentRequest },
  "warning": "Class is at capacity (30/30). An admin must override to approve."
}
```

> Show this warning string verbatim to the admin reviewing the request. The request is still created — approval just requires the override flag.

---

#### List enrollment requests

```
GET /schools/:schoolId/classes/:classId/enrollment-requests?status=pending
Authorization: Bearer <token>  — roles: owner | admin | director | hod
```

`status` can be `pending`, `approved`, or `rejected`. Omit to get all.

**Response** — array of `EnrollmentRequest`:

```json
{
  "id": "uuid",
  "schoolId": "uuid",
  "studentId": "uuid",
  "classId": "uuid",
  "status": "pending",
  "requestedBy": "user-uuid",
  "reviewedBy": null,
  "reviewedAt": null,
  "notes": null,
  "createdAt": "2026-05-17T10:00:00Z",
  "updatedAt": "2026-05-17T10:00:00Z"
}
```

---

#### Approve

```
PATCH /schools/:schoolId/classes/enrollment-requests/:requestId/approve
Authorization: Bearer <token>  — roles: owner | admin | director
```

```json
{
  "overrideCap": false  // set true to approve when class is at max capacity
}
```

**Response:**

```json
{
  "request": { ...EnrollmentRequest, "status": "approved" },
  "splitTriggered": false   // true = class was automatically split after this approval
}
```

**When `splitTriggered === true`**, immediately re-fetch the class list so the UI reflects the new sub-classes.

---

#### Reject

```
PATCH /schools/:schoolId/classes/enrollment-requests/:requestId/reject
Authorization: Bearer <token>  — roles: owner | admin | director
```

```json
{ "notes": "Student does not meet prerequisites" }  // optional
```

---

### 3.6 Student Transfers

A direct admin action to move a student between classes. Always logs an audit entry.

```
POST /schools/:schoolId/classes/:classId/students/:studentId/transfer
Authorization: Bearer <token>  — roles: owner | admin | director
```

`:classId` here is the **destination** class.

```json
{ "reason": "Administrative correction" }  // optional
```

Returns `{ "success": true }`.

**Cannot transfer into a group class** — backend returns `VALIDATION` error.

---

#### Transfer history

```
GET /schools/:schoolId/classes/:classId/students/:studentId/transfer-history
Authorization: Bearer <token>  — roles: owner | admin | director | hod
```

```json
[
  {
    "id": "uuid",
    "studentId": "uuid",
    "fromClassId": "uuid",
    "toClassId": "uuid",
    "reason": "Class auto-split (first half)",
    "transferredBy": "user-uuid",
    "transferredAt": "2026-05-17T09:15:00Z"
  }
]
```

---

### 3.7 Student Portal — My Class

This is the single call that powers everything a student sees about their class.

```
GET /schools/:schoolId/classes/my-class
Authorization: Bearer <token>  — role: student only
```

**Response shape:**

```json
{
  "class": { ...Class },
  "classmates": [
    { "id": "student-uuid", "matricNo": "STU/001", "fullName": "Bob Doe", "avatarUrl": null }
  ],
  "timetable": [
    {
      "id": "uuid",
      "dayOfWeek": 1,
      "startTime": "08:00",
      "endTime": "10:00",
      "venue": "Lab 3",
      "courseCode": "CS301",
      "courseTitle": "Algorithms",
      "lecturerName": "Dr. Smith"
    }
  ],
  "activeSessions": [
    {
      "id": "uuid",
      "scheduledDate": "2026-05-20",
      "status": "scheduled",
      "actualStart": null,
      "courseCode": "CS301",
      "courseTitle": "Algorithms"
    }
  ],
  "courses": [
    {
      "id": "uuid",
      "code": "CS301",
      "title": "Algorithms",
      "unitLoad": 3,
      "lecturerId": "user-uuid",
      "lecturerName": "Dr. Smith",
      "lecturerAvatarUrl": null
    }
  ],
  "myAttendance": [
    {
      "sessionId": "uuid",
      "status": "present",
      "markedAt": "2026-05-15T09:05:00Z",
      "courseCode": "CS301",
      "courseTitle": "Algorithms"
    }
  ],
  "myGrades": [
    {
      "courseCode": "CS301",
      "courseTitle": "Algorithms",
      "grade": "A",
      "score": 85
    }
  ]
}
```

Returns **`null`** (with HTTP 404 wrapped in the error envelope) when the student has no class assigned yet. Show an empty state with a message like "You haven't been assigned to a class yet."

`dayOfWeek` values: `1 = Monday … 7 = Sunday`.

---

## 4. Staff Management

### 4.1 Management Hierarchy

The backend enforces this at the service layer. Your UI should mirror it to avoid showing actions that will be rejected.

| Logged-in role | Can invite / manage |
|----------------|---------------------|
| owner | admin, director, hod, lecturer |
| admin | director, hod, lecturer, student |
| director | hod, lecturer |
| hod | lecturer, student |
| lecturer | — |

Use this table to decide which "Invite Staff" roles to show in the dropdown and which staff members to show management buttons for.

---

### 4.2 Invitation Flow (End-to-End)

```
[Admin/HoD]
    │
    ├─ POST /schools/:id/invitations  ──→  { invitation } or { userExists: true, userId }
    │                                           │
    │                          userExists?  ────┤
    │                              YES          └──→  Skip invitation, call POST /user-roles directly
    │                              NO               to add the role to the existing user.
    │
    │   (backend stores token, sends email — email dispatch is your responsibility)
    │
[Invitee receives email with link: /register?token=<token>]
    │
    ├─ GET  /invitations/validate/:token  ──→  pre-fill email, role, school name
    │
    ├─ User fills in fullName + password
    │
    ├─ POST /invitations/complete/:token  ──→  { userId, email, fullName, role, schoolId }
    │
    └─ Redirect to /login  (call POST /auth/login with the credentials they just set)
```

**Token expiry:** 72 hours. After expiry, anyone with the right role can call `POST /:id/resend` to issue a fresh token.

---

### 4.3 Invitation Endpoints

#### List invitations

```
GET /schools/:schoolId/invitations
Authorization: Bearer <token>  — roles: owner | admin | director | hod
```

All management roles see all invitations for the school (not filtered to what they sent).

**Response** — array of:

```json
{
  "id": "uuid",
  "email": "lecturer@example.com",
  "role": "lecturer",
  "departmentId": "uuid",
  "departmentIds": ["uuid"],
  "status": "pending",
  "expiresAt": "2026-05-20T10:00:00Z",
  "acceptedAt": null,
  "createdAt": "2026-05-17T10:00:00Z",
  "invitedBy": {
    "id": "user-uuid",
    "fullName": "Dr. Admin",
    "email": "admin@school.edu"
  }
}
```

`status` values: `pending` | `processing` | `accepted` | `expired` | `cancelled`

---

#### Send invitation

```
POST /schools/:schoolId/invitations
Authorization: Bearer <token>  — roles: owner | admin | director | hod
```

```json
{
  "email": "lecturer@example.com",
  "role": "lecturer",
  "departmentId": "uuid",      // recommended for hod and lecturer roles
  "departmentIds": ["uuid"]    // HoD multi-department use-case; defaults to [departmentId]
}
```

**Response — success (new user):**

```json
{ "invitation": { ...Invitation } }
```

**Response — email already has an account:**

```json
{
  "userExists": true,
  "userId": "existing-user-uuid",
  "alreadyMember": false
}
```

When `userExists === true`:

- If `alreadyMember === false`: call `POST /schools/:id/user-roles` to add the role directly.
- If `alreadyMember === true`: call `POST /schools/:id/user-roles` — the role will be added without creating a new membership (the backend is idempotent).

Show a modal: *"This email already has an EduTrack account. Would you like to add the [role] role to them directly?"*

---

#### Resend invitation

```
POST /schools/:schoolId/invitations/:id/resend
Authorization: Bearer <token>  — roles: owner | admin | director | hod
```

No body. Returns the updated invitation with a fresh token and extended expiry.

---

#### Cancel invitation

```
DELETE /schools/:schoolId/invitations/:id
Authorization: Bearer <token>  — roles: owner | admin | director | hod
```

Only works on `pending` invitations.

---

#### Validate token (public — registration page)

```
GET /invitations/validate/:token
```

No auth required. Call this on page load when the invitee lands on `/register?token=xxx`.

**Success:**

```json
{
  "email": "lecturer@example.com",
  "role": "lecturer",
  "schoolId": "uuid",
  "schoolName": "Greenfield University",
  "departmentId": "uuid",
  "departmentIds": ["uuid"],
  "expiresAt": "2026-05-20T10:00:00Z",
  "inviterName": "Dr. Admin"
}
```

**Error cases to handle:**

| Backend code | Meaning | UI action |
|---|---|---|
| `NOTFOUND` | Token doesn't exist | Show "Invalid invitation link" |
| `400` + message `already 'accepted'` | Already used | Show "This invitation has already been accepted. Please log in." |
| `400` + message `expired` | Token expired | Show "Your invitation has expired. Contact your administrator." |

---

#### Complete registration (public — registration form submit)

```
POST /invitations/complete/:token
Content-Type: application/json
```

```json
{
  "fullName": "Alice Nguyen",
  "password": "Str0ngP@ss!"   // minimum 8 characters
}
```

**Success:**

```json
{
  "userId": "uuid",
  "email": "lecturer@example.com",
  "fullName": "Alice Nguyen",
  "role": "lecturer",
  "schoolId": "uuid"
}
```

After success, redirect the user to the login page. Do **not** auto-log them in from this endpoint — it does not return tokens by design. Use `POST /auth/login` with the credentials they just set.

---

### 4.4 Staff Roster Endpoints

#### List staff

```
GET /schools/:schoolId/staff?role=lecturer&departmentId=uuid&q=alice
Authorization: Bearer <token>  — roles: owner | admin | director | hod | lecturer
```

All query params are optional.

**Response** — array of:

```json
{
  "id": "user-uuid",
  "email": "alice@school.edu",
  "isActive": true,
  "fullName": "Alice Nguyen",
  "avatarUrl": null,
  "phone": null,
  "joinedAt": "2026-03-01T09:00:00Z",
  "roles": [
    {
      "role": "lecturer",
      "departmentId": "uuid",
      "departmentName": "Computer Science"
    }
  ]
}
```

---

#### Get staff profile

```
GET /schools/:schoolId/staff/:userId
Authorization: Bearer <token>  — roles: owner | admin | director | hod | lecturer
```

Extends the list item with:

```json
{
  "courseAssignments": [
    {
      "id": "uuid",
      "courseCode": "CS301",
      "courseTitle": "Algorithms",
      "className": "SWE3A",
      "academicYear": "2025/2026"
    }
  ],
  "invitationHistory": [
    {
      "id": "uuid",
      "role": "lecturer",
      "status": "accepted",
      "createdAt": "2026-01-10T00:00:00Z",
      "acceptedAt": "2026-01-11T14:22:00Z"
    }
  ]
}
```

---

### 4.5 Change Role (Atomic)

Atomically removes one role and assigns another, optionally with a new department.

```
PATCH /schools/:schoolId/staff/:userId/role
Authorization: Bearer <token>  — roles: owner | admin | director | hod
```

```json
{
  "fromRole": "lecturer",
  "toRole": "hod",
  "departmentId": "uuid"   // required when toRole is hod; recommended for lecturer
}
```

Returns `{ "success": true }`.

**Error cases:**

| Backend code | Meaning |
|---|---|
| `FORBIDDEN` | Actor cannot manage `fromRole` or `toRole` per hierarchy |
| `NOTFOUND` | Target does not hold `fromRole` |
| `CONFLICT` | Target already holds `toRole` |

---

### 4.6 Remove Staff

```
DELETE /schools/:schoolId/staff/:userId
Authorization: Bearer <token>  — roles: owner | admin | director | hod
```

Returns `{ "success": true }`.

**What is removed:** school membership + all role assignments for this school.  
**What is preserved:** course assignments (timetable, sessions, attendance records remain intact for historical accuracy).

Show a confirmation dialog: *"Removing [Name] will revoke their access to this school. Their course history will be preserved. This action cannot be undone."*

---

### 4.7 Extra Permission Grant / Revoke

These endpoints let a management actor grant or revoke a fine-grained permission on top of a staff member's base role. The actor must outrank the target per the hierarchy.

#### Grant

```
POST /schools/:schoolId/staff/:userId/permissions
Authorization: Bearer <token>  — roles: owner | admin | director | hod
```

```json
{ "permissionCode": "manage:courses" }
```

#### Revoke

```
DELETE /schools/:schoolId/staff/:userId/permissions/:permissionCode
Authorization: Bearer <token>  — roles: owner | admin | director | hod
```

Returns `{ "success": true }`.

Available permission codes are listed via `GET /schools/:id/user-roles/permissions/catalog`.

---

## 5. TypeScript Type Definitions

```typescript
// ── Classes ──────────────────────────────────────────────────────────────────

export interface Class {
  id: string;
  schoolId: string;
  academicYearId: string;
  programId: string | null;
  specialtyId: string | null;
  name: string;
  level: number | null;
  maxCapacity: number | null;
  parentClassId: string | null;
  isGroup: boolean;
  splitAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClassCapacity {
  maxCapacity: number | null;
  currentCount: number;
  atCapacity: boolean;
}

export interface SplitResult {
  classA: Class;
  classB: Class;
  movedToA: number;
  movedToB: number;
}

export type EnrollmentRequestStatus = 'pending' | 'approved' | 'rejected';

export interface EnrollmentRequest {
  id: string;
  schoolId: string;
  studentId: string;
  classId: string;
  status: EnrollmentRequestStatus;
  requestedBy: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClassTransferLog {
  id: string;
  studentId: string;
  fromClassId: string | null;
  toClassId: string | null;
  reason: string | null;
  transferredBy: string;
  transferredAt: string;
}

export interface MyClassOverview {
  class: Class;
  classmates: Array<{
    id: string;
    matricNo: string | null;
    fullName: string;
    avatarUrl: string | null;
  }>;
  timetable: Array<{
    id: string;
    dayOfWeek: number;      // 1 = Monday … 7 = Sunday
    startTime: string;      // "HH:MM"
    endTime: string;
    venue: string | null;
    courseCode: string;
    courseTitle: string;
    lecturerName: string;
  }>;
  activeSessions: Array<{
    id: string;
    scheduledDate: string;  // "YYYY-MM-DD"
    status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
    actualStart: string | null;
    courseCode: string;
    courseTitle: string;
  }>;
  courses: Array<{
    id: string;
    code: string;
    title: string;
    unitLoad: number;
    lecturerId: string;
    lecturerName: string;
    lecturerAvatarUrl: string | null;
  }>;
  myAttendance: Array<{
    sessionId: string;
    status: 'present' | 'absent' | 'late' | 'excused';
    markedAt: string;
    courseCode: string;
    courseTitle: string;
  }>;
  myGrades: Array<{
    courseCode: string;
    courseTitle: string;
    grade: string | null;
    score: number | null;
  }>;
}

// ── Staff & Invitations ───────────────────────────────────────────────────────

export type UserRole = 'owner' | 'admin' | 'director' | 'hod' | 'lecturer' | 'student' | 'guardian' | 'follower';
export type StaffRole = 'admin' | 'director' | 'hod' | 'lecturer';
export type InvitationStatus = 'pending' | 'processing' | 'accepted' | 'expired' | 'cancelled';

export interface StaffRoleAssignment {
  role: UserRole;
  departmentId: string | null;
  departmentName: string | null;
}

export interface StaffMember {
  id: string;
  email: string;
  isActive: boolean;
  fullName: string;
  avatarUrl: string | null;
  phone: string | null;
  joinedAt: string;
  roles: StaffRoleAssignment[];
}

export interface StaffProfile extends StaffMember {
  courseAssignments: Array<{
    id: string;
    courseCode: string;
    courseTitle: string;
    className: string;
    academicYear: string;
  }>;
  invitationHistory: Array<{
    id: string;
    role: UserRole;
    status: InvitationStatus;
    createdAt: string;
    acceptedAt: string | null;
  }>;
}

export interface StaffInvitation {
  id: string;
  email: string;
  role: UserRole;
  departmentId: string | null;
  departmentIds: string[];
  status: InvitationStatus;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  invitedBy: {
    id: string;
    fullName: string;
    email: string;
  };
}

export interface InvitationValidation {
  email: string;
  role: UserRole;
  schoolId: string;
  schoolName: string;
  departmentId: string | null;
  departmentIds: string[];
  expiresAt: string;
  inviterName: string;
}

export type CreateInvitationResult =
  | { invitation: StaffInvitation }
  | { userExists: true; userId: string; alreadyMember: boolean };

export interface RegistrationResult {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  schoolId: string;
}
```

---

## 6. UI Flows & Recipes

### Recipe 1 — Render the class list with hierarchy

```typescript
function buildClassTree(classes: Class[]) {
  const roots   = classes.filter(c => !c.parentClassId);
  const byParent = new Map<string, Class[]>();

  for (const c of classes) {
    if (c.parentClassId) {
      const children = byParent.get(c.parentClassId) ?? [];
      children.push(c);
      byParent.set(c.parentClassId, children);
    }
  }

  return roots.map(root => ({
    ...root,
    children: byParent.get(root.id) ?? [],
  }));
}
```

Group classes (`isGroup === true`) should render as expandable parents. Sub-classes render as indented children. Root classes with no children render normally.

---

### Recipe 2 — Capacity indicator component

```typescript
function capacityLabel(cap: ClassCapacity): string {
  if (!cap.maxCapacity) return 'No cap';
  const pct = (cap.currentCount / cap.maxCapacity) * 100;
  if (pct >= 100) return `Full (${cap.currentCount}/${cap.maxCapacity})`;
  if (pct >= 90)  return `Nearly full (${cap.currentCount}/${cap.maxCapacity})`;
  return `${cap.currentCount}/${cap.maxCapacity}`;
}

// Colour: pct >= 100 → red, pct >= 90 → amber, else → green
```

---

### Recipe 3 — Invitation send with userExists handling

```typescript
async function sendInvitation(schoolId: string, payload: CreateInvitationDto) {
  const result: CreateInvitationResult = await api.post(
    `/schools/${schoolId}/invitations`,
    payload,
  );

  if ('userExists' in result) {
    // Ask admin to confirm direct role assignment
    const confirmed = await showConfirmDialog({
      title: 'User already exists',
      body: result.alreadyMember
        ? `This email is already a member of your school. Add the ${payload.role} role to them?`
        : `This email has an EduTrack account. Add the ${payload.role} role and grant school access?`,
    });
    if (confirmed) {
      await api.post(`/schools/${schoolId}/user-roles`, {
        userId: result.userId,
        role: payload.role,
        departmentId: payload.departmentId,
      });
    }
  } else {
    // Normal case — invitation created, trigger email send
    await dispatchInvitationEmail(result.invitation);
  }
}
```

---

### Recipe 4 — Approve enrollment with auto-split detection

```typescript
async function approveEnrollment(
  schoolId: string,
  requestId: string,
  overrideCap = false,
) {
  const { request, splitTriggered } = await api.patch(
    `/schools/${schoolId}/classes/enrollment-requests/${requestId}/approve`,
    { overrideCap },
  );

  if (splitTriggered) {
    toast.success('Enrollment approved. The class has been automatically split.');
    // Force a full class list refresh so sub-classes appear in the sidebar
    await refreshClassList(schoolId);
  } else {
    toast.success('Enrollment approved.');
  }

  return request;
}
```

---

### Recipe 5 — Registration page (invitee flow)

```typescript
// Page: /register?token=<token>
async function loadRegistrationPage(token: string) {
  try {
    const data: InvitationValidation = await api.get(`/invitations/validate/${token}`);
    // Pre-fill: data.email (read-only), data.role, data.schoolName, data.inviterName
    return data;
  } catch (err) {
    if (err.code === 'NOTFOUND') redirect('/invalid-invite');
    if (err.status === 400 && err.message.includes('accepted')) redirect('/login?hint=already-registered');
    if (err.status === 400 && err.message.includes('expired')) showExpiredInviteMessage();
  }
}

async function submitRegistration(token: string, fullName: string, password: string) {
  const result: RegistrationResult = await api.post(
    `/invitations/complete/${token}`,
    { fullName, password },
  );
  // Do NOT try to auto-login here — the complete endpoint does not return tokens.
  // Redirect to login and optionally pre-fill the email field.
  redirect(`/login?email=${encodeURIComponent(result.email)}&hint=registration-complete`);
}
```

---

### Recipe 6 — Who-can-manage guard for UI buttons

```typescript
const MANAGEMENT_HIERARCHY: Record<string, string[]> = {
  owner:    ['admin', 'director', 'hod', 'lecturer'],
  admin:    ['director', 'hod', 'lecturer', 'student'],
  director: ['hod', 'lecturer'],
  hod:      ['lecturer', 'student'],
  lecturer: [],
};

function canManageRole(myRoles: string[], targetRole: string): boolean {
  return myRoles.some(r => MANAGEMENT_HIERARCHY[r]?.includes(targetRole));
}

// Usage:
// <EditRoleButton v-if="canManageRole(currentUser.roles, staffMember.role)" />
```

---

## 7. Error Reference

The following domain error codes are specific to the new features.

| HTTP | Code | Meaning | Common cause |
|------|------|---------|--------------|
| 404 | `NOTFOUND` | Class / enrollment request / invitation / staff not found | Wrong ID or wrong school scope |
| 409 | `CONFLICT` | Duplicate name, already split, already holds role | Creating a class name that exists; approving a request already reviewed |
| 403 | `FORBIDDEN` | Hierarchy violation | HoD trying to invite a director; actor trying to remove a peer |
| 400 | `VALIDATION` | Invalid operation | Enrolling into a group class; transfer into a group class |
| 400 | (HTTP) | Invitation state error | Resending an accepted invitation; cancelling an already-cancelled one |

The full error envelope always looks like:

```json
{
  "success": false,
  "statusCode": 409,
  "message": "Class has already been split",
  "error": {
    "code": "CONFLICT",
    "details": { "classId": "uuid" }
  }
}
```

Read `error.code` for programmatic handling. Read `message` for a human-readable fallback you can show in a toast.
