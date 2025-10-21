# Client-Group-Label System Specification

**Date:** October 21, 2025
**Status:** ✅ **BACKEND IMPLEMENTED** | ⏳ **UI IN PROGRESS**
**Implementation:** See `docs/CLIENT_GROUP_LABEL_IMPLEMENTATION.md` for details
**Business Logic:** ✅ All decisions made
**Technical Specification:** ✅ Complete
**Database Migration:** ✅ Complete (20251021122309)
**React Hooks:** ✅ Complete (useClients, useLabels)
**Next Step:** Build UI components for client/label management

---

## Executive Summary

This specification defines the client-group-label system to replace the current group-row-project hierarchy. The system introduces proper client management while maintaining optional grouping and adding flexible labeling.

**Key Changes:**
- Projects belong to clients (required, immutable)
- Pr## 10. Open Questions & Decisions Needed

### Technical:
1. **Performance impact assessment for many-to-many label relationships?**

### UX:
1. **Default client selection behavior in UI?** 🎯 *To be determined - will work on this*
2. **Label autocomplete vs manual entry?**
3. **How to display client/group/label info in project lists?**g to groups (optional, exclusive)
- Projects can have labels (optional, multiple)
- Groups simplified (name only)
- Labels are user-specific flexible tags

---

## 1. Entity Specifications

### 1.1 Client Entity

**Purpose:** Represents organizations or individuals that commission work.

**Attributes:**
```typescript
interface Client {
  id: string;                    // UUID primary key
  userId: string;               // Owner reference
  name: string;                 // Required, 1-100 chars
  status: ClientStatus;         // NEW: active | inactive | archived
  contactEmail?: string;        // Optional contact info
  contactPhone?: string;
  billingAddress?: string;
  notes?: string;               // Additional client notes
  createdAt: Date;
  updatedAt: Date;
}
```

**Business Rules:**
- **Required for Projects:** Every project must have exactly one client
- **Immutable Assignment:** Projects cannot change clients once created
- **Deletion Behavior:** Deleting a client removes the entity but projects retain the client name as a string
- **Status Management:** Clients can be active, inactive, or archived
- **Uniqueness:** Client names must be unique per user

**Status Definitions:**
- `active`: Current client, can create new projects
- `inactive`: Former client, existing projects remain
- `archived`: Historical client, hidden from most views

### 1.2 Group Entity (Simplified)

**Purpose:** High-level organizational categories for projects.

**Attributes:**
```typescript
interface Group {
  id: string;          // UUID primary key
  userId: string;     // Owner reference
  name: string;       // Required, 1-50 chars, unique per user
  createdAt: Date;
  updatedAt: Date;
}
```

**Business Rules:**
- **Optional Membership:** Projects can exist without groups
- **Exclusive Membership:** Projects can belong to at most one group
- **Deletion Behavior:** When group deleted, projects become groupless
- **Optional Cascade:** User may be prompted to delete projects when deleting group
- **No Hierarchy:** Flat structure, no sub-groups

### 1.3 Label Entity

**Purpose:** Flexible text tags for project categorization and filtering.

**Attributes:**
```typescript
interface Label {
  id: string;          // UUID primary key
  userId: string;     // Owner reference
  name: string;       // Required, 1-30 chars, unique per user
  color?: string;     // Optional hex color
  createdAt: Date;
  updatedAt: Date;
}
```

**Business Rules:**
- **User-Specific:** Labels are scoped to individual users
- **Unique Names:** No duplicate label names per user
- **Optional Colors:** Visual distinction for labels
- **Flexible Assignment:** Projects can have multiple labels
- **Safe Deletion:** Labels can be deleted without affecting projects

### 1.4 Project Entity (Updated)

**Updated Attributes:**
```typescript
interface Project {
  id: string;
  name: string;
  clientId: string;          // NEW: Required client reference
  startDate: Date;
  endDate: Date;
  estimatedHours: number;
  color: string;
  groupId?: string;          // CHANGED: Optional group reference
  rowId?: string;            // DEPRECATED: Will be removed
  notes?: string;
  icon?: string;
  milestones?: Milestone[];
  continuous?: boolean;
  status?: ProjectStatus;
  autoEstimateDays?: { monday: boolean; tuesday: boolean; wednesday: boolean; thursday: boolean; friday: boolean; saturday: boolean; sunday: boolean; };
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Business Rules:**
- **Client Required:** Must have valid clientId
- **Group Optional:** Can have groupId or be null
- **Label Flexible:** Can have zero or more labels via junction table

---

## 2. Relationship Specifications

### 2.1 Client-Project Relationship

**Structure:** One-to-Many (1 Client : N Projects)

**Constraints:**
- Project.clientId must reference existing Client.id
- Client cannot be deleted if it has projects (unless cascade approved)
- Project creation requires client selection

**Edge Cases:**
- **Client Deleted:** Projects retain client name, clientId becomes orphaned
- **Orphaned Projects:** System should handle missing client entities gracefully
- **Client Status:** Project creation limited to active clients

### 2.2 Group-Project Relationship

**Structure:** One-to-Many (1 Group : N Projects), Optional

**Constraints:**
- Project.groupId can be null or reference existing Group.id
- Groups can exist without projects
- Projects can exist without groups

**Edge Cases:**
- **Group Deleted:** Projects set groupId to null
- **Cascade Option:** User prompted "Delete group and all projects?" vs "Remove group, keep projects"
- **Group Renamed:** All associated projects reflect new group name

### 2.3 Label-Project Relationship

**Structure:** Many-to-Many via Junction Table

**Junction Table:**
```sql
CREATE TABLE project_labels (
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  label_id UUID REFERENCES labels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, label_id)
);
```

**Constraints:**
- Labels are user-scoped, so project_labels only connects user's projects to user's labels
- Duplicate assignments prevented by primary key
- Cascade delete when project or label deleted

**Edge Cases:**
- **Label Deleted:** Project loses that label, no other impact
- **Project Deleted:** All label associations removed
- **Label Renamed:** All associations reflect new name

---

## 3. Business Logic Rules

### 3.1 Client Business Rules

**Creation:**
- Name required, unique per user
- Default status: active
- Contact info optional

**Modification:**
- Name can be changed (affects project displays) ✅ **DECIDED: Yes, update displays**
- Status can change (active ↔ inactive ↔ archived)
- Contact info can be updated

**Deletion:**
- Cannot delete if client has projects
- Option to cascade delete projects (with confirmation)
- Soft delete: set status to archived instead

**Project Creation:**
- Only active clients shown in client selection ✅ **DECIDED: Archived clients hidden**

### 3.2 Group Business Rules

**Creation:**
- Name required, unique per user
- Simple text validation

**Modification:**
- Name can be changed
- Affects all associated projects

**Deletion:**
- Can delete if no projects (safe)
- With projects: **Always prompt user** ✅ **DECIDED: Option A - Always Prompt**
  - "Delete group only (projects become ungrouped)"
  - "Delete group and all projects" (with confirmation)

**Cascade Behavior Explanation:**
When deleting a group that contains projects, **always prompt user** to choose:
1. **Keep Projects:** Remove the group assignment from all projects (they become "ungrouped")
2. **Delete Projects:** Delete the group AND all projects that belong to it

### 3.3 Label Business Rules

**Creation:**
- Name required, unique per user
- Color optional (defaults to neutral)
- Case-insensitive uniqueness

**Modification:**
- Name can be changed
- Color can be updated
- Affects all associated projects

**Deletion:**
- Always safe (no cascade needed)
- Simply removes associations

### 3.4 Project Business Rules

**Creation:**
- Must select existing client or create new one
- Group optional during creation
- Labels can be added post-creation

**Modification:**
- Client cannot be changed
- Group can be added/removed/changed
- Labels can be added/removed

**Deletion:**
- Standard project deletion rules apply
- Removes all label associations

---

## 4. Migration Strategy Options

### 4.1 Client Migration Options

**Option A: Automatic Entity Creation**
- Scan existing `projects.client` strings
- Create Client entities for each unique client name
- Set all clients to 'active' status
- Update projects to reference new client entities

**Pros:** Fully automated, preserves all data
**Cons:** May create unwanted client entities, requires cleanup

**Option B: Manual Client Creation**
- Require user to create clients before migration
- Prompt user to map existing client strings to new clients
- Handle unmapped projects (create default client?)

**Pros:** User control, clean data
**Cons:** Manual effort, potential data loss

**Option C: Hybrid Approach**
- Auto-create clients from existing data
- Allow user to merge/consolidate clients post-migration
- Set auto-created clients to 'imported' status for review

**Recommendation:** Option C - balances automation with user control

### 4.2 Migration Rollback Strategy

**Decision:** No formal rollback strategy needed ✅ **DECIDED: Keep moving forward**

**Rationale:** Limited data in database, prefer forward momentum over rollback complexity

**Minimal Safety Measures:**
- Database backup before migration (standard practice)
- Test migration on development environment first
- Gradual feature rollout to catch issues early

### 4.2 Group Migration Options

**Option A: Preserve Existing Groups**
- Keep existing groups as-is
- Remove row relationships
- Make group membership optional

**Pros:** No data loss, maintains organization
**Cons:** May keep unwanted groups

**Option B: Clean Slate**
- Archive all existing groups
- Start fresh with new group system

**Pros:** Clean start
**Cons:** Loses existing organization

**Recommendation:** Option A - preserve user organization, allow cleanup later

### 4.3 Row Removal Strategy

**Current State:** Projects → Rows → Groups (required hierarchy)

**Migration Steps:**
1. Make rowId optional in projects
2. Create data integrity check (no orphaned projects)
3. Remove row references from projects
4. Optionally archive rows table (for rollback)

**Recommendation:** Gradual removal with safety checks

---

## 5. Data Integrity & Validation

### 5.1 Relationship Validation Rules

**Client-Project Validation:**
```typescript
// Project must have valid client
if (!project.clientId) {
  errors.push("Project must belong to a client");
}

// Client must exist and be accessible
const client = await getClient(project.clientId);
if (!client) {
  errors.push("Project client does not exist");
}
```

**Group-Project Validation:**
```typescript
// Group is optional but must be valid if present
if (project.groupId) {
  const group = await getGroup(project.groupId);
  if (!group) {
    errors.push("Project group does not exist");
  }
}
```

**Label-Project Validation:**
```typescript
// Labels must exist and be user-owned
for (const labelId of project.labelIds) {
  const label = await getLabel(labelId);
  if (!label || label.userId !== project.userId) {
    errors.push(`Invalid label: ${labelId}`);
  }
}
```

### 5.2 System Integrity Checks

**Orphaned Entity Detection:**
- Projects without valid clients
- Projects with invalid group references
- Projects with invalid label references

**Cascade Impact Analysis:**
- What breaks if client deleted?
- What breaks if group deleted?
- What breaks if label deleted?

---

## 6. UI/UX Considerations

### 6.1 Project Creation Flow

**Client Selection:**
1. User creates new project
2. Client selection required:
   - Dropdown of existing active clients
   - "Create New Client" option
3. Client creation modal if needed

**Group Assignment:**
- Optional dropdown during project creation
- Can be skipped or set later

**Label Assignment:**
- Post-creation feature
- Tag-style interface for adding/removing labels

### 6.2 Visual Distinctions

**Icons & Styling:**
- Clients: Building/company icon
- Groups: Folder/category icon
- Labels: Tag icon

**Color Coding:**
- Clients: Use assigned colors
- Groups: System-assigned colors
- Labels: User-defined colors

### 6.3 Navigation & Organization

**Client Views:**
- List all clients with project counts
- Filter projects by client
- Client status management

**Group Views:**
- List groups with project counts
- Drag-drop project assignment
- Group management (create/delete)

**Label Views:**
- Tag cloud with usage counts
- Filter projects by labels
- Label management (create/delete/color)

---

## 7. Implementation Phases

### Phase 1: Database & Types (Week 1-2)
- Create migration for new tables
- Update TypeScript interfaces
- Add domain rules

### Phase 2: Data Migration (Week 2-3)
- Migrate existing data
- Implement integrity checks
- Handle edge cases

### Phase 3: Services & Orchestrators (Week 3-4)
- Update business logic
- Add new workflows
- Implement validation

### Phase 4: UI Implementation (Week 4-6)
- Client management interface
- Group/label management
- Project creation updates

### Phase 5: Testing & Polish (Week 6-7)
- Integration testing
- User acceptance testing
- Performance optimization

---

## 8. Risk Assessment & Mitigation

### High Risk Items:
1. **Data Migration:** Potential data loss during client/group migration
2. **UI Complexity:** Three different organization systems may confuse users
3. **Backward Compatibility:** Existing features must continue working

### Mitigation Strategies:
1. **Migration:** Comprehensive testing, rollback plans, data backups
2. **UI:** Clear visual distinctions, progressive disclosure, help documentation
3. **Compatibility:** Feature flags, gradual rollout, extensive testing

---

## 9. Success Criteria

### Functional Requirements:
- ✅ Projects require and keep client assignment
- ✅ Projects can optionally belong to one group
- ✅ Projects can have multiple labels
- ✅ Clients, groups, and labels can be managed independently
- ✅ Existing projects migrate successfully

### Non-Functional Requirements:
- ✅ System maintains data integrity
- ✅ UI is intuitive and discoverable
- ✅ Performance impact is minimal
- ✅ Backward compatibility maintained

---

## 10. Open Questions & Decisions Needed

### Business Logic:
1. Should archived clients be hidden from project creation?
2. How to handle client name changes (update project displays)?
3. Should group deletion cascade be the default or optional?

### Technical:
1. Migration rollback strategy?
2. Performance impact of many-to-many label relationships?
3. API design for bulk label operations?

### UX:
1. Default client selection behavior?
2. Label autocomplete vs manual entry?
3. How to display client/group/label info in project lists?

---

## 11. Timeline View Migration Impact

### **Current Timeline Structure (Will Break)**
The timeline view currently requires the Groups → Rows → Projects hierarchy:

```
TimelineSidebar: Groups → Rows (draggable)
TimelineView: Groups → Rows → Projects (filtered by groupId + rowId)
Project Creation: Requires rowId for placement
```

### **Migration Phases & Timeline Impact**

#### **Phase 1: Database Migration (Safe)**
- ✅ Projects still have `groupId` and `rowId` 
- ✅ Timeline view continues working normally
- ✅ No UI changes needed yet

#### **Phase 2: Make Groups Optional (Breaking)**
- ⚠️ Projects can have `groupId = null`
- ❌ **Timeline Issue**: Ungrouped projects won't appear anywhere
- ❌ **Solution Needed**: Add "Ungrouped Projects" section to timeline

#### **Phase 3: Remove Rows (Major Breaking)**
- ❌ **Timeline Issue**: Entire row-based layout system breaks
- ❌ **Project Creation Issue**: `handleCreateProject(rowId, ...)` won't work
- ❌ **Drag & Drop Issue**: Row-based positioning fails
- ❌ **Solution Needed**: Complete timeline view rewrite

### **Timeline View Rewrite Requirements**

#### **New Structure Options**

**Option A: Client-Based Organization**
```
Clients → Projects (grouped by client)
├── Client A Projects
├── Client B Projects  
└── Ungrouped Projects
```

**Option B: Group-Based with Ungrouped Section**
```
Groups → Projects (direct relationship)
├── Group A Projects
├── Group B Projects
├── Ungrouped Projects (groupId = null)
└── Unassigned Projects (clientId = null - error state)
```

**Option C: Flat List with Filters**
```
All Projects (single scrollable list)
- Filter by: Client, Group, Labels
- Sort by: Client, Group, Start Date, etc.
```

#### **Chosen Approach: Option A - Group-Based with Ungrouped Section** ✅ **DECIDED**
```
Groups → Projects (direct relationship)
├── Group A Projects
├── Group B Projects
├── Ungrouped Projects (groupId = null)
└── Add Group Section
```

**Why Option A:**
- Maintains visual grouping users expect
- Adds "Ungrouped Projects" section for projects without groups
- Preserves drag-and-drop within groups
- Allows gradual migration

### **Implementation Strategy**

#### **Phase 2 Implementation (Groups Optional)**
1. Add "Ungrouped Projects" section to timeline
2. Filter: `projects.filter(p => !p.groupId)`
3. Maintain same row height/layout for consistency

#### **Phase 3 Implementation (Remove Rows)**
1. Remove row-based filtering: `project.rowId === row.id`
2. Change to direct group filtering: `project.groupId === group.id`
3. Update drag-and-drop to work within groups only
4. Update project creation to specify group instead of row
5. Remove row management UI (AddRowComponent, DraggableRowComponent)

### **Migration Timeline**

```
Week 1-2: Database migration (timeline works)
Week 3:   Make groups optional + add ungrouped section
Week 4:   Remove rows + update timeline layout
Week 5:   Update project creation + drag-drop
Week 6:   Testing & cleanup
```

### **Risk Mitigation**
- **Feature Flags**: Hide new timeline until fully working
- **Backward Compatibility**: Keep old row system working during transition
- **Gradual Rollout**: Test with subset of users first
- **Rollback Plan**: Can revert database changes if timeline breaks

---

**Document Status:** ✅ **COMPLETE - Ready for Implementation**
**Business Logic:** ✅ All decisions made
**Technical Specification:** ✅ Complete
**Timeline Impact:** ✅ Analyzed and planned
**Timeline Structure:** ✅ Option A chosen (Group-Based with Ungrouped Section)
**Next Step:** Begin Phase 1 - Database & Types</content>
<parameter name="filePath">/Users/andyjohnston/project-content-vault/CLIENT_GROUP_LABEL_SPECIFICATION.md
