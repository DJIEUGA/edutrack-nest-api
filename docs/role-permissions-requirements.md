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
| owner | manage:organization, manage:schools, manage:users, manage:billing, view:analytics, view:all-data |
| admin | manage:timetables, manage:rooms, manage:schedules, manage:student-records, view:reports, manage:announcements |
| director | manage:school, manage:departments, manage:staff, manage:timetables, manage:rooms, view:school-analytics, view:all-school-data |
| hod | manage:department, manage:courses, manage:lecturers, approve:timetables, view:department-analytics |
| lecturer | manage:sessions, start:session, end:session, mark:attendance, view:class-roster, manage:course-materials |
| student | view:timetable, view:attendance, view:grades, view:course-materials, join:session |
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