/**
 * Event emitted whenever a new school is successfully created in the system.
 */
export class SchoolCreatedEvent {
  constructor(public readonly schoolId: string) {}
}