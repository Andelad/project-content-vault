// Barrel export for lib utilities - Framework utilities only
// 
// ✅ ALLOWED: Framework utilities (shadcn className merging)
// ✅ ALLOWED: Pure formatting (currency, date display) 
// ✅ ALLOWED: Generic algorithms (debounce, throttle)
// ✅ ALLOWED: Validation helpers (email, phone format)
//
// ❌ FORBIDDEN: Business calculations (moved to @/services)
// ❌ FORBIDDEN: Domain-specific logic (moved to @/services)
// ❌ FORBIDDEN: Application workflows (moved to @/services)
// ❌ FORBIDDEN: Performance caching (moved to @/services/infrastructure)

// Framework utilities
export * from './utils';