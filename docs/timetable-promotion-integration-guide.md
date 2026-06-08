# Timetable Promotion — Frontend Integration Guide

## Overview

The **Timetable Promotion** feature gives lecturers a weekly confirmation gate before their schedule goes live. A HOD manually opens a promotion cycle for the school. Each lecturer then confirms, modifies, or cancels their individual slots. Any slot left unconfirmed by **Sunday noon (school local time)** is automatically deleted along with all its future sessions.

This guide covers every API endpoint, exact request/response shapes, role requirements, state machines, polling strategy, and error handling needed for a correct frontend implementation.

---

## Roles & Capabilities

| Role | Can do |
|---|---|
| `owner`, `admin`, `hod` | Trigger a cycle, monitor all slots, view HOD dashboard |
| `lecturer` | View own active cycle, confirm/modify/cancel own slots, read reminders |

All endpoints require a valid **JWT Bearer token** in the `Authorization` header.

---

## Weekly Timeline

```
Fri–Sun        Thu–Sat 08:00    Sun 12:00       Mon
(school time)  (school time)    (school time)
    │               │               │            │
    ▼               ▼               ▼            ▼
HOD triggers    System sends    Unconfirmed   Promoted
promotion       reminders       slots RESET   week begins
cycle           (daily)         automatically
```

- The HOD can trigger a cycle at any time, but the canonical window is **Friday–Sunday** before the promoted week.
- On trigger, a **catch-up reminder** is immediately sent to all affected lecturers regardless of the day.
- Scheduled reminder sends fire at **08:00 school time on Thursday, Friday, and Saturday**.
- The hard deadline is **Sunday 12:00 school time**. After that, pending slots are irreversibly deleted.

---

## State Machines

### PromotionCycle

```
HOD triggers POST /promotion-cycles
         │
         ▼
       ACTIVE  ─── all slots confirmed/modified ──► COMPLETED
         │
         └── Sunday noon, any slot still pending ──► EXPIRED
```

### SlotPromotion (per timetable slot)

```
Cycle created
      │
      ▼
   PENDING ──── POST .../confirm           ──► CONFIRMED
      │
      ├──────── PATCH .../slot             ──► MODIFIED   (slot-level: time/venue)
      │
      ├──────── PATCH .../sessions/:id/reschedule ──► CONFIRMED  (session-level)
      │
      ├──────── DELETE .../sessions/:id    ──► CONFIRMED  (session-level)
      │
      └──────── Sunday noon, no action     ──► RESET
```

> **Rule:** `CONFIRMED` and `MODIFIED` slots survive Sunday reset. Only `PENDING` slots are deleted.

### Session (for sessions in the promoted week)

```
SCHEDULED ──── HOD triggers cycle ──► PENDING_CONFIRMATION
                                             │
              ┌──────────────────────────────┤────────────────────────────┐
              │ slot confirmed/modified      │ session rescheduled        │ Sunday reset
              ▼                              ▼                            ▼
          SCHEDULED                      SCHEDULED                   CANCELLED
```

> Sessions outside the promoted week remain `SCHEDULED` and are unaffected.

---

## Base URL Pattern

```
/schools/{schoolId}/...
```

All endpoints are scoped to a school. The `schoolId` must be a valid UUID.

---

## API Reference

---

### 1. Trigger a Promotion Cycle

Opens a new promotion cycle for the upcoming week. Idempotent — calling it twice for the same week returns the existing active cycle.

```
POST /schools/{schoolId}/promotion-cycles
```

**Roles:** `owner`, `admin`, `hod`

**Request body** *(all fields optional)*

```jsonc
{
  "weekStart": "2026-06-23"   // Monday of the week to promote (YYYY-MM-DD)
                              // Omit to default to next Monday in school timezone
}
```

**Response `200 OK`**

```jsonc
{
  "id":          "a1b2c3d4-...",
  "schoolId":    "uuid",
  "weekStart":   "2026-06-23",   // Monday
  "weekEnd":     "2026-06-29",   // Sunday (auto-computed)
  "triggeredBy": "uuid",         // HOD user id
  "triggeredAt": "2026-06-20T09:00:00.000Z",
  "status":      "active",
  "createdAt":   "2026-06-20T09:00:00.000Z"
}
```

> If a cycle for `weekStart` already exists and is `active`, the existing record is returned unchanged — no duplicate is created.

**Error cases**

| HTTP | Code | Reason |
|---|---|---|
| 422 | `VALIDATION` | No active academic year for the school |
| 422 | `VALIDATION` | `weekStart` falls outside the active academic year |
| 409 | `CONFLICT` | A cycle for this week already exists but has already closed (`expired` or `completed`) |

---

### 2. List Promotion Cycles (HOD Dashboard)

```
GET /schools/{schoolId}/promotion-cycles
```

**Roles:** `owner`, `admin`, `hod`

**Response `200 OK`** *(array)*

```jsonc
[
  {
    "id":             "uuid",
    "weekStart":      "2026-06-23",
    "weekEnd":        "2026-06-29",
    "status":         "active",          // "active" | "completed" | "expired"
    "triggeredAt":    "2026-06-20T09:00:00.000Z",
    "pendingCount":   "3",               // Note: returned as strings from COUNT()
    "confirmedCount": "2",
    "modifiedCount":  "1",
    "resetCount":     "0"
  }
]
```

> Cast `pendingCount`, `confirmedCount`, `modifiedCount`, `resetCount` to integers — PostgreSQL `COUNT()` returns them as strings in the raw driver.

---

### 3. Get Cycle Detail (HOD Slot Status View)

```
GET /schools/{schoolId}/promotion-cycles/{cycleId}
```

**Roles:** `owner`, `admin`, `hod`

**Response `200 OK`**

```jsonc
{
  "id":          "uuid",
  "schoolId":    "uuid",
  "weekStart":   "2026-06-23",
  "weekEnd":     "2026-06-29",
  "triggeredBy": "uuid",
  "triggeredAt": "2026-06-20T09:00:00.000Z",
  "status":      "active",
  "createdAt":   "2026-06-20T09:00:00.000Z",
  "slots": [
    {
      "id":              "slotPromotionId-uuid",  // Use for lecturer actions
      "timetableSlotId": "uuid",
      "lecturerUserId":  "uuid",
      "status":          "pending",    // "pending" | "confirmed" | "modified" | "reset"
      "confirmedAt":     null,
      "resetAt":         null,
      "lecturerName":    "Dr. Jean Dupont",
      "courseTitle":     "Advanced Mathematics",
      "dayOfWeek":       1,            // 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
      "startTime":       "08:00",
      "endTime":         "10:00"
    }
  ]
}
```

**Error cases**

| HTTP | Code | Reason |
|---|---|---|
| 404 | `NOTFOUND` | Cycle not found or belongs to a different school |

---

### 4. Get Active Cycle for Current Lecturer

Returns the single active promotion cycle and the lecturer's own slot promotions within it.

```
GET /schools/{schoolId}/promotion-cycles/active/me
```

**Roles:** `lecturer`

**Response `200 OK`** *(null if no active cycle)*

```jsonc
{
  "id":       "cycleId-uuid",
  "schoolId": "uuid",
  "weekStart": "2026-06-23",
  "weekEnd":   "2026-06-29",
  "status":    "active",
  "mySlots": [
    {
      "id":              "slotPromotionId-uuid",  // Required for all lecturer actions
      "timetableSlotId": "uuid",
      "status":          "pending",  // "pending" | "confirmed" | "modified" | "reset"
      "confirmedAt":     null,
      "dayOfWeek":       1,
      "startTime":       "08:00",
      "endTime":         "10:00",
      "venue":           "Amphi 200",   // null if unset
      "courseTitle":     "Advanced Mathematics",
      "courseCode":      "MATH301",
      "className":       "L3-Informatique"
    }
  ]
}
```

> Returns `null` (HTTP 200 with `null` body) when no active cycle exists. Frontend should render a "no pending confirmations" empty state.

---

### 5. Confirm a Slot

Explicitly marks a slot as confirmed. All `pending_confirmation` sessions for this slot in the promoted week transition to `scheduled`.

```
POST /schools/{schoolId}/slot-promotions/{slotPromotionId}/confirm
```

**Roles:** `lecturer`

**Request body:** none

**Response `200 OK`:** empty body

**Error cases**

| HTTP | Code | Reason |
|---|---|---|
| 404 | `NOTFOUND` | Slot promotion not found |
| 403 | `FORBIDDEN` | Slot belongs to a different lecturer |
| 422 | `VALIDATION` | Slot status is not `pending` (already `confirmed`, `modified`, or `reset`) |
| 422 | `VALIDATION` | Promotion cycle is no longer active |

---

### 6. Modify Slot — Time or Venue (Slot-Level)

Updates the timetable slot template. Future weeks inherit the change. Automatically counts as a confirmation — no separate confirm call needed.

```
PATCH /schools/{schoolId}/slot-promotions/{slotPromotionId}/slot
```

**Roles:** `lecturer`

**Request body** *(at least one field required)*

```jsonc
{
  "startTime": "09:00",     // HH:MM — optional
  "endTime":   "11:00",     // HH:MM — optional
  "venue":     "Room-uuid"  // venue ID — optional, null to clear
}
```

**Response `200 OK`:** empty body

**Error cases**

| HTTP | Code | Reason |
|---|---|---|
| 404 | `NOTFOUND` | Slot promotion or timetable slot not found |
| 403 | `FORBIDDEN` | Slot belongs to a different lecturer |
| 422 | `VALIDATION` | Slot promotion has status `reset` |
| 422 | `VALIDATION` | Promotion cycle is no longer active |

> **Important:** This modifies the **slot template**. All future occurrences of this slot beyond the current week will also use the new time/venue. If the lecturer only wants a one-week change, they should use the session-level reschedule endpoint instead.

---

### 7. Reschedule a Session Instance (Session-Level)

Moves one session to a different date. Only that instance is affected — the slot template is unchanged. Automatically counts as a confirmation.

```
PATCH /schools/{schoolId}/slot-promotions/{slotPromotionId}/sessions/{sessionId}/reschedule
```

**Roles:** `lecturer`

**Request body**

```jsonc
{
  "newDate": "2026-06-25"   // YYYY-MM-DD, required
}
```

**Response `200 OK`:** empty body

**Error cases**

| HTTP | Code | Reason |
|---|---|---|
| 404 | `NOTFOUND` | Slot promotion not found |
| 403 | `FORBIDDEN` | Slot belongs to a different lecturer |
| 422 | `VALIDATION` | Slot promotion has status `reset` |
| 422 | `VALIDATION` | Promotion cycle is no longer active |

> **Frontend note:** After rescheduling, the session's `scheduledDate` will differ from the original day pattern. Reflect this in any weekly calendar view for the promoted week.

---

### 8. Cancel One Session for the Week (Session-Level)

Cancels a single session instance for the promoted week. The slot template and all other weeks are unaffected. Automatically counts as a confirmation for this slot.

```
DELETE /schools/{schoolId}/slot-promotions/{slotPromotionId}/sessions/{sessionId}
```

**Roles:** `lecturer`

**Response `200 OK`:** empty body

**Error cases**

| HTTP | Code | Reason |
|---|---|---|
| 404 | `NOTFOUND` | Slot promotion not found |
| 403 | `FORBIDDEN` | Slot belongs to a different lecturer |
| 422 | `VALIDATION` | Slot promotion has status `reset` |
| 422 | `VALIDATION` | Promotion cycle is no longer active |

---

### 9. Poll Unread Reminders

Returns all unread promotion reminders for the authenticated lecturer. Call this endpoint at a regular interval to drive the notification bell/badge.

```
GET /schools/{schoolId}/promotion-reminders
```

**Roles:** `lecturer`

**Response `200 OK`**

```jsonc
[
  {
    "id":               "uuid",
    "promotionCycleId": "uuid",
    "message":          "Reminder: confirm your timetable for week 2026-06-23 – 2026-06-29. Deadline is Sunday noon.",
    "sentAt":           "2026-06-20T07:00:00.000Z",
    "isRead":           false,
    "createdAt":        "2026-06-20T07:00:00.000Z"
  }
]
```

> Returns an empty array `[]` when there are no unread reminders. Safe to poll aggressively (e.g. every 60 seconds on the dashboard screen).

---

### 10. Mark a Reminder as Read

```
PATCH /schools/{schoolId}/promotion-reminders/{reminderId}/read
```

**Roles:** `lecturer`

**Request body:** none

**Response `200 OK`:** empty body

> Call this immediately after the lecturer opens the reminder detail or acknowledges the notification. The reminder will stop appearing in subsequent polls.

---

## Notification Badge Logic

```
badgeCount = promotionReminders.filter(r => !r.isRead).length
```

Recommended polling interval: **60 seconds** while the user is on the dashboard/home screen. Pause polling when the app is backgrounded. Call `GET /promotion-reminders` once on app foreground resume.

---

## Session Status — Impact on Existing UI

With the new `pending_confirmation` status, update any session-related UI that branches on `status`:

| Status | Meaning | Actions allowed |
|---|---|---|
| `pending_confirmation` | Awaiting lecturer confirmation for the upcoming week | Confirm, modify, cancel (via promotion endpoints only) |
| `scheduled` | Confirmed and upcoming | Start, cancel (via existing session endpoints) |
| `live` | Currently in progress | End |
| `completed` | Ended | View only |
| `cancelled` | Cancelled | View only |

**Critical:** The existing `POST /sessions/{id}/start` endpoint **rejects** `pending_confirmation` sessions with a 422 error. Do not render a **Start** button for sessions in this status. Render a **Confirm Schedule** prompt instead that deep-links to the slot promotion flow.

**Also:** The existing `POST /sessions/{id}/cancel` endpoint only processes `scheduled` sessions. Do not surface the regular Cancel option for `pending_confirmation` sessions — use `DELETE /slot-promotions/{id}/sessions/{sessionId}` instead.

---

## HOD — Full Workflow

```
1. HOD opens the Timetable Promotion screen
   → GET /schools/{schoolId}/promotion-cycles
   → Display list of past and active cycles

2. HOD taps "Start New Promotion"
   → POST /schools/{schoolId}/promotion-cycles
      Body: {} (defaults to next Monday)
   → On 200: navigate to cycle detail
   → On 409: inform HOD a cycle exists for that week and it has closed

3. HOD monitors progress
   → GET /schools/{schoolId}/promotion-cycles/{cycleId}
   → Display per-lecturer, per-slot status with pendingCount badge
   → Refresh periodically or on-demand
```

---

## Lecturer — Full Workflow

```
1. Lecturer receives notification (reminder badge appears)
   → GET /schools/{schoolId}/promotion-reminders
   → Badge shows count of unread reminders

2. Lecturer opens notification / taps the reminder
   → GET /schools/{schoolId}/promotion-cycles/active/me
   → Display list of mySlots that are still "pending"
   → PATCH /schools/{schoolId}/promotion-reminders/{id}/read (mark as read)

3. For each pending slot, lecturer chooses one of:

   a) Confirm as-is
      → POST /schools/{schoolId}/slot-promotions/{slotPromotionId}/confirm

   b) Change time or venue for all future weeks
      → PATCH /schools/{schoolId}/slot-promotions/{slotPromotionId}/slot
         Body: { startTime: "09:00", endTime: "11:00" }

   c) Move this week's session to a different date (one-off)
      → PATCH /schools/{schoolId}/slot-promotions/{slotPromotionId}/sessions/{sessionId}/reschedule
         Body: { newDate: "2026-06-25" }

   d) Cancel this week's session (holiday, unavailable)
      → DELETE /schools/{schoolId}/slot-promotions/{slotPromotionId}/sessions/{sessionId}

4. After each action, refresh the slot list
   → GET /schools/{schoolId}/promotion-cycles/active/me
   → Slot status will now show "confirmed" or "modified"

5. When all slots are confirmed, mySlots will be empty (or all non-pending)
```

---

## Obtaining sessionId for Promotion Session Actions

The `mySlots` response from `GET /promotion-cycles/active/me` gives `timetableSlotId` and `slotPromotionId`, but not the individual `sessionId` values for the promoted week.

To get the session IDs for reschedule/cancel:

```
GET /schools/{schoolId}/sessions
```

Filter client-side by:
- `status === 'pending_confirmation'`
- `scheduledDate` between `weekStart` and `weekEnd` of the active cycle
- Match `timetableSlotId` from `mySlots`

```javascript
// Example: find sessions for a specific pending slot
const weekSessions = sessions.filter(s =>
  s.status === 'pending_confirmation' &&
  s.scheduledDate >= cycle.weekStart &&
  s.scheduledDate <= cycle.weekEnd &&
  s.timetableSlotId === slot.timetableSlotId
);
```

---

## dayOfWeek Reference

The `dayOfWeek` field follows the JavaScript/ISO convention:

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

All errors follow the global exception format:

```jsonc
{
  "statusCode": 422,
  "code":       "VALIDATION",   // See table below
  "message":    "Human-readable description",
  "details":    {}              // Optional extra context
}
```

| Code | HTTP | When |
|---|---|---|
| `VALIDATION` | 422 | Invalid input, wrong state for operation |
| `CONFLICT` | 409 | Duplicate cycle for a week that has already closed |
| `NOTFOUND` | 404 | Resource not found in the school's scope |
| `FORBIDDEN` | 403 | Authenticated user does not own the resource |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT token |

---

## Idempotency Reference

| Endpoint | Idempotent? | Behaviour on repeat |
|---|---|---|
| `POST /promotion-cycles` | Yes | Returns existing active cycle if `weekStart` matches |
| `POST .../confirm` | No | Returns 422 if already confirmed |
| `PATCH .../slot` | Yes | Overwrites with latest values |
| `PATCH .../sessions/:id/reschedule` | Yes | Overwrites with latest date |
| `DELETE .../sessions/:id` | No | Returns 422 after first cancel (session already cancelled) |
| `PATCH /promotion-reminders/:id/read` | Yes | No-op if already read |

---

## Summary of Endpoints

| Method | Path | Role | Purpose |
|---|---|---|---|
| `POST` | `/schools/:schoolId/promotion-cycles` | hod, admin, owner | Trigger new cycle |
| `GET` | `/schools/:schoolId/promotion-cycles` | hod, admin, owner | List all cycles with stats |
| `GET` | `/schools/:schoolId/promotion-cycles/active/me` | lecturer | My active cycle + my slots |
| `GET` | `/schools/:schoolId/promotion-cycles/:cycleId` | hod, admin, owner | Cycle detail with all slots |
| `POST` | `/schools/:schoolId/slot-promotions/:id/confirm` | lecturer | Explicit confirm |
| `PATCH` | `/schools/:schoolId/slot-promotions/:id/slot` | lecturer | Slot-level modify (time/venue) |
| `PATCH` | `/schools/:schoolId/slot-promotions/:id/sessions/:sessionId/reschedule` | lecturer | Reschedule one session |
| `DELETE` | `/schools/:schoolId/slot-promotions/:id/sessions/:sessionId` | lecturer | Cancel one session for the week |
| `GET` | `/schools/:schoolId/promotion-reminders` | lecturer | Poll unread reminders |
| `PATCH` | `/schools/:schoolId/promotion-reminders/:id/read` | lecturer | Mark reminder as read |
