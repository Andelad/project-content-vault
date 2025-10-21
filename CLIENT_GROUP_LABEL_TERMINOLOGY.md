# Client-Group-Label Terminology & Data Model

**Date:** October 21, 2025  
**Purpose:** Define clear terminology and data model for the new client-group-label system to replace the current group-row-project hierarchy.

---

## Current vs Proposed Data Model

### **Current Structure (To Be Replaced)**
```
Groups → Rows → Projects (required hierarchy)
Projects.client = string field
```

### **Proposed Structure**
```
Clients → Projects (required: one client per project)
Groups → Projects (optional: one group per project)
Labels → Projects (optional: many labels per project)
```

---

## Entity Definitions

### **1. Client** (New Entity)
**Definition:** An organization or individual that you work for.

**Attributes:**
- `id`: UUID primary key
- `userId`: Reference to user who owns this client
- `name`: Client name (e.g., "Acme Corp", "TechStart Inc")
- `contactEmail`: Primary contact email
- `contactPhone`: Primary contact phone
- `billingAddress`: Billing address (optional)
- `notes`: Additional notes about the client
- `createdAt`: Creation timestamp
- `updatedAt`: Last modification timestamp

**Business Rules:**
- Required for all projects
- One-to-many relationship with projects
- Can exist without projects (for future work)

**Example Usage:**
```typescript
const client = {
  name: "Acme Corporation",
  contactEmail: "billing@acme.com",
  notes: "Fortune 500 client, quarterly reviews"
};
```

### **2. Group** (Simplified Existing Entity)
**Definition:** A high-level organizational category for projects.

**Attributes:**
- `id`: UUID primary key
- `userId`: Reference to user who owns this group
- `name`: Group name (e.g., "Web Development", "Consulting", "Internal")
- `createdAt`: Creation timestamp
- `updatedAt`: Last modification timestamp

**Business Rules:**
- Optional for projects (projects can exist without groups)
- One-to-many relationship with projects (one project = one group)
- Groups can exist without projects
- No colors or descriptions (kept simple)

**Example Usage:**
```typescript
const group = {
  name: "Web Development"
};
```

### **3. Label** (New Entity)
**Definition:** A flexible text tag for categorizing and filtering projects.

**Attributes:**
- `id`: UUID primary key
- `userId`: Reference to user who owns this label
- `name`: Label name (e.g., "urgent", "high-priority", "client-facing")
- `color`: Optional color for visual distinction
- `createdAt`: Creation timestamp
- `updatedAt`: Last modification timestamp

**Business Rules:**
- Optional for projects
- Many-to-many relationship with projects (one project can have many labels)
- Labels can exist without projects
- Simple text-based (no descriptions)

**Example Usage:**
```typescript
const label = {
  name: "urgent",
  color: "#ef4444"
};
```

### **4. Project** (Updated Entity)
**Definition:** A work initiative with timeline, budget, and deliverables.

**Updated Attributes:**
- `clientId`: **NEW** - Required reference to client
- `groupId`: **CHANGED** - Optional reference to group (was required)
- `rowId`: **REMOVED** - No longer needed
- All other fields remain the same

**Business Rules:**
- Must belong to exactly one client
- Can optionally belong to one group
- Can have zero or more labels
- No longer requires row membership

---

## Key Distinctions

### **Client vs Group vs Label**

| Aspect | Client | Group | Label |
|--------|--------|-------|-------|
| **Purpose** | Who you work for | How work is organized | How work is tagged |
| **Relationship** | One per project (required) | One per project (optional) | Many per project (optional) |
| **Scope** | Business entity | Organizational category | Flexible categorization |
| **Example** | "Acme Corp" | "Web Development" | "urgent" |
| **Structure** | Full entity with contact info | Simple name only | Simple name with optional color |

### **Why Groups Are Separate From Labels**

**Groups:**
- Structured organizational categories
- One per project (exclusive membership)
- Used for high-level organization and reporting
- Examples: "Client Work", "Internal Projects", "Maintenance"

**Labels:**
- Flexible tagging system
- Multiple per project (inclusive membership)
- Used for filtering, searching, and ad-hoc organization
- Examples: "urgent", "quarterly-review", "high-priority"

---

## Database Schema Changes

### **New Tables**

#### **clients**
```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  billing_address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_clients_name ON clients(user_id, name);

-- RLS Policies
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own clients" ON clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own clients" ON clients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own clients" ON clients FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own clients" ON clients FOR DELETE USING (auth.uid() = user_id);
```

#### **labels**
```sql
CREATE TABLE labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_labels_user_id ON labels(user_id);
CREATE INDEX idx_labels_name ON labels(user_id, name);

-- RLS Policies
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own labels" ON labels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own labels" ON labels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own labels" ON labels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own labels" ON labels FOR DELETE USING (auth.uid() = user_id);
```

#### **project_labels** (Junction Table)
```sql
CREATE TABLE project_labels (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, label_id)
);

-- Indexes
CREATE INDEX idx_project_labels_project_id ON project_labels(project_id);
CREATE INDEX idx_project_labels_label_id ON project_labels(label_id);

-- RLS Policies will inherit from projects and labels
```

### **Modified Tables**

#### **projects**
```sql
-- Add client relationship
ALTER TABLE projects
ADD COLUMN client_id UUID REFERENCES clients(id);

-- Make group optional
ALTER TABLE projects
ALTER COLUMN group_id DROP NOT NULL;

-- Remove row requirement (will be removed entirely later)
-- ALTER TABLE projects DROP COLUMN row_id; -- Keep for now, remove in cleanup phase

-- Update indexes
CREATE INDEX idx_projects_client_id ON projects(client_id);
DROP INDEX IF EXISTS idx_projects_row_id; -- No longer needed
```

#### **groups** (Simplify)
```sql
-- Remove description and color columns
ALTER TABLE groups DROP COLUMN IF EXISTS description;
ALTER TABLE groups DROP COLUMN IF EXISTS color;

-- Update comments
COMMENT ON TABLE groups IS 'High-level organizational categories for projects. Simple name-based grouping.';
```

---

## Migration Strategy

### **Phase 1: Database Preparation (Week 1)**
1. Create new tables (`clients`, `labels`, `project_labels`)
2. Add `client_id` column to `projects`
3. Make `group_id` optional in `projects`
4. Create indexes and RLS policies

### **Phase 2: Data Migration (Week 1-2)**
1. **Migrate existing client strings to Client entities:**
   ```sql
   -- Create Client entities from existing project.client strings
   INSERT INTO clients (user_id, name)
   SELECT DISTINCT user_id, client
   FROM projects
   WHERE client IS NOT NULL AND client != '';

   -- Update projects to reference client entities
   UPDATE projects
   SET client_id = c.id
   FROM clients c
   WHERE projects.client = c.name AND projects.user_id = c.user_id;
   ```

2. **Create default labels if needed**
3. **Verify data integrity**

### **Phase 3: Application Updates (Week 2-3)**
1. Update TypeScript types in `core.ts`
2. Update domain rules for new relationships
3. Update orchestrators to handle client/group/label logic
4. Update UI components for new data model

### **Phase 4: UI Implementation (Week 3-4)**
1. Add client management interface
2. Update project creation/editing forms
3. Add label management and assignment
4. Update project listing and filtering

### **Phase 5: Cleanup (Week 4)**
1. Remove legacy `client` string field from projects
2. Remove `row_id` field from projects
3. Clean up unused row/group relationships
4. Update documentation

---

## Business Logic Updates

### **New Domain Rules**

#### **Client Rules**
```typescript
export class ClientRules {
  static validateClientName(name: string): boolean {
    return name.trim().length > 0 && name.length <= 100;
  }

  static canDeleteClient(clientId: string, projectCount: number): boolean {
    return projectCount === 0; // Can't delete clients with projects
  }
}
```

#### **Group Rules**
```typescript
export class GroupRules {
  static validateGroupName(name: string): boolean {
    return name.trim().length > 0 && name.length <= 50;
  }

  static canDeleteGroup(groupId: string, projectCount: number): boolean {
    return projectCount === 0; // Can't delete groups with projects
  }
}
```

#### **Label Rules**
```typescript
export class LabelRules {
  static validateLabelName(name: string): boolean {
    return name.trim().length > 0 && name.length <= 30;
  }

  static normalizeLabelName(name: string): string {
    return name.trim().toLowerCase();
  }

  static canDeleteLabel(labelId: string): boolean {
    return true; // Labels can always be deleted (relationships cascade)
  }
}
```

#### **Project Relationship Rules**
```typescript
export class ProjectRelationshipRules {
  static validateProjectClient(project: Project): boolean {
    return project.clientId != null;
  }

  static validateProjectGroup(project: Project): boolean {
    // Group is optional, so always valid
    return true;
  }

  static validateProjectLabels(project: Project, labels: Label[]): boolean {
    // No specific validation needed for labels
    return true;
  }

  static canChangeProjectClient(project: Project, newClientId: string): boolean {
    // Allow changing client (business decision)
    return true;
  }

  static canChangeProjectGroup(project: Project, newGroupId: string | null): boolean {
    // Allow changing group (business decision)
    return true;
  }
}
```

---

## Benefits of This Approach

### **Immediate Benefits**
- ✅ **Clear separation** between clients (who), groups (organization), labels (tagging)
- ✅ **Simplified groups** (no unnecessary description/color fields)
- ✅ **Flexible labeling** (many-to-many with projects)
- ✅ **Required client relationship** (proper business entity)

### **User Experience Benefits**
- ✅ **Better organization** with dedicated client management
- ✅ **Flexible categorization** with labels
- ✅ **Clean grouping** without forced hierarchies
- ✅ **Scalable structure** for growing business

### **Technical Benefits**
- ✅ **Normalized database** (proper relationships)
- ✅ **Type safety** with updated TypeScript interfaces
- ✅ **Clear domain rules** for business logic
- ✅ **Maintainable code** with single responsibility entities

---

## Implementation Checklist

### **Database ✅**
- [ ] Create clients table
- [ ] Create labels table
- [ ] Create project_labels junction table
- [ ] Update projects table (add client_id, make group_id optional)
- [ ] Simplify groups table (remove description/color)

### **Types ✅**
- [ ] Add Client interface to core.ts
- [ ] Add Label interface to core.ts
- [ ] Update Project interface (add clientId, make groupId optional)

### **Domain Rules ✅**
- [ ] Add ClientRules, GroupRules, LabelRules
- [ ] Update ProjectRelationshipRules
- [ ] Update RelationshipRules for new model

### **Services ✅**
- [ ] Update UnifiedProjectService for client/group/label queries
- [ ] Update ProjectOrchestrator for new workflows
- [ ] Add ClientOrchestrator, LabelOrchestrator

### **UI Components ⏳**
- [ ] Client management interface
- [ ] Label management interface
- [ ] Update project forms
- [ ] Update project listing/filtering

---

**Status:** Terminology Defined, Ready for Implementation  
**Next Step:** Begin Phase 1 - Database Preparation  
**Estimated Timeline:** 4 weeks  
**Risk Level:** Medium (data migration required)</content>
<parameter name="filePath">/Users/andyjohnston/project-content-vault/CLIENT_GROUP_LABEL_TERMINOLOGY.md
