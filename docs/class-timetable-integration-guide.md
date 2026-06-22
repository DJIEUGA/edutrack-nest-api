# Class Timetable & Schedule Config — Frontend Integration Guide

> **Audience:** Frontend engineers.
> **Base URL:** `/api/v1` (all paths below are relative to it).
> **Last updated:** 2026-06-22
> **Depends on:** `timetable-promotion-integration-guide.md` (session status model).

---

## Overview

This guide covers three related feature areas shipped together:

| Area | What changed |
|---|---|
| **Schedule config** | New. Owners/admins configure which weekdays and which time blocks (e.g., 08:00–10:00) are active for the school. Time blocks are enforced on slot creation. |
| **Class shared timetable** | New. A per-class grid endpoint showing every configured day × time block, whether occupied or free, with lecturer and delegate contact info. Lecturers, HODs, admins, and enrolled students can read it; lecturers and HODs can write to it. |
| **Enriched overall timetable** | Modified. `GET /schools/{schoolId}/timetable` now returns class name and full contact info (lecturer + class delegate) on every slot. |
| **Ownership enforcement** | Breaking. Lecturers can no longer create/edit/delete slots for course assignments they don't own. All create/update calls are now rejected unless `startTime`/`endTime` match a configured school time block. |

---

## Roles & Capabilities

| Role | Schedule config | Read class timetable | Write class timetable |
|---|---|---|---|
| `owner` | Read + Write | ✅ All classes | ✅ All classes |
| `admin` | Read + Write | ✅ All classes | ✅ All classes |
| `hod` | Read only | ✅ Classes in own department | ✅ Classes in own department |
| `lecturer` | Read only | ✅ Classes they're assigned to | ✅ Own course assignments only |
| `student` | Read only | ✅ Own enrolled class | ❌ |
| `guardian` | — | ❌ | ❌ |

---

## Part 1 — Schedule Config

Before any timetable slot can be created, the school must have at least one time block configured. The frontend should surface this configuration in an admin/settings screen.

---

### 1. Get Schedule Config

Returns the school's active weekdays and time blocks in one call. Safe to call for all roles.

```
GET /schools/{schoolId}/schedule-config
```

**Roles:** all school members

**Response `200 OK`**

```jsonc
{
  "days": [1, 2, 3, 4, 5],        // 0=Sun 1=Mon … 6=Sat. Empty [] if not configured.
  "timeBlocks": [
    {
      "id":        "uuid",
      "schoolId":  "uuid",
      "label":     "Morning 1",    // nullable — display hint only
      "startTime": "08:00",
      "endTime":   "10:00"
    },
    {
      "id":        "uuid",
      "schoolId":  "uuid",
      "label":     "Morning 2",
      "startTime": "10:00",
      "endTime":   "12:00"
    }
  ]
}
```

> `timeBlocks` are ordered by `startTime` ascending. Cast `startTime`/`endTime` as `HH:MM` strings — they will never include seconds.

---

### 2. Add a Time Block

```
POST /schools/{schoolId}/schedule-config/time-blocks
```

**Roles:** `owner`, `admin`

**Request body**

```jsonc
{
  "startTime": "08:00",    // HH:MM, required
  "endTime":   "10:00",    // HH:MM, required — must be after startTime
  "label":     "Morning 1" // optional display name
}
```

**Response `200 OK`** — the created time block object (same shape as entries in `GET` response).

**Error cases**

| HTTP | Code | Reason |
|---|---|---|
| 422 | `VALIDATION` | `startTime` ≥ `endTime` |
| 409 | `CONFLICT` | A block with the same `startTime`/`endTime` already exists for this school |

---

### 3. Delete a Time Block

```
DELETE /schools/{schoolId}/schedule-config/time-blocks/{blockId}
```

**Roles:** `owner`, `admin`

**Response `200 OK`**

```jsonc
{ "success": true }
```

**Error cases**

| HTTP | Code | Reason |
|---|---|---|
| 404 | `NOTFOUND` | Block not found or belongs to a different school |

> **Warning:** Deleting a time block does not delete existing timetable slots that use those times. It only prevents *new* slots from being created at those times. Show a confirmation prompt before deletion.

---

### 4. Set Active Weekdays

Replaces the school's active weekdays entirely. Send the full desired set each time.

```
PUT /schools/{schoolId}/schedule-config/days
```

**Roles:** `owner`, `admin`

**Request body**

```jsonc
{
  "days": [1, 2, 3, 4, 5]   // array of integers 0–6; duplicates are ignored
}
```

**Response `200 OK`**

```jsonc
{ "days": [1, 2, 3, 4, 5] }   // deduplicated and sorted
```

> To disable all days (e.g., during a break), send `{ "days": [] }`.

---

## Part 2 — Class Shared Timetable

The shared timetable is a **grid**: every configured school day (column) crossed with every configured time block (row). Each cell is either `"occupied"` (a timetable slot exists) or `"free"`.

Access is **class-scoped** — the endpoint verifies the caller belongs to the class before returning any data.

---

### 5. Get Shared Timetable for a Class

```
GET /schools/{schoolId}/classes/{classId}/timetable
```

**Roles:** `owner`, `admin`, `hod` (own dept), `lecturer` (assigned to class), `student` (enrolled in class)

**Query parameters**

| Name | Type | Description |
|---|---|---|
| `academicYearId` | UUID | Optional. Filters slots by academic year. Omit to get all active-year slots. |

**Response `200 OK`**

```jsonc
{
  "class": {
    "id":   "uuid",
    "name": "L3-Informatique",
    "delegate": {
      "name":  "Alice Nguetsop",          // null when no delegate assigned yet
      "email": "alice@school.edu",
      "phone": "+237600000000"
    }
  },
  "config": {
    "days": [1, 2, 3, 4, 5],             // active weekdays for this school
    "timeBlocks": [
      { "id": "uuid", "label": "Morning 1", "startTime": "08:00", "endTime": "10:00" },
      { "id": "uuid", "label": "Morning 2", "startTime": "10:00", "endTime": "12:00" },
      { "id": "uuid", "label": "Afternoon", "startTime": "14:00", "endTime": "16:00" }
    ]
  },
  "grid": [
    {
      "dayOfWeek": 1,     // Monday
      "blocks": [
        {
          "startTime": "08:00",
          "endTime":   "10:00",
          "status":    "occupied",
          "slot": {
            "id":                "uuid",                    // timetableSlotId — use for PATCH/DELETE
            "courseAssignmentId": "uuid",
            "courseCode":        "CS301",
            "courseTitle":       "Algorithms & Data Structures",
            "venue":             "Amphi 200",               // null if unset
            "lecturer": {
              "userId": "uuid",
              "name":   "Dr. Jean Kamdem",
              "email":  "jean.kamdem@school.edu",
              "phone":  "+237699000000"
            }
          }
        },
        {
          "startTime": "10:00",
          "endTime":   "12:00",
          "status":    "free"
          // no "slot" key on free cells
        },
        {
          "startTime": "14:00",
          "endTime":   "16:00",
          "status":    "free"
        }
      ]
    },
    {
      "dayOfWeek": 2,   // Tuesday — all free in this example
      "blocks": [
        { "startTime": "08:00", "endTime": "10:00", "status": "free" },
        { "startTime": "10:00", "endTime": "12:00", "status": "free" },
        { "startTime": "14:00", "endTime": "16:00", "status": "free" }
      ]
    }
    // … one entry per active weekday
  ]
}
```

**Key rules for rendering:**
- `grid` has exactly one entry per day in `config.days`, in the same order.
- Each `blocks` array has exactly one entry per block in `config.timeBlocks`, in start-time order.
- `class.delegate` is `null` until an admin assigns a delegate (follow-up feature).
- A `"free"` block has no `slot` property — do not try to read `block.slot` without checking `block.status === "occupied"` first.

**Error cases**

| HTTP | Code | Reason |
|---|---|---|
| 403 | `FORBIDDEN` | Caller's role does not grant access to this class (e.g., lecturer not assigned, student not enrolled) |
| 404 | `NOTFOUND` | Class not found in this school |

---

### 6. Add a Slot to the Class Timetable

Programs a course into a specific time block on a specific day for this class.

```
POST /schools/{schoolId}/classes/{classId}/timetable
```

**Roles:** `owner`, `admin`, `hod` (own dept), `lecturer` (own course assignment only)

**Request body**

```jsonc
{
  "academicYearId":     "uuid",   // required — must be the active academic year
  "courseAssignmentId": "uuid",   // required — links course + class + lecturer
  "dayOfWeek":          1,        // required — must be in school's active days
  "startTime":          "08:00",  // required — must exactly match a school time block
  "endTime":            "10:00",  // required — must exactly match a school time block
  "venue":              "uuid"    // optional venue ID (must exist in /venues)
}
```

> **Important:** `startTime` and `endTime` must match an existing time block exactly (both values together). The backend rejects any combination that isn't in the school's `schedule-config`. Fetch `GET /schedule-config` first to populate a time-block picker.

**Response `200 OK`** — the created slot with basic fields and `nextSessionId`.

**Error cases**

| HTTP | Code | Reason |
|---|---|---|
| 403 | `FORBIDDEN` | Lecturer does not own the `courseAssignmentId`, or `courseAssignmentId` belongs to a different class |
| 404 | `NOTFOUND` | `courseAssignmentId` not found |
| 409 | `CONFLICT` | Venue is already booked for this day/time |
| 422 | `VALIDATION` | `startTime`/`endTime` does not match any configured time block |

---

### 7. Update a Slot

Change the day, time block, or venue of an existing slot. The session history for past dates is preserved; only future sessions are affected.

```
PATCH /schools/{schoolId}/classes/{classId}/timetable/{slotId}
```

**Roles:** `owner`, `admin`, `hod` (own dept), `lecturer` (own slot only)

**Request body** *(at least one field required)*

```jsonc
{
  "dayOfWeek":  2,         // optional — new day
  "startTime":  "10:00",   // optional — must match a time block if provided
  "endTime":    "12:00",   // optional — must match a time block if provided
  "venue":      "uuid"     // optional — null to clear
}
```

> If you send only `venue`, no time-block validation runs — venue-only updates are always accepted.

**Response `200 OK`** — updated slot fields.

**Error cases**

| HTTP | Code | Reason |
|---|---|---|
| 403 | `FORBIDDEN` | Lecturer does not own this slot, or slot does not belong to `classId` |
| 404 | `NOTFOUND` | Slot not found |
| 409 | `CONFLICT` | New venue/time conflicts with another slot |
| 422 | `VALIDATION` | New `startTime`/`endTime` does not match a configured time block |

---

### 8. Delete a Slot

Removes the timetable slot. All future `scheduled` sessions generated from this slot are deleted. Past sessions (completed/cancelled) have their `timetableSlotId` nullified but remain in history.

```
DELETE /schools/{schoolId}/classes/{classId}/timetable/{slotId}
```

**Roles:** `owner`, `admin`, `hod` (own dept), `lecturer` (own slot only)

**Response `200 OK`**

```jsonc
{ "success": true }
```

**Error cases**

| HTTP | Code | Reason |
|---|---|---|
| 403 | `FORBIDDEN` | Lecturer does not own this slot, or slot does not belong to `classId` |
| 404 | `NOTFOUND` | Slot not found |

---

## Part 3 — Enriched Overall Timetable (Lecturer View)

The existing `GET /timetable` endpoint is **backward compatible** but now returns additional fields on every slot. Update any UI that renders this list.

```
GET /schools/{schoolId}/timetable
```

**No change to roles, query params, or URL.**

**New fields on each slot object**

```jsonc
{
  // Existing fields (unchanged)
  "id":                 "uuid",
  "schoolId":           "uuid",
  "academicYearId":     "uuid",
  "courseAssignmentId": "uuid",
  "dayOfWeek":          1,
  "startTime":          "08:00",
  "endTime":            "10:00",
  "venue":              "Amphi 200",
  "nextSessionId":      "uuid",        // null if no upcoming session

  // NEW — course info
  "courseCode":         "CS301",
  "courseTitle":        "Algorithms & Data Structures",

  // NEW — class info
  "classId":            "uuid",
  "className":          "L3-Informatique",

  // NEW — lecturer contact (the lecturer assigned to this slot)
  "lecturerName":       "Dr. Jean Kamdem",
  "lecturerEmail":      "jean.kamdem@school.edu",
  "lecturerPhone":      "+237699000000",   // null if not set in profile

  // NEW — class delegate contact (null on all fields if no delegate assigned)
  "delegateName":       "Alice Nguetsop",
  "delegateEmail":      "alice@school.edu",
  "delegatePhone":      "+237600000000"
}
```

> `lecturerPhone` and `delegatePhone` come from the `profiles` table. They may be `null` if the user has not filled in their phone number.

---

## Part 4 — Breaking Changes

These changes affect existing frontend code.

### 4.1 Time-block enforcement on all timetable slot mutations

`POST /schools/{schoolId}/timetable`, `PATCH /schools/{schoolId}/timetable/{slotId}` now return **422** if `startTime`/`endTime` don't match a configured school time block, for **all roles** (not just lecturers).

**Migration:** Before showing the slot creation/edit form, always fetch `GET /schedule-config` and use the returned `timeBlocks` to populate a picker. Never let users type arbitrary times.

### 4.2 Lecturer ownership enforcement on school-level timetable mutations

`POST /schools/{schoolId}/timetable`, `PATCH /schools/{schoolId}/timetable/{slotId}`, `DELETE /schools/{schoolId}/timetable/{slotId}` now return **403** if a `lecturer` caller's `courseAssignmentId` is not assigned to them.

This was previously unenforced. Use the class-scoped endpoint (`/classes/{classId}/timetable`) for lecturer flows instead — it provides clearer scoping and returns the same 403 with an informative message.

---

## Rendering the Grid — Implementation Notes

```
┌──────────┬──────────────────┬──────────────────┬──────────────────┐
│          │    Monday        │    Tuesday       │   Wednesday      │
├──────────┼──────────────────┼──────────────────┼──────────────────┤
│ 08–10    │  CS301 / Dr.Jean │  (free)          │  (free)          │
│ Morning 1│  Amphi 200       │                  │                  │
├──────────┼──────────────────┼──────────────────┼──────────────────┤
│ 10–12    │  (free)          │  MATH202 / Dr.X  │  (free)          │
│ Morning 2│                  │  Room B          │                  │
├──────────┼──────────────────┼──────────────────┼──────────────────┤
│ 14–16    │  (free)          │  (free)          │  CS301 / Dr.Jean │
│ Afternoon│                  │                  │  Amphi 200       │
└──────────┴──────────────────┴──────────────────┴──────────────────┘
```

**Suggested approach:**
1. Fetch `GET /classes/{classId}/timetable` — one call returns everything (class, config, grid).
2. Use `config.days` as column headers (convert day number to label: Mon, Tue …).
3. Use `config.timeBlocks` as row headers (use `label` if non-null, else `"startTime–endTime"`).
4. For each `grid[dayIndex].blocks[blockIndex]`:
   - `status === "free"` → render an empty "+" cell (click to add a slot).
   - `status === "occupied"` → render `slot.courseCode`, `slot.lecturer.name`, `slot.venue`.
5. On cell click for an occupied cell, show a detail panel with:
   - Full course title, lecturer name + email + phone.
   - Class delegate name + email + phone (from `class.delegate`).
   - Edit/Delete buttons (hide if caller's role doesn't allow writes, or if lecturer and `slot.lecturer.userId !== currentUser.id`).

---

## dayOfWeek Reference

| Value | Day |
|---|---|
| 0 | Sunday |
| 1 | Monday |
| 2 | Tuesday |
| 3 | Wednesday |
| 4 | Thursday |
| 5 | Friday |
| 6 | Saturday |

---

## Error Response Shape

All errors follow the global format:

```jsonc
{
  "statusCode": 403,
  "code":       "FORBIDDEN",
  "message":    "You do not have access to this class timetable",
  "details":    {}
}
```

| Code | HTTP | When |
|---|---|---|
| `VALIDATION` | 422 | `startTime`/`endTime` doesn't match a time block; `startTime` ≥ `endTime` on block creation |
| `CONFLICT` | 409 | Duplicate time block; venue already booked |
| `NOTFOUND` | 404 | Class, slot, or time block not found |
| `FORBIDDEN` | 403 | Caller's role/assignment does not grant access to the resource |
| `UNAUTHORIZED` | 401 | Missing or expired JWT |

---

## Endpoint Summary

| Method | Path | Roles | Purpose |
|---|---|---|---|
| `GET` | `/schools/:id/schedule-config` | all members | Get active days + time blocks |
| `POST` | `/schools/:id/schedule-config/time-blocks` | owner, admin | Add a time block |
| `DELETE` | `/schools/:id/schedule-config/time-blocks/:blockId` | owner, admin | Remove a time block |
| `PUT` | `/schools/:id/schedule-config/days` | owner, admin | Replace active weekdays |
| `GET` | `/schools/:id/classes/:classId/timetable` | owner, admin, hod†, lecturer†, student† | Shared timetable grid |
| `POST` | `/schools/:id/classes/:classId/timetable` | owner, admin, hod†, lecturer† | Add slot to class |
| `PATCH` | `/schools/:id/classes/:classId/timetable/:slotId` | owner, admin, hod†, lecturer† | Update slot |
| `DELETE` | `/schools/:id/classes/:classId/timetable/:slotId` | owner, admin, hod†, lecturer† | Delete slot |
| `GET` | `/schools/:id/timetable` | all members | Lecturer's own enriched slot list |

† Subject to class-level access check (department / assignment / enrollment).
