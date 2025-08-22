# 🔍 PRE-CHANGE CHECKLIST

## **Before Making ANY Code Change:**

### **Step 1: Read the Rules**
- [ ] I have read `ARCHITECTURAL_RULES.md`
- [ ] I understand the current architecture
- [ ] I know which services exist

### **Step 2: Analyze the Change**
- [ ] What am I trying to implement?
- [ ] Is this calculation logic? → Must use `/src/services/`
- [ ] Is this state management? → Which context?
- [ ] Is this UI rendering? → Component only

### **Step 3: Check Existing Solutions**
- [ ] Does this calculation already exist in services?
- [ ] Does this state already exist in contexts?
- [ ] Am I about to duplicate something?

### **Step 4: Plan the Implementation**
- [ ] Which service should handle the logic?
- [ ] Which context should handle the state?
- [ ] Which component should handle the rendering?

### **Step 5: Implementation Rules**
- [ ] NO calculations in components
- [ ] NO business logic in hooks
- [ ] NO duplication of services
- [ ] NO god objects or contexts

## **🚨 STOP! If you can't check all boxes above, don't proceed!**

**Consult the architecture first, then implement correctly.**
