# Components Directory - Organization Guide

**Last Updated**: October 26, 2025  
**Purpose**: Single source of truth for component organization and naming conventions

---

## 📁 Directory Structure

```
src/components/
├── shared/              # Reusable base components (generic, configurable)
├── ui/                  # shadcn/ui components (design system primitives)
├── views/               # Page-level components (route containers)
├── modals/              # Full modal dialogs (with backdrop, can be opened/closed)
├── layout/              # App layout components (header, sidebar, page structure)
├── timeline/            # Timeline feature components
├── projects/            # Project management components
│   ├── bar/             # Project bar components (timeline rows)
│   └── sections/        # Project modal sections (reusable modal content)
├── planner/             # Calendar/planner feature components
├── insights/            # Analytics and insights components
├── work-hours/          # Time tracking components
├── settings/            # Settings page components
├── dialog/              # Confirmation dialogs
├── debug/               # Development and debugging components
└── index.ts             # Barrel export (single import point)
```

---

## 🎯 Component Classification Guide

### When to Create Components in Each Folder

#### `/shared/` - Reusable Base Components
**Purpose**: Generic, highly reusable components that can be configured for multiple use cases

**Characteristics**:
- Generic type parameters (`<T>`)
- Configurable via props/callbacks
- No direct feature dependencies
- Can be used across multiple features

**Examples**:
- `SmartHoverAddBar.tsx` - Generic drag-to-create component
- Base form components, base table components

**When to use**: Creating a component that will be used by 3+ different features

---

#### `/ui/` - Design System Primitives
**Purpose**: shadcn/ui components and design system primitives

**Characteristics**:
- Installed via shadcn CLI
- Design system components (buttons, inputs, cards, etc.)
- Highly generic, no business logic
- Consistent styling patterns

**Examples**:
- `button.tsx`, `card.tsx`, `dialog.tsx`
- `rich-text-editor.tsx` - Custom UI component

**When to use**: Adding shadcn components or creating low-level UI primitives

**Note**: Don't create new files here manually - use `npx shadcn@latest add <component>`

---

#### `/views/` - Page-Level Components
**Purpose**: Top-level route containers that render a full page

**Characteristics**:
- Direct route mapping (e.g., `/app/timeline` → `TimelineView`)
- Orchestrates multiple features on a page
- Manages page-level state
- Lazy-loaded in `MainAppLayout.tsx`

**Examples**:
- `TimelineView.tsx` - Timeline page
- `ProjectsView.tsx` - Projects page
- `InsightsView.tsx` - Analytics page

**Naming convention**: `*View.tsx`

**When to use**: Creating a new route/page in the application

---

#### `/modals/` - Full Modal Dialogs
**Purpose**: Complete modal dialogs with backdrop, open/close logic, and full UI

**Characteristics**:
- Self-contained modal with backdrop
- Open/close state management
- Form submission logic
- Uses `@/components/ui/dialog` internally

**Examples**:
- `ProjectModal.tsx` - Project creation/editing modal
- `EventModal.tsx` - Calendar event modal
- `HolidayModal.tsx` - Holiday creation modal
- `StandardModal.tsx` - Base modal template

**Naming convention**: `*Modal.tsx`

**When to use**: Creating a full modal dialog that can be opened/closed

**Note**: For modal content sections, use feature-specific `/sections/` folders

---

#### `/layout/` - App Layout Components
**Purpose**: Application-wide layout structure

**Characteristics**:
- Used across all pages
- Navigation, headers, sidebars
- Page structure containers

**Examples**:
- `MainAppLayout.tsx` - Main app container with routes
- `Sidebar.tsx` - Navigation sidebar
- `AppHeader.tsx` - Top header bar
- `AppPageLayout.tsx` - Page wrapper with consistent padding

**When to use**: Creating layout components used across multiple pages

---

#### `/timeline/` - Timeline Feature
**Purpose**: All components related to timeline/scheduling view

**Characteristics**:
- Timeline-specific functionality
- Project bars, rows, groups
- Date headers, availability indicators
- Drag-and-drop functionality

**Examples**:
- `TimelineBar.tsx` - Project bar on timeline
- `TimelineSidebar.tsx` - Left sidebar with project names
- `AddProjectRow.tsx` - Row for adding projects
- `SmartHoverAddHolidayBar.tsx` - Holiday creation overlay

**When to use**: Adding timeline-specific components

---

#### `/projects/` - Project Management
**Purpose**: Project-related components organized by usage

**Subdirectories**:
- `/bar/` - Components that appear in timeline rows
- `/sections/` - Reusable sections used inside ProjectModal

**Examples**:
```
/bar/
  - DraggableProjectRow.tsx - Draggable project in list
  - SmartHoverAddProjectBar.tsx - Drag-to-create project
  - ProjectMilestones.tsx - Milestone indicators

/sections/
  - ProjectMilestoneSection.tsx - Milestone editor (used in modal)
  - ProjectInsightsSection.tsx - Project stats (used in modal)
  - ProjectNotesSection.tsx - Notes editor (used in modal)
```

**When to use**:
- `/bar/` - Creating timeline row components
- `/sections/` - Creating reusable modal content sections

**Note**: Full modals go in `/modals/`, not here

---

#### `/planner/` - Calendar/Planner Feature
**Purpose**: Calendar view components

**Examples**:
- `DailyProjectSummaryRow.tsx` - Daily project breakdown
- `HoverablePlannerDateCell.tsx` - Interactive date cells
- `PlannerInsightCard.tsx` - Calendar insights widget

**When to use**: Adding calendar/planner-specific components

---

#### `/insights/` - Analytics & Insights
**Purpose**: Data visualization and analytics components

**Examples**:
- `TimeAnalysisChart.tsx` - Time analysis visualizations
- `AverageDayHeatmapCard.tsx` - Heatmap widgets
- `FilterModal.tsx` - Insights filter dialog

**When to use**: Creating analytics dashboards and data visualizations

---

#### `/work-hours/` - Time Tracking
**Purpose**: Time tracking and work session components

**Examples**:
- `TimeTracker.tsx` - Active time tracking widget
- `DraggableWorkHour.tsx` - Work session blocks
- `WorkHourCreator.tsx` - Create work sessions

**When to use**: Adding time tracking functionality

---

#### `/settings/` - Settings Components
**Purpose**: Settings page components

**Examples**:
- `SettingsView.tsx` - Settings page container
- `CalendarImport.tsx` - Calendar integration settings

**When to use**: Adding settings UI

**Note**: Consider moving `SettingsView.tsx` to `/views/` for consistency

---

#### `/dialog/` - Confirmation Dialogs
**Purpose**: Small confirmation dialogs (not full modals)

**Examples**:
- `RecurringUpdateDialog.tsx` - Recurring event update confirmation
- `RecurringDeleteDialog.tsx` - Recurring event delete confirmation

**When to use**: Creating simple yes/no confirmation dialogs

**Difference from `/modals/`**: Dialogs are simpler, focused on confirmation actions

---

#### `/debug/` - Development Tools
**Purpose**: Development and debugging components (not in production)

**Examples**:
- `ErrorBoundary.tsx` - Error boundary with retry/reload
- `DevTools.tsx` - Developer tools panel
- `PerformanceStatus.tsx` - Performance monitoring

**When to use**: Creating development-only tools

---

## 🎨 Component Naming Conventions

### File Naming
- **PascalCase**: `TimelineView.tsx`, `ProjectModal.tsx`
- **Descriptive**: Name should clearly indicate component purpose
- **Feature-scoped**: Include feature name when needed (e.g., `TimelineBar`, `PlannerInsightCard`)

### Component Type Suffixes
- `*View` - Page-level components (e.g., `TimelineView`)
- `*Modal` - Full modal dialogs (e.g., `ProjectModal`)
- `*Dialog` - Simple confirmation dialogs (e.g., `RecurringUpdateDialog`)
- `*Section` - Modal sections (e.g., `ProjectMilestoneSection`)
- `*Bar` - Bar/row components (e.g., `TimelineBar`)
- `*Card` - Card widgets (e.g., `PlannerInsightCard`)
- `*Layout` - Layout containers (e.g., `AppPageLayout`)

### Barrel Exports
Every directory should have an `index.ts` that exports all components:

```typescript
// Good: Feature barrel export
export { TimelineView } from './TimelineView';
export { TimelineBar } from './TimelineBar';
export { TimelineSidebar } from './TimelineSidebar';

// Bad: No barrel export, forcing direct imports
```

---

## 📦 Import Patterns

### Always Use Barrel Imports
```typescript
// ✅ CORRECT - Import from barrel
import { TimelineView, ProjectModal, ErrorBoundary } from '@/components';

// ❌ WRONG - Direct file import
import { TimelineView } from '@/components/views/TimelineView';
```

### Use `@/` Alias (Never `../../../`)
```typescript
// ✅ CORRECT - Absolute import with alias
import { ProjectRules } from '@/domain/rules/ProjectRules';
import { UnifiedProjectService } from '@/services';

// ❌ WRONG - Relative imports
import { ProjectRules } from '../../../domain/rules/ProjectRules';
```

---

## 🏗️ Architecture Principles

### 1. **Single Responsibility**
Each component should do one thing well. If a component grows beyond 500 lines, consider splitting it.

### 2. **Feature Encapsulation**
Keep related components together in feature folders. A feature folder should be self-contained.

### 3. **Composition Over Inheritance**
Build complex components by composing simpler ones, not through inheritance.

### 4. **Props Over Configuration**
Make components configurable through props rather than hard-coded behavior.

### 5. **No Business Logic in Components**
Components should render UI and handle interactions. Business logic belongs in:
- `/domain/rules/` - Business rules and validation
- `/services/unified/` - Calculations and transformations
- `/services/orchestrators/` - Complex workflows

### 6. **Consistent Styling**
- Use Tailwind CSS classes
- Follow shadcn/ui patterns
- Keep styles co-located with components

---

## 🔄 Component Lifecycle Best Practices

### State Management
```typescript
// ✅ GOOD - Local state for UI-only concerns
const [isOpen, setIsOpen] = useState(false);

// ✅ GOOD - Context for feature-wide state
const { projects, addProject } = useProjectContext();

// ❌ BAD - Prop drilling through many levels
<Child1 data={data} onUpdate={onUpdate}>
  <Child2 data={data} onUpdate={onUpdate}>
    <Child3 data={data} onUpdate={onUpdate} />
  </Child2>
</Child1>
```

### Side Effects
```typescript
// ✅ GOOD - Clear dependency array
useEffect(() => {
  fetchData(projectId);
}, [projectId]);

// ❌ BAD - Missing dependencies
useEffect(() => {
  fetchData(projectId);
}, []); // projectId not in deps!
```

### Event Handlers
```typescript
// ✅ GOOD - Descriptive handler names
const handleProjectClick = (projectId: string) => { ... };
const handleDateChange = (date: Date) => { ... };

// ❌ BAD - Generic handler names
const onClick = () => { ... };
const handleChange = () => { ... };
```

---

## 📝 Documentation Standards

### Component Comments
```typescript
/**
 * TimelineBar - Displays a project as a colored bar on the timeline
 * 
 * Features:
 * - Drag to reposition project dates
 * - Resize to adjust duration
 * - Click to open project modal
 * - Shows project name and milestone indicators
 * 
 * @param project - Project to display
 * @param dates - Visible date range
 * @param mode - Display mode ('days' or 'weeks')
 */
export function TimelineBar({ project, dates, mode }: TimelineBarProps) {
  // ...
}
```

### Complex Logic Comments
```typescript
// Calculate project bar position accounting for:
// 1. Viewport scroll offset
// 2. Day/week column width
// 3. Project start date relative to viewport start
const barLeft = calculateBarPosition(project, viewport, mode);
```

---

## 🧪 Testing Guidelines

### Component Tests Should Cover
1. **Rendering** - Component renders without errors
2. **Props** - All required props work correctly
3. **Interactions** - Click handlers, form submissions work
4. **States** - Loading, error, success states display correctly
5. **Edge Cases** - Empty data, long text, extreme values

### Test File Location
- Co-locate tests: `TimelineBar.test.tsx` next to `TimelineBar.tsx`
- Or use `/src/test/components/` for centralized tests

---

## 🔍 Code Review Checklist

Before submitting component changes:

- [ ] Component is in the correct directory
- [ ] File name follows conventions (`PascalCase`, correct suffix)
- [ ] Exported through barrel export (`index.ts`)
- [ ] Uses `@/` imports (no `../../../`)
- [ ] Props have TypeScript types
- [ ] No business logic in component (moved to services/domain)
- [ ] Consistent styling (Tailwind, shadcn patterns)
- [ ] Descriptive handler names
- [ ] Comments for complex logic
- [ ] No console.logs left in code
- [ ] Build succeeds (`npm run build`)
- [ ] No TypeScript errors

---

## 🎯 Common Patterns

### Modal Pattern
```typescript
// 1. Create modal in /modals/
export function MyModal({ isOpen, onClose, itemId }: MyModalProps) {
  // 2. Use sections from feature /sections/ folder
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <MySectionComponent itemId={itemId} />
      </DialogContent>
    </Dialog>
  );
}

// 3. Open modal from view
const [isModalOpen, setIsModalOpen] = useState(false);
<MyModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
```

### Drag-and-Drop Pattern
```typescript
// 1. Use react-dnd hooks
const [{ isDragging }, drag] = useDrag({
  type: 'PROJECT',
  item: { id: project.id },
  collect: (monitor) => ({
    isDragging: monitor.isDragging()
  })
});

// 2. Apply ref to draggable element
<div ref={drag} className={isDragging ? 'opacity-50' : ''}>
  {/* content */}
</div>
```

### Form Pattern
```typescript
// 1. Use react-hook-form
const form = useForm<FormValues>({
  defaultValues: { ... }
});

// 2. Validate with domain rules
const onSubmit = async (data: FormValues) => {
  const validation = ProjectRules.validate(data);
  if (!validation.isValid) {
    // Show errors
    return;
  }
  // Submit via orchestrator
  await ProjectOrchestrator.createProject(data);
};
```

---

## 🚀 Performance Optimization

### When to Use `memo()`
```typescript
// ✅ GOOD - Expensive component with stable props
export const TimelineBar = memo(function TimelineBar({ project, dates }) {
  // Complex calculations...
});

// ❌ BAD - Simple component, no benefit
export const Button = memo(function Button({ label }) {
  return <button>{label}</button>;
});
```

### When to Use `useMemo()`
```typescript
// ✅ GOOD - Expensive calculation
const sortedProjects = useMemo(() => {
  return projects.sort((a, b) => a.startDate - b.startDate);
}, [projects]);

// ❌ BAD - Simple operation
const projectName = useMemo(() => project.name.toUpperCase(), [project]);
```

### Lazy Loading
```typescript
// ✅ GOOD - Lazy load large view components
const InsightsView = React.lazy(() => 
  import('./views/InsightsView').then(m => ({ default: m.InsightsView }))
);
```

---

## 📚 References

- **Architecture Guide**: `/Architecture Guide.md` - Services architecture and patterns
- **Business Logic Reference**: `/docs/BUSINESS_LOGIC_REFERENCE.md` - Domain rules
- **Cleanup Summary**: `/docs/COMPONENTS_CLEANUP_SUMMARY.md` - Recent improvements

---

## 🆕 Recent Changes (October 2025)

### Components Cleanup Phase 1 ✅
- Removed duplicate `ErrorBoundary.tsx` (kept debug version)
- Removed empty `insights/InsightsView.tsx`
- Removed unused `HoverAddProjectBar.tsx`
- Created `/shared/` directory with `SmartHoverAddBar.tsx`
- Renamed `/projects/modal/` → `/projects/sections/`

### Benefits Achieved
- **Single source of truth** for ErrorBoundary
- **Eliminated dead code** (162 lines removed)
- **Foundation for reuse** (234-line shared base component)
- **Clearer naming** (sections vs modals)

---

**Maintained by**: Development Team  
**Questions?** Refer to Architecture Guide or ask in team chat
