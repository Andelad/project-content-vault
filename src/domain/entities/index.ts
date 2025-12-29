/**
 * Domain Entities
 * 
 * Rich domain models that encapsulate business logic and enforce invariants.
 * Entities cannot be created in invalid states.
 * 
 * @see docs/core/App Logic.md - Entity definitions (WHAT)
 * @see docs/core/Business Logic.md - Business rules (HOW)
 * @see docs/sessions/domain-entity-architecture-plan.md - Implementation plan
 */

// ============================================================================
// CORE ENTITIES - Phase 1
// ============================================================================

export { Project, type CreateProjectParams, type DomainResult } from './Project';
export { Client, type CreateClientParams, type UpdateClientParams } from './Client';
export { Phase, type CreatePhaseParams, type UpdatePhaseParams } from './Phase';

// ============================================================================
// SUPPORTING ENTITIES - Phase 2
// ============================================================================

export { Group, type CreateGroupParams, type UpdateGroupParams } from './Group';
export { Label, type CreateLabelParams, type UpdateLabelParams } from './Label';
export { 
  CalendarEvent, 
  type CreateCalendarEventParams, 
  type UpdateCalendarEventParams,
  type EventCategory,
  type EventType,
  type LegacyRecurringConfig
} from './CalendarEvent';
export { WorkSlot, type CreateWorkSlotParams, type UpdateWorkSlotParams } from './WorkSlot';
export { Holiday, type CreateHolidayParams, type UpdateHolidayParams } from './Holiday';

// ============================================================================
// NOTES
// ============================================================================

// All entities follow the same pattern:
// 1. Factory method: EntityName.create(params) - validates and creates new instance
// 2. Database reconstitution: EntityName.fromDatabase(data) - loads existing instance
// 3. Business operations: entity.update(), entity.someAction()
// 4. Query methods: entity.isSomething(), entity.getSomeValue()
// 5. Data conversion: entity.toData() - converts back to plain object for persistence
//
// Implementation Status:
// ✅ Project - IMPLEMENTED (already in use)
// ✅ Client - COMPLETE (ready for integration)
// ✅ Phase - COMPLETE (ready for integration)
// ✅ Group - COMPLETE (ready for integration)
// ✅ Label - COMPLETE (ready for integration)
// ✅ CalendarEvent - COMPLETE (ready for integration)
// ✅ WorkSlot - COMPLETE (ready for integration)
// ✅ Holiday - COMPLETE (ready for integration)
//
// ALL 8 DOMAIN ENTITIES FROM APP LOGIC NOW CREATED!
// (User is managed by Supabase Auth, not a domain entity)
//
// Next Steps:
// 1. Integrate entities one by one into orchestrators
// 2. Update unified services to use entities
// 3. Gradually migrate existing code to use entity methods
