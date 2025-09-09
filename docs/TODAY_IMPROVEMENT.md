# 🎯 Today's Incremental Improvement

> **Target**: Remove duplicate Project and Milestone types from `projectProgressCalculations.ts`  
> **Risk Level**: 🟡 LOW (well-contained file)  
> **Estimated Time**: 15 minutes  

## 🔧 Step-by-Step Implementation

### Step 1: Safety Check ✅
```bash
# Check TypeScript compilation first
./scripts/track-progress.sh check
```
**Expected**: ✅ No TypeScript errors

### Step 2: Create Backup
```bash
# The script will create a backup automatically
./scripts/fix-duplicate-types-step1.sh
```

### Step 3: Manual Edits (SAFE)
Edit `src/services/calculations/projectProgressCalculations.ts`:

**Remove these duplicate interfaces:**
```typescript
// ❌ DELETE: Lines ~18-24
export interface Milestone {
  id: string;
  projectId: string;  
  dueDate: string | Date;
  timeAllocation: number;
  completed?: boolean;
}

// ❌ DELETE: Lines ~26-31  
export interface ProgressProject {
  id: string;
  startDate: string | Date;
  endDate: string | Date;
  estimatedHours: number;
}
```

**Replace usage:**
```typescript
// ❌ FIND: ProgressProject
// ✅ REPLACE WITH: Project
```

### Step 4: Verification
```bash
# Check compilation
npx tsc --noEmit

# Check progress  
./scripts/track-progress.sh check
```

**Expected**: Still ✅ No TypeScript errors, 2 fewer duplicate types

### Step 5: Update Progress
```bash
# Update the progress tracker
./scripts/track-progress.sh update
```

Then manually update `docs/INCREMENTAL_PROGRESS.md`:
- Move 2 items from `[ ]` to `[x]` in the duplicate types section
- Update progress percentages
- Add to "✅ Completed Items" section

---

## 🏆 Success Criteria
- [ ] TypeScript compilation still passes
- [ ] 2 fewer duplicate type definitions  
- [ ] All existing functionality still works
- [ ] Progress tracker updated

## 🚨 If Something Goes Wrong
```bash
# Rollback command (the script will show you the exact command)
mv src/services/calculations/projectProgressCalculations.ts.backup.TIMESTAMP src/services/calculations/projectProgressCalculations.ts
```

## 🎉 Next Steps After Success
1. Pick another low-risk duplicate type
2. Consider consolidating a simple calculation function
3. Update weekly velocity tracking

---

*This approach gives us immediate wins while building confidence for larger changes!*
