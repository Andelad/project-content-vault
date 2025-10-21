# Client-Group-Label System Implementation

**Date:** October 21, 2025  
**Status:** ✅ **IMPLEMENTED** - Database & Backend Complete, UI In Progress  
**Reference:** `CLIENT_GROUP_LABEL_SPECIFICATION.md` (now archived)

---

## Implementation Summary

### **What Changed**

The application migrated from a rigid **Groups → Rows → Projects** hierarchy to a flexible **Clients ⟷ Projects ⟷ Groups ⟷ Labels** system.

**Before:**
```
Groups (required) → Rows (required) → Projects
Projects.client = string field
```

**After:**
```
Clients (required) ⟷ Projects (required relationship)
Groups (optional) ⟷ Projects (optional relationship)
Labels (many-to-many) ⟷ Projects (flexible tagging)
```

---

## Database Changes

### **New Tables**

#### **1. clients**
```sql
CREATE TABLE public.clients (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  contact_email TEXT,
  contact_phone TEXT,
  billing_address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);
```

**Purpose:** Represents organizations or individuals that commission work

**Business Rules:**
- Required for all projects
- Cannot delete client if projects exist (RESTRICT constraint)
- Status: active (can create projects), inactive (no new projects), archived (hidden)

#### **2. labels**
```sql
CREATE TABLE public.labels (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);
```

**Purpose:** Flexible text tags for categorization and filtering

**Business Rules:**
- Optional for projects
- User-scoped (unique per user)
- Safe to delete (CASCADE removes associations only)

#### **3. project_labels** (Junction Table)
```sql
CREATE TABLE public.project_labels (
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  label_id UUID REFERENCES labels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, label_id)
);
```

**Purpose:** Many-to-many relationship between projects and labels

**Business Rules:**
- Cascade delete when project or label deleted
- No orphaned associations

### **Modified Tables**

#### **projects**
```sql
-- Added column
ALTER TABLE projects ADD COLUMN client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT;

-- Made optional
ALTER TABLE projects ALTER COLUMN group_id DROP NOT NULL;
ALTER TABLE projects ALTER COLUMN row_id DROP NOT NULL;
```

**Changes:**
- `client_id`: NEW required field, links to clients table
- `group_id`: CHANGED from required to optional
- `row_id`: DEPRECATED (kept for backward compatibility, will be removed later)

#### **groups** (Simplified)
```sql
-- Removed unnecessary columns
ALTER TABLE groups DROP COLUMN IF EXISTS description;
ALTER TABLE groups DROP COLUMN IF EXISTS color;
```

**Changes:**
- Simplified to just `name` field
- Removed visual/descriptive fields

---

## Data Migration

### **Migration Script** (20251021122309)

**Step 1:** Create new tables with RLS policies and indexes

**Step 2:** Migrate existing client strings to Client entities
```sql
-- Extract unique clients from projects.client strings
INSERT INTO clients (user_id, name, status)
SELECT DISTINCT user_id, client, 'active'
FROM projects
WHERE client IS NOT NULL AND client != '';

-- Link projects to their clients
UPDATE projects p
SET client_id = c.id
FROM clients c
WHERE p.user_id = c.user_id AND p.client = c.name;
```

**Step 3:** Update constraints
- Make `client_id` required (NOT NULL)
- Add RESTRICT foreign key (prevent client deletion with projects)
- Make `group_id` and `row_id` optional

**Result:** All existing projects successfully linked to clients

---

## TypeScript Changes

### **New Interfaces** (`src/types/core.ts`)

```typescript
export type ClientStatus = 'active' | 'inactive' | 'archived';

export interface Client {
  id: string;
  userId: string;
  name: string;
  status: ClientStatus;
  contactEmail?: string;
  contactPhone?: string;
  billingAddress?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Label {
  id: string;
  userId: string;
  name: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  // ... existing fields ...
  clientId: string;           // NEW: Required
  groupId?: string | null;    // CHANGED: Optional
  rowId?: string | null;      // DEPRECATED
  
  // Populated by joins
  clientData?: Client;
  labels?: Label[];
}
```

### **Updated Supabase Types** (`src/integrations/supabase/types.ts`)

Full type definitions added for:
- `clients` table (Row, Insert, Update)
- `labels` table (Row, Insert, Update)
- `project_labels` junction (Row, Insert, Update)
- Updated `projects` table with new fields

---

## React Hooks

### **useClients Hook** (`src/hooks/useClients.ts`)

```typescript
export function useClients(): UseClientsReturn {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Methods:
  // - fetchClients()
  // - addClient(clientData)
  // - updateClient(id, updates)
  // - deleteClient(id)
  // - refetch()
  
  // Real-time subscription to client changes
  // Automatic sorting by name
  // Error handling with toast notifications
}
```

**Features:**
- Full CRUD operations
- Real-time Supabase subscriptions
- Error handling with user feedback
- Automatic re-fetching
- Loading states

### **useLabels Hook** (`src/hooks/useLabels.ts`)

```typescript
export function useLabels(): UseLabelsReturn {
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Label CRUD:
  // - fetchLabels()
  // - addLabel(labelData)
  // - updateLabel(id, updates)
  // - deleteLabel(id)
  
  // Project-Label associations:
  // - addLabelToProject(projectId, labelId)
  // - removeLabelFromProject(projectId, labelId)
  // - getProjectLabels(projectId)
  // - refetch()
  
  // Real-time subscription to label changes
}
```

**Features:**
- Full CRUD operations for labels
- Project-label association management
- Real-time Supabase subscriptions
- Error handling with toast notifications
- Fetches labels with project counts

---

## Business Rules

### **Client Rules**

**Creation:**
- Name required (1-100 chars), unique per user
- Default status: 'active'
- Contact info optional

**Modification:**
- Name can be changed (affects project displays)
- Status can change (active ↔ inactive ↔ archived)
- Contact info can be updated

**Deletion:**
- Cannot delete if client has projects (RESTRICT constraint enforced by database)
- Alternative: Archive client (status = 'archived')

**Project Creation:**
- Only active clients shown in selection

### **Label Rules**

**Creation:**
- Name required (1-30 chars), unique per user
- Color optional (defaults to neutral gray)
- Case-insensitive uniqueness

**Modification:**
- Name can be changed
- Color can be updated
- Changes affect all associated projects

**Deletion:**
- Always safe (cascade removes associations only)
- No impact on projects themselves

### **Group Rules** (Updated)

**Creation:**
- Name required (1-50 chars), unique per user
- No description or color (simplified)

**Modification:**
- Name can be changed
- Affects all associated projects

**Deletion:**
- Prompt user for action:
  - "Keep Projects" (set groupId to null)
  - "Delete Projects" (cascade delete with confirmation)

### **Project Rules** (Updated)

**Creation:**
- Must select existing client or create new one (required)
- Group optional during creation
- Labels can be added post-creation

**Modification:**
- Client can be changed (business decision: allowed)
- Group can be added/removed/changed
- Labels can be added/removed

**Deletion:**
- Standard project deletion rules apply
- Removes all label associations (cascade)

---

## Domain Layer Updates

### **Recommended Domain Rules** (To Be Implemented)

```typescript
// src/domain/rules/ClientRules.ts
export class ClientRules {
  static validateClientName(name: string): ValidationResult {
    // Name must be 1-100 chars
  }
  
  static canDeleteClient(clientId: string, projectCount: number): boolean {
    // Can't delete if has projects
  }
  
  static filterActiveClients(clients: Client[]): Client[] {
    // Return only active clients
  }
}

// src/domain/rules/LabelRules.ts
export class LabelRules {
  static validateLabelName(name: string): ValidationResult {
    // Name must be 1-30 chars
  }
  
  static normalizeLabelName(name: string): string {
    // Trim and lowercase for comparison
  }
}

// src/domain/rules/RelationshipRules.ts (Update)
export class RelationshipRules {
  static validateProjectClient(project: Project): ValidationResult {
    // Project must have valid clientId
  }
  
  static validateProjectLabels(project: Project, labels: Label[]): ValidationResult {
    // Labels must exist and belong to user
  }
}
```

---

## UI Components

### **✅ Completed**
- Updated project modal milestone section
- Updated projects view components
- Simplified group orchestrator
- Added client/label hooks

### **⏳ In Progress / TODO**
- [ ] Client management interface
- [ ] Label management interface  
- [ ] Client selector in project creation
- [ ] Label selector/tags in project forms
- [ ] Display clients/labels in project cards
- [ ] Filter by client/label in project list
- [ ] Timeline view updates (remove row dependency)

---

## Testing & Verification

### **Database Verification**

```sql
-- Verify all projects have client_id
SELECT COUNT(*) FROM projects WHERE client_id IS NULL;
-- Should return 0

-- Verify client count matches unique project clients
SELECT 
  (SELECT COUNT(DISTINCT client) FROM projects WHERE client IS NOT NULL) as old_count,
  (SELECT COUNT(*) FROM clients) as new_count;
-- Should match

-- Check for orphaned labels
SELECT l.* FROM labels l
LEFT JOIN project_labels pl ON pl.label_id = l.id
WHERE pl.label_id IS NULL;
-- Shows unused labels (ok to exist)
```

### **Application Testing**

- [x] TypeScript compilation clean
- [x] Database migration successful
- [x] Hooks fetch data correctly
- [x] Real-time subscriptions working
- [ ] UI components render correctly
- [ ] CRUD operations work end-to-end
- [ ] Project creation with client selection works
- [ ] Label management works

---

## Performance Considerations

### **Indexes Added**
- `idx_clients_user_id` - User's clients lookup
- `idx_clients_status` - Filter by status
- `idx_clients_name` - Name uniqueness check
- `idx_labels_user_id` - User's labels lookup
- `idx_labels_name` - Name uniqueness check
- `idx_project_labels_project_id` - Project's labels lookup
- `idx_project_labels_label_id` - Label's projects lookup
- `idx_projects_client_id` - Client's projects lookup

### **Query Optimization**
- Client/label queries filtered by user_id (indexed)
- Project joins include client/labels via foreign keys
- RLS policies use auth.uid() for efficient filtering

### **Potential Bottlenecks**
- Many-to-many label queries could slow with 1000+ labels
- Consider caching frequently-used label combinations
- Monitor project list performance with full joins

---

## Migration Impact

### **✅ Backward Compatible**
- Existing projects continue working
- `row_id` kept for backward compatibility (will remove later)
- Groups optional but existing group relationships preserved
- No breaking changes to existing functionality

### **⚠️ Breaking Changes** (Future)
- Timeline view will need major rewrite (row-based → group-based)
- Project creation UI requires client selection
- Row management UI can be removed eventually

---

## Next Steps

### **Phase 1: Complete UI** (Current)
1. Build client management interface
2. Build label management interface
3. Update project forms with client/label selectors
4. Add client/label display to project cards
5. Add filter by client/label

### **Phase 2: Timeline Rewrite** (Future)
1. Update timeline to display by groups (not rows)
2. Add "Ungrouped Projects" section
3. Remove row-based filtering
4. Update drag-and-drop to work with groups
5. Remove row management UI

### **Phase 3: Cleanup** (Future)
1. Remove `row_id` field from projects table
2. Remove `rows` table entirely
3. Remove legacy `client` string field
4. Update all documentation
5. Clean up backward compatibility code

---

## Documentation Updates Needed

### **✅ Completed**
- [x] Implementation summary (this document)
- [x] Database schema documented
- [x] TypeScript types documented
- [x] Hooks documented

### **⏳ TODO**
- [ ] Update Architecture Guide with new entities
- [ ] Update BUSINESS_LOGIC_REFERENCE.md with client/label rules
- [ ] Add domain rules for ClientRules and LabelRules
- [ ] Update API documentation
- [ ] Update user-facing documentation

---

## Success Metrics

### **Technical Success** ✅
- [x] Database migration completed without data loss
- [x] All projects linked to clients successfully
- [x] TypeScript compilation clean
- [x] Hooks provide full CRUD functionality
- [x] Real-time subscriptions working

### **Business Success** (TBD)
- [ ] Users can manage clients easily
- [ ] Users can tag projects with labels
- [ ] Projects can exist without groups
- [ ] Timeline view works without rows
- [ ] No performance degradation

---

**Status:** Database & Backend ✅ Complete | UI Components ⏳ In Progress  
**Last Updated:** October 21, 2025  
**Implemented By:** Lovable AI Assistant
