# Role Permissions Requirements

This document captures the current permission model implied by the frontend and the minimum requirements for the backend permission seed data.

## Purpose

- Seed base permissions on the backend.
- Assign permissions to users through their applicable roles.
- Keep frontend role-based visibility and backend authorization aligned.

## Current Role Capability Set

These are the permissions currently defined in the shared role capability map.

| Role | Permissions |
| --- | --- |
| owner | manage:organization, manage:schools, manage:users, manage:billing, view:analytics, view:all-data, manage:classes, manage:enrollments, view:classmates |
| admin | manage:timetables, manage:rooms, manage:schedules, manage:student-records, view:reports, manage:announcements, manage:classes, manage:enrollments, view:classmates |
| director | manage:school, manage:departments, manage:staff, manage:timetables, manage:rooms, view:school-analytics, view:all-school-data, manage:classes, manage:enrollments, view:classmates |
| hod | manage:department, manage:courses, manage:lecturers, approve:timetables, view:department-analytics, manage:classes, view:classmates |
| lecturer | manage:sessions, start:session, end:session, mark:attendance, view:class-roster, manage:course-materials, view:classmates |
| student | view:timetable, view:attendance, view:grades, view:course-materials, join:session, view:classmates |
| guardian | view:linked-students, view:student-attendance, view:student-grades, receive:notifications |
| follower | view:public-info, view:announcements |

## Workspace Navigation Permissions

The school workspace sidebar also checks the following permission keys.

| Workspace item | Permission |
| --- | --- |
| Courses | manage:courses |
| Sessions | manage:sessions |
| Timetable | manage:timetables |
| Attendance | mark:attendance |
| Submissions | manage:course-materials |
| Records | view:student-records |
| Grading | manage:course-materials |
| Departments | manage:departments |
| Programs | manage:organization |
| Staff | manage:users |
| Enrollment | manage:student-records |
| Academic Year | manage:school |
| Bulk Imports | manage:imports |
| Reports | view:school-analytics |
| Performance | view:student-grades |
| Students | view:linked-students |
| Settings | manage:school |

## Workspace Navigation Permissions (updated)

| Workspace item | Permission |
| --- | --- |
| Classes | manage:classes |

## Backend Requirements

The backend should support at least the following capability set, because the frontend already depends on them:

- manage:organization
- manage:schools
- manage:users
- manage:billing
- view:analytics
- view:all-data
- manage:school
- manage:departments
- manage:staff
- manage:timetables
- manage:rooms
- view:school-analytics
- view:all-school-data
- manage:schedules
- manage:student-records
- view:reports
- manage:announcements
- manage:department
- manage:courses
- manage:lecturers
- approve:timetables
- view:department-analytics
- manage:sessions
- start:session
- end:session
- mark:attendance
- view:class-roster
- manage:course-materials
- view:timetable
- view:attendance
- view:grades
- view:course-materials
- join:session
- view:linked-students
- view:student-attendance
- view:student-grades
- receive:notifications
- view:public-info
- view:announcements
- manage:classes
- view:classmates
- manage:enrollments

## Class Management Feature

### Auto-split behaviour
- A class with `maxCapacity` set is automatically split when its student count reaches that threshold.
- The split is alphabetical by full name. The first half (ceil(n/2)) goes to **ClassA**; the second half goes to **ClassB**.
- ClassA inherits all course assignments, timetable slots, and session records (via `course_assignments` reassignment).
- ClassB starts empty — admins must manually assign courses and timetable.
- The original class becomes a **group label** (`is_group = true`) and cannot receive new students.
- Splitting is one level deep only (no splitting a sub-class).
- A manual split endpoint (`POST /schools/:schoolId/classes/:classId/split`) is also available for owner/admin/director.

### Enrollment flow
- Enrollment is a formal request process: student or admin submits `POST /classes/:classId/enrollment-requests`.
- An owner/admin/director approves (`PATCH /enrollment-requests/:requestId/approve`) or rejects.
- If the class is at capacity, approval requires `overrideCap: true` in the request body.
- On approval, if the new count reaches `maxCapacity`, auto-split fires automatically.
- Every class assignment and transfer is recorded in `class_transfer_logs` with the actor's user ID.

### Student portal
- `GET /schools/:schoolId/classes/my-class` returns the authenticated student's class overview:
  timetable, active sessions, enrolled courses with lecturers, classmates, own attendance, and grades.

## Gaps To Reconcile

The current frontend references these permissions in the workspace navigation, but they are not all present in the shared role capability map yet:

- manage:courses
- manage:imports
- view:student-records
- view:student-grades

If backend permissions are the source of truth, decide whether to:

- add the missing permissions to the relevant roles, or
- remove or hide the affected navigation items until the backend supports them.

## Suggested Role Assignment Strategy

Use these role buckets as the default backend mapping:

- owner: full organization-level access, including school administration and user management.
- admin: operational school management, timetables, student records, reports, and announcements.
- director: school-level administration, departments, staff, timetables, and analytics.
- hod: department-level management, courses, lecturers, and timetable approval.
- lecturer: session delivery, attendance, course materials, and class roster visibility.
- student: self-service learning access, timetable, attendance, grades, and course materials.
- guardian: linked student visibility and notifications.
- follower: public information and announcements only.

## Notes

- The frontend uses permission-based filtering for the sidebar and role-based guards for some routes, so both layers should stay consistent.
- The backend should remain authoritative for authorization; the frontend should only control visibility.