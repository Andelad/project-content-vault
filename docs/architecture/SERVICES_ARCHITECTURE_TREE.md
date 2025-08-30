# Services Architecture Tree - Doma├── 📁 milestones/                        # Milestone feature domain (SIMPLE: ≤2 files)
│   ├── 📄 MilestoneOrchestrator.ts       ✅ IMPLEMENTED - Business workflow coordination
│   ├── 📄 MilestoneValidator.ts          ✅ IMPLEMENTED - Complex validation scenarios  
│   ├── 📄 MilestoneRepository.ts         ✅ IMPLEMENTED - Data access abstraction
│   │
│   └── 📁 legacy/                        # 🗑️ DELETE AFTER MIGRATION
│       ├── 📄 milestoneManagementService.ts      🔄 DELEGATES TO NEW ARCH
│       ├── 📄 milestoneCalculationService.ts     🎯 REFACTOR TO DELEGATE
│       ├── 📄 milestoneUtilitiesService.ts       🎯 REFACTOR TO DELEGATE
│       └── 📄 recurringMilestoneService.ts       🎯 REFACTOR TO DELEGATE
│
├── 📁 projects/                          # Project feature domain (SIMPLE: ≤2 files)
│   ├── 📄 ProjectOrchestrator.ts         ✅ IMPLEMENTED - Business workflow coordination
│   ├── 📄 ProjectValidator.ts            ✅ IMPLEMENTED - Complex validation scenarios
│   ├── 📄 ProjectRepository.ts           ✅ IMPLEMENTED - Data access abstraction
│   │
│   └── 📁 legacy/                        # 🗑️ DELETE AFTER MIGRATION
│       ├── 📄 ProjectCalculationService.ts       🎯 REFACTOR TO DELEGATE
│       ├── 📄 projectProgressService.ts          🎯 REFACTOR TO DELEGATE
│       ├── 📄 projectStatusService.ts            🎯 REFACTOR TO DELEGATE
│       ├── 📄 projectWorkingDaysService.ts       🎯 REFACTOR TO DELEGATE
│       ├── 📄 projectOverlapService.ts           🎯 REFACTOR TO DELEGATE
│       └── 📄 ProjectValidationService.ts        🎯 REFACTOR TO DELEGATE
│
├── 📁 work-hours/                        # Work hours feature domain (SIMPLE: ≤2 files)
│   ├── 📄 WorkHourOrchestrator.ts        🎯 NEW - Work hour workflows
│   ├── 📄 WorkHourValidator.ts           🎯 NEW - Complex work hour validation
│   ├── 📄 WorkHourRepository.ts          🎯 NEW - Replace static state
│   │
│   └── 📁 legacy/                        # 🗑️ DELETE AFTER MIGRATION
│       ├── 📄 WorkHourCalculationService.ts      🎯 CRITICAL REFACTOR - Remove static state
│       ├── 📄 workHourCapacityService.ts         🎯 REFACTOR TO DELEGATE
│       └── 📄 workHourCreationService.ts         🎯 REFACTOR TO DELEGATE
│
├── 📁 events/                            # Calendar events feature domain (COMPLEX: >2 files)
│   ├── 📄 EventOrchestrator.ts           🎯 NEW - Complex event workflows
│   ├── 📄 EventValidator.ts              🎯 NEW - Event validation scenarios
│   ├── 📄 EventRepository.ts             🎯 NEW - Event data access
│   │
│   ├── 📁 calculations/                  # Feature-specific calculations
│   │   ├── 📄 dragCalculations.ts        🎯 NEW - Drag interaction business logic
│   │   ├── 📄 overlapCalculations.ts     🎯 NEW - Event overlap calculations
│   │   ├── 📄 durationCalculations.ts    🎯 NEW - Event duration calculations
│   │   └── 📄 splitCalculations.ts       🎯 NEW - Event splitting logic
│   │
│   └── 📁 legacy/                        # 🗑️ DELETE AFTER MIGRATION
│       ├── 📄 eventDurationService.ts            ✅ MOSTLY PURE - Minor refactor
│       ├── 📄 eventOverlapService.ts             🎯 REFACTOR TO DELEGATE
│       ├── 📄 eventSplittingService.ts           🎯 REFACTOR TO DELEGATE
│       ├── 📄 eventWorkHourIntegrationService.ts 🎯 REFACTOR TO DELEGATE
│       ├── 📄 dragCalculationService.ts          🎯 REFACTOR TO DELEGATE
│       ├── 📄 timelineDragCoordinatorService.ts  🎯 REFACTOR TO DELEGATE
│       └── 📄 plannedTimeCompletionService.ts    🎯 REFACTOR TO DELEGATE
│
├── 📁 timeline/                          # Timeline UI/business feature domain (COMPLEX: >2 files)
│   ├── 📄 TimelineOrchestrator.ts        🎯 NEW - Timeline business workflows
│   ├── 📄 TimelineValidator.ts           🎯 NEW - Timeline constraint validation
│   ├── 📄 TimelineRepository.ts          🎯 NEW - Timeline state management
│   │
│   ├── 📁 calculations/                  # Feature-specific calculations
│   │   ├── 📄 positioningCalculations.ts 🎯 NEW - Timeline positioning logic
│   │   ├── 📄 viewportCalculations.ts    🎯 NEW - Viewport sizing calculations
│   │   ├── 📄 allocationCalculations.ts  🎯 NEW - Time allocation logic
│   │   └── 📄 sizingCalculations.ts      🎯 NEW - UI sizing calculations
│   │
│   └── 📁 legacy/                        
│       ├── 📄 TimelineCalculationService.ts      🎯 CRITICAL REFACTOR - Separate UI from business
│       ├── 📄 TimelineBusinessLogicService.ts    🎯 REFACTOR TO DELEGATE
│       ├── 📄 TimeAllocationService.ts           🎯 REFACTOR TO DELEGATE
│       ├── 📄 TimelinePositioningService.ts      🎯 REFACTOR TO DELEGATE
│       ├── 📄 timelinePositionService.ts         🎯 REFACTOR TO DELEGATE
│       ├── 📄 timelineViewportService.ts         🎯 REFACTOR TO DELEGATE
│       ├── 📄 AvailabilityCircleSizingService.ts 🎯 MOVE TO UI CALCULATIONS
│       ├── 📄 HeightCalculationService.ts        🎯 MOVE TO UI CALCULATIONS
│       └── 📄 HolidayCalculationService.ts       🎯 REFACTOR TO DELEGATEDesign

## 🏗️ **Complete Refactored Services Structure**

```
src/services/
├── 📁 core/                              # Cross-cutting concerns
│   ├── 📁 domain/                        # Pure business rules (no dependencies)
│   │   ├── 📄 MilestoneEntity.ts         ✅ IMPLEMENTED
│   │   ├── 📄 ProjectEntity.ts           ✅ IMPLEMENTED  
│   │   ├── 📄 PauseEntity.ts             ✅ IMPLEMENTED
│   │   ├── 📄 WorkHourEntity.ts          🎯 NEW - Work hour business rules
│   │   ├── 📄 EventEntity.ts             🎯 NEW - Calendar event business rules
│   │   ├── 📄 TimelineEntity.ts          🎯 NEW - Timeline constraint business rules
│   │   ├── 📄 SettingsEntity.ts          🎯 NEW - Settings validation business rules
│   │   └── 📄 InsightsEntity.ts          🎯 NEW - Reporting/analytics business rules
│   │
│   ├── 📁 calculations/                  # Pure mathematical functions
│   │   ├── 📄 dateCalculations.ts        ✅ IMPLEMENTED
│   │   ├── 📄 milestoneCalculations.ts   ✅ IMPLEMENTED
│   │   ├── 📄 workHourCalculations.ts    🎯 NEW - Pure work hour math
│   │   ├── 📄 eventCalculations.ts       🎯 NEW - Pure event duration/overlap math
│   │   ├── 📄 timelineCalculations.ts    🎯 NEW - Pure timeline positioning math
│   │   ├── 📄 capacityCalculations.ts    🎯 NEW - Pure capacity planning math
│   │   └── 📄 insightsCalculations.ts    🎯 NEW - Pure analytics calculations
│   │
│   ├── 📁 infrastructure/                # Caching & technical infrastructure
│   │   ├── 📄 dateCache.ts               ✅ IMPLEMENTED
│   │   └── 📄 calculationCache.ts        🎯 NEW - General calculation caching
│   │
│   ├── � performance/                   # Performance optimization & monitoring
│   │   ├── �📄 cachePerformanceService.ts ✅ MOVED FROM old performance/
│   │   ├── 📄 dragPerformanceService.ts  ✅ MOVED FROM old performance/
│   │   └── 📄 performanceMetricsService.ts ✅ MOVED FROM old performance/
│
├── 📁 milestones/                        # Milestone feature domain
│   ├── � MilestoneOrchestrator.ts       ✅ IMPLEMENTED - Business workflow coordination
│   ├── 📄 MilestoneValidator.ts          ✅ IMPLEMENTED - Complex validation scenarios  
│   ├── 📄 MilestoneRepository.ts         ✅ IMPLEMENTED - Data access abstraction
│   │
│   └── 📁 legacy/                        # 🗑️ DELETE AFTER MIGRATION
│       ├── 📄 milestoneManagementService.ts      🔄 DELEGATES TO NEW ARCH
│       ├── 📄 milestoneCalculationService.ts     🎯 REFACTOR TO DELEGATE
│       ├── 📄 milestoneUtilitiesService.ts       🎯 REFACTOR TO DELEGATE
│       └── 📄 recurringMilestoneService.ts       🎯 REFACTOR TO DELEGATE
│
├── 📁 projects/                          # Project feature domain
│   ├──  ProjectOrchestrator.ts         ✅ IMPLEMENTED - Business workflow coordination
│   ├── 📄 ProjectValidator.ts            ✅ IMPLEMENTED - Complex validation scenarios
│   ├── 📄 ProjectRepository.ts           ✅ IMPLEMENTED - Data access abstraction
│   │
│   └── 📁 legacy/                        # 🗑️ DELETE AFTER MIGRATION
│       ├── 📄 ProjectCalculationService.ts       🎯 REFACTOR TO DELEGATE
│       ├── 📄 projectProgressService.ts          🎯 REFACTOR TO DELEGATE
│       ├── 📄 projectStatusService.ts            🎯 REFACTOR TO DELEGATE
│       ├── 📄 projectWorkingDaysService.ts       🎯 REFACTOR TO DELEGATE
│       ├── 📄 projectOverlapService.ts           🎯 REFACTOR TO DELEGATE
│       └── 📄 ProjectValidationService.ts        🎯 REFACTOR TO DELEGATE
│
├── 📁 work-hours/                        # Work hours feature domain
│   ├──  WorkHourOrchestrator.ts        🎯 NEW - Work hour workflows
│   ├──  WorkHourValidator.ts           🎯 NEW - Complex work hour validation
│   ├── 📄 WorkHourRepository.ts          🎯 NEW - Replace static state
│   │
│   └── 📁 legacy/                        # 🗑️ DELETE AFTER MIGRATION
│       ├── 📄 WorkHourCalculationService.ts      🎯 CRITICAL REFACTOR - Remove static state
│       ├── 📄 workHourCapacityService.ts         🎯 REFACTOR TO DELEGATE
│       └── 📄 workHourCreationService.ts         🎯 REFACTOR TO DELEGATE
│
├── 📁 events/                            # Calendar events feature domain
│   ├──  EventOrchestrator.ts           🎯 NEW - Complex event workflows
│   ├──  EventValidator.ts              🎯 NEW - Event validation scenarios
│   ├── 📄 EventRepository.ts             🎯 NEW - Event data access
│   │
│   └── 📁 legacy/                        # 🗑️ DELETE AFTER MIGRATION
│       ├── 📄 eventDurationService.ts            ✅ MOSTLY PURE - Minor refactor
│       ├── 📄 eventOverlapService.ts             🎯 REFACTOR TO DELEGATE
│       ├── 📄 eventSplittingService.ts           🎯 REFACTOR TO DELEGATE
│       ├── 📄 eventWorkHourIntegrationService.ts 🎯 REFACTOR TO DELEGATE
│       ├── 📄 dragCalculationService.ts          🎯 REFACTOR TO DELEGATE
│       ├── 📄 timelineDragCoordinatorService.ts  🎯 REFACTOR TO DELEGATE
│       └── 📄 plannedTimeCompletionService.ts    🎯 REFACTOR TO DELEGATE
│
├── 📁 timeline/                          # Timeline UI/business feature domain
│   ├── 📁 orchestrators/                 
│   │   └── 📄 TimelineOrchestrator.ts    🎯 NEW - Timeline business workflows
│   │
│   ├── 📁 validators/                    
│   │   └── 📄 TimelineValidator.ts       🎯 NEW - Timeline constraint validation
│   │
│   ├── 📁 repositories/                  
│   │   └── 📄 TimelineRepository.ts      🎯 NEW - Timeline state management
│   │
│   └── 📁 legacy/                        
│       ├── 📄 TimelineCalculationService.ts      🎯 CRITICAL REFACTOR - Separate UI from business
│       ├── 📄 TimelineBusinessLogicService.ts    🎯 REFACTOR TO DELEGATE
│       ├── 📄 TimeAllocationService.ts           🎯 REFACTOR TO DELEGATE
│       ├── 📄 TimelinePositioningService.ts      🎯 REFACTOR TO DELEGATE
│       ├── 📄 timelinePositionService.ts         🎯 REFACTOR TO DELEGATE
│       ├── 📄 timelineViewportService.ts         🎯 REFACTOR TO DELEGATE
│       ├── 📄 AvailabilityCircleSizingService.ts 🎯 MOVE TO UI CALCULATIONS
│       ├── 📄 HeightCalculationService.ts        🎯 MOVE TO UI CALCULATIONS
│       └── 📄 HolidayCalculationService.ts       🎯 REFACTOR TO DELEGATE
│
├── 📁 settings/                          # Settings feature domain (SIMPLE: ≤2 files)
│   ├── 📄 SettingsOrchestrator.ts        🎯 NEW - Settings management workflows
│   ├──  SettingsValidator.ts           🎯 NEW - Complex settings validation
│   ├──  SettingsRepository.ts          🎯 NEW - Settings persistence
│   │
│   └── 📁 legacy/                        
│       ├── 📄 settingsValidationService.ts       🎯 REFACTOR TO DELEGATE
│       └── 📄 timeFormattingService.ts           🎯 MOVE TO CORE CALCULATIONS
│
├── 📁 insights/                          # Analytics/reporting feature domain (SIMPLE: ≤2 files)
│   ├── 📄 InsightsOrchestrator.ts        🎯 NEW - Complex reporting workflows
│   ├──  InsightsValidator.ts           🎯 NEW - Report validation
│   ├──  InsightsRepository.ts          🎯 NEW - Analytics data access
│   │
│   └── 📁 legacy/                        
│       └── 📄 insightsCalculationService.ts      ✅ MOSTLY PURE - Minor refactor
│
├── 📁 calendar/                          # Calendar integration feature domain (SIMPLE: ≤2 files)
│   ├── 📄 CalendarOrchestrator.ts        🎯 NEW - Calendar sync workflows
│   ├── � CalendarValidator.ts           🎯 NEW - Calendar data validation
│   ├── 📄 CalendarRepository.ts          🎯 NEW - Calendar integration data
│   │
│   └── 📁 legacy/                        
│       └── 📄 CalendarMappingService.ts          🎯 REFACTOR TO DELEGATE
│
├── 📁 plannerV2/                         # PlannerV2 feature domain (SIMPLE: ≤2 files)
│   ├── 📄 PlannerOrchestrator.ts         🎯 NEW - Planner business workflows
│   ├── 📄 PlannerValidator.ts            🎯 NEW - Planner validation
│   ├── 📄 PlannerRepository.ts           🎯 NEW - Planner state management
│   │
│   └── 📁 legacy/                        
│
├── 📁 tracker/                           # Time tracking feature domain (SIMPLE: ≤2 files)
│   ├── 📄 TrackerOrchestrator.ts         🎯 NEW - Tracking workflows
│   ├── 📄 TrackerValidator.ts            🎯 NEW - Tracking validation
│   ├── 📄 TrackerRepository.ts           🎯 NEW - Tracking data access
│   │
│   └── 📁 legacy/
│
└── 📄 index.ts                           # Clean exports organized by layer
```

## 🎯 **Layer Responsibilities**

### **Core Domain Layer** (`core/domain/`)
```typescript
// ✅ Pure business rules - no dependencies
export class WorkHourEntity {
  static validateWorkSlot(startTime: string, endTime: string): boolean;
  static calculateSlotDuration(slot: WorkSlot): number;
  static hasTimeOverlap(slot1: WorkSlot, slot2: WorkSlot): boolean;
  static isValidWorkSchedule(schedule: WorkSlot[]): boolean;
}
```

### **Pure Calculations Layer** (`core/calculations/`)
```typescript
// ✅ Mathematical functions only
export function calculateCapacityUtilization(
  plannedHours: number, 
  availableHours: number
): number;

export function calculateWorkHourOverlap(
  event: TimeSlot, 
  workHours: TimeSlot[]
): number;
```

### **Infrastructure Layer** (`core/infrastructure/`)
```typescript
// ✅ Caching and performance optimizations
export class CalculationCache {
  static getCachedResult<T>(key: string): T | undefined;
  static setCachedResult<T>(key: string, result: T): void;
}
```

### **Business Orchestrators** (`{feature}/`)
```typescript
// ✅ Coordinate complex workflows
export class WorkHourOrchestrator {
  static async createWorkSchedule(request: CreateScheduleRequest): Promise<OperationResult>;
  static async validateScheduleConflicts(schedule: WorkSlot[]): Promise<ValidationResult>;
}
```

### **Validators** (`{feature}/`)
```typescript
// ✅ Complex validation scenarios requiring external data
export class EventValidator {
  static async validateEventCreation(event: Event, context: ValidationContext): Promise<DetailedValidationResult>;
}
```

### **Repositories** (`{feature}/`)
```typescript
// ✅ Data access abstraction
export interface IWorkHourRepository {
  findByWeek(weekStart: Date): Promise<WorkHour[]>;
  create(workHour: WorkHour): Promise<WorkHour>;
  update(id: string, updates: Partial<WorkHour>): Promise<WorkHour>;
}
```

## 📊 **Migration Benefits**

### **Before (Current Issues)**
```typescript
// ❌ Mixed responsibilities
class WorkHourCalculationService {
  private static weeklyOverridesMap = new Map(); // STATE!
  static getWeekStart(date: Date) { ... }         // Pure calc
  static getWeekOverrides(week: Date) { ... }     // Data access
  static validateSlot(slot: WorkSlot) { ... }     // Business rule
}
```

### **After (Clean Separation)**
```typescript
// ✅ Pure business rules
class WorkHourEntity {
  static validateSlot(slot: WorkSlot): boolean { ... }
}

// ✅ Pure calculations  
function calculateSlotDuration(slot: WorkSlot): number { ... }

// ✅ Data access
class WorkHourRepository implements IWorkHourRepository {
  async findByWeek(weekStart: Date): Promise<WorkHour[]> { ... }
}

// ✅ Workflow coordination
class WorkHourOrchestrator {
  static async createSchedule(request: CreateScheduleRequest) {
    // Uses entities, calculations, and repository
  }
}
```

## 🚀 **Implementation Phases**

### **Phase 1: Critical Foundations (Week 1)**
- ✅ Core domain entities (milestone, project done)
- 🎯 WorkHour & Event entities (remove static state)
- 🎯 Timeline entity (separate UI from business)

### **Phase 2: Feature Orchestrators (Week 2)**  
- 🎯 WorkHour, Event, Timeline orchestrators
- 🎯 Complex validators for each domain
- 🎯 Repository implementations

### **Phase 3: Legacy Migration (Week 3)**
- 🎯 Update existing services to delegate
- 🎯 Maintain backward compatibility
- 🎯 Comprehensive testing

### **Phase 4: Polish & Optimization (Week 4)**
- 🎯 Performance optimizations
- 🎯 Documentation updates
- 🎯 Final cleanup

## 🎯 **Final Structure Benefits**

1. **🧪 Testability** - Each layer independently testable
2. **🔒 Safety** - Business rules centralized and validated  
3. **⚡ Performance** - Intelligent caching at infrastructure layer
4. **🔄 Reusability** - Domain entities usable across features
5. **📈 Maintainability** - Clear separation prevents tangled logic
6. **🚀 Scalability** - Easy to add new features following patterns

This structure transforms the current **mixed-responsibility services** into a **clean, layered architecture** that's safe for experimentation and long-term maintenance! 🏗️
