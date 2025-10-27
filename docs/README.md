# Project Documentation

Essential documentation for ongoing development and platform setup.

---

## ⭐ **CORE DOCUMENTS - READ FIRST**

### 1. **`Architecture Guide.md`** (Root) 🏗️
**THE SINGLE SOURCE OF TRUTH** for AI development and system architecture.

**Critical for**:
- ✅ AI agents developing in this codebase
- ✅ Understanding services architecture
- ✅ Knowing where to put business logic
- ✅ Type consolidation patterns
- ✅ Domain layer structure
- ✅ Service layer responsibilities

**Contains**:
- AI development constraints and patterns
- Services architecture (unified, orchestrators, calculations)
- Domain layer (business rules single source of truth)
- Type architecture (core.ts as single source)
- Import patterns and anti-patterns
- Decision matrices for AI development

**Status**: ✅ Complete - Reflects current simplified architecture (October 2025)

---

### 2. **`AI_DEVELOPMENT_RULES.md`** (Root) 🤖
**AI-specific development guidelines and constraints**

**Critical for**:
- ✅ AI agents writing code
- ✅ Understanding forbidden patterns
- ✅ Knowing allowed patterns
- ✅ Service layer usage rules

**Contains**:
- Forbidden file paths and patterns
- Required import patterns
- Service layer rules
- Business logic placement
- Validation patterns

---

### 3. **`BUSINESS_LOGIC_REFERENCE.md`** (docs/) 📋
**Complete specification of all business rules and relationships**

**Critical for**:
- ✅ Understanding business requirements
- ✅ Implementing validation logic
- ✅ Domain rules implementation
- ✅ Cross-entity relationships

**Contains**:
- Project rules and constraints
- Milestone budget rules
- Timeline validation rules
- Relationship rules
- 50+ business rule methods documented

---

## 📁 Directory Structure

### Root Documentation Files
- **`Architecture Guide.md`** ⭐ - **CORE** - Services architecture and AI development patterns
- **`AI_DEVELOPMENT_RULES.md`** ⭐ - **CORE** - AI-specific development constraints
- **`CLIENT_GROUP_LABEL_SPECIFICATION.md`** - Client/Group/Label system specification
- **`FEEDBACK_FEATURE_SUMMARY.md`** - Feedback system feature overview
- **`FEEDBACK_IMPLEMENTATION_INSTRUCTIONS.md`** - Feedback implementation guide
- **`IMPLEMENTATION_INSTRUCTIONS_FOR_LOVABLE.md`** - Lovable platform instructions

### `docs/` - Business Logic & Analysis
- **`BUSINESS_LOGIC_REFERENCE.md`** ⭐ - **CORE** - Complete business rules specification
- **`DOMAIN_DEFINITIONS.md`** ⭐ - **NEW** - Plain-English guide to what entities are/are not
- **`CALCULATION_REFERENCE.md`** ⭐ - **NEW** - Complete list of all calculations with formulas
- **`LOGIC_CONSOLIDATION_PROCESS.md`** - **NEW** - Systematic guide to consolidate business logic
- **`CLIENT_GROUP_LABEL_IMPLEMENTATION.md`** - Client/Group/Label implementation status
- **`COMPONENTS_CLEANUP_SUMMARY.md`** - Components organization improvements
- **`DOCUMENTATION_CLEANUP_SUMMARY.md`** - Documentation consolidation summary
- **`MILESTONE_VS_EVENTS_CLARIFICATION.md`** - Milestone vs event distinction
- **`TIME_TRACKER_TABLET_IMPLEMENTATION.md`** - Tablet time tracker requirements

### `docs/architecture/` - System Architecture
- **`BUSINESS_LOGIC_AUDIT.md`** - Business logic architecture analysis
- **`DOMAIN_LAYER_ROADMAP.md`** - Domain layer implementation roadmap
- **`DRAG_ARCHITECTURE_AUDIT.md`** - Drag system architecture analysis
- **`DRAG_REDUNDANCY_ANALYSIS.md`** - Drag system redundancy findings
- **`DRAG_SYSTEM_UNIFICATION.md`** - Drag system consolidation plan
- **`DRAG_UNIFICATION_COMPLETE.md`** - Drag unification completion summary
- **`SUPABASE_REQUIREMENTS.md`** - Database schema requirements
- **`TIMELINE_RULES_IMPLEMENTATION.md`** - Timeline business rules

### `src/components/` - Component Organization
- **`README.md`** - Comprehensive component organization guide
  - Directory structure and purpose
  - Component classification guide
  - Naming conventions
  - Import patterns
  - Common patterns with examples

---

## 🚀 Quick Start for Different Roles

### **For AI Agents**
1. ⭐ **READ FIRST**: `/Architecture Guide.md` - Understand the entire architecture
2. ⭐ **READ SECOND**: `/AI_DEVELOPMENT_RULES.md` - Know the constraints
3. Read: `/docs/BUSINESS_LOGIC_REFERENCE.md` - Understand business rules
4. Reference: `/src/components/README.md` - Component organization
5. Check: `/docs/architecture/` - For specific architecture decisions

### **For Human Developers**
1. ⭐ **Start with**: `/Architecture Guide.md` - Core architecture patterns
2. Read: `/docs/BUSINESS_LOGIC_REFERENCE.md` - Business rules
3. Review: `/src/components/README.md` - Component structure
4. Check: `/docs/CLIENT_GROUP_LABEL_IMPLEMENTATION.md` - Current features
5. Reference: `/docs/architecture/` as needed

### **For New Features**
1. Check business rules in `BUSINESS_LOGIC_REFERENCE.md`
2. Follow patterns in `Architecture Guide.md`
3. Place code according to service layer rules
4. Add components following `src/components/README.md`
5. Update business logic reference if needed

---

## 📚 Document Hierarchy

```
┌─────────────────────────────────────────┐
│   Architecture Guide.md (ROOT)          │  ← START HERE
│   Single Source of Truth for System     │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│   AI_DEVELOPMENT_RULES.md (ROOT)        │  ← AI Constraints
│   Forbidden/Allowed Patterns            │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│   BUSINESS_LOGIC_REFERENCE.md (docs/)   │  ← Business Rules
│   Complete Business Requirements        │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│   Component & Feature Documentation     │  ← Implementation
│   Specific implementation guides        │
└─────────────────────────────────────────┘
```

---

## 🎯 Architecture Overview (Quick Reference)

### Services Layer Structure
```
src/
├── domain/rules/              ⭐ Business rules (single source of truth)
├── services/
│   ├── unified/              ⭐ Calculations & transformations
│   ├── orchestrators/        ⭐ Complex workflows (validation + data access)
│   ├── calculations/         Pure data mathematics
│   ├── ui/positioning/       UI positioning & visual math
│   └── performance/          Performance optimization
├── components/               UI components (see src/components/README.md)
└── hooks/                    React hooks for data fetching
```

### Key Principles
1. **Business logic** → `/domain/rules/` (single source of truth)
2. **Complex workflows** → `/services/orchestrators/`
3. **Calculations** → `/services/unified/` or `/services/calculations/`
4. **UI components** → `/components/` (see README.md for organization)
5. **No validators layer** → Call domain rules directly
6. **No repository layer** → Call Supabase directly or use hooks

---

## ✅ Documentation Status (October 2025)

### Complete & Current
- ✅ Architecture Guide - Reflects simplified architecture
- ✅ AI Development Rules - Updated constraints
- ✅ Business Logic Reference - 50+ rules documented
- ✅ Components README - Comprehensive organization guide
- ✅ Components Cleanup Summary - Recent improvements
- ✅ Client/Group/Label Implementation - Backend complete

### In Progress
- ⏳ Client/Group/Label UI - Backend complete, UI in progress

### Future
- 📝 Testing documentation
- 📝 Deployment guide
- 📝 Performance optimization guide

---

## 🔍 Finding Information

**Looking for...**  
- **Architecture patterns?** → `/Architecture Guide.md`
- **AI development rules?** → `/AI_DEVELOPMENT_RULES.md`
- **Business rules?** → `/docs/BUSINESS_LOGIC_REFERENCE.md`
- **Component organization?** → `/src/components/README.md`
- **Database schema?** → `/docs/architecture/SUPABASE_REQUIREMENTS.md`
- **Recent changes?** → `/docs/COMPONENTS_CLEANUP_SUMMARY.md`
- **Feature specs?** → `/CLIENT_GROUP_LABEL_SPECIFICATION.md` or `/FEEDBACK_FEATURE_SUMMARY.md`

---

**Last Updated**: October 26, 2025  
**Maintained by**: Development Team  
**Questions?** Start with Architecture Guide or Business Logic Reference
