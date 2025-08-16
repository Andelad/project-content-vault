# Simplified Version Tracking System

This document explains the simplified version tracking system designed to provide reliable version information that works consistently across all deployment environments, including Lovable.

## How It Works

The version tracking system uses a focused, two-layer approach:

### 1. Manual Version Information (Always Available)
- **Version number**: Manually maintained in `src/version.ts`
- **Codename**: Human-readable release identifier  
- **Release features**: Key features in this version

### 2. Build Timestamp (Always Captured)
- **Build date**: When the current build was created
- Works in all environments (development, GitHub, Lovable)

## What You'll See

The version tracker at the bottom of the sidebar will always show:
```
v1.0.0 (TimelineView Enhancement)
Built: Aug 16, 2025, 09:55 AM
```

This information is:
- ✅ **Always reliable** - no dependency on Git availability
- ✅ **Deployment-friendly** - works in Lovable and all environments
- ✅ **Informative** - tells you exactly which version and when it was built
- ✅ **Simple** - clean, focused display without unreliable information

## Usage

### For Version Management
Update `src/version.ts` before releases:
```typescript
export const VERSION_INFO = {
  version: '1.1.0',
  codename: 'New Feature Release',
  releaseDate: '2025-08-16',
  features: [
    'New feature 1',
    'New feature 2', 
    'Bug fixes'
  ]
};
```

### For Development
- Build timestamp is automatically captured during every build
- Run `npm run build-info` to manually refresh build timestamp
- Version info updates automatically when you change `src/version.ts`

## Build Integration

The build info script runs automatically:
```bash
npm run build      # Captures build timestamp then builds
npm run build-info # Manually capture build timestamp
```

## Benefits

1. **Always works**: No dependency on Git or special environments
2. **Deployment reliable**: Version info survives all deployment processes
3. **Clear tracking**: Always know which version and when it was built
4. **Simple maintenance**: Just update the version file for releases
5. **Clean display**: Focused, useful information without clutter

This approach ensures you'll always have reliable version tracking, regardless of whether you're in development, GitHub, or deployed in Lovable!
