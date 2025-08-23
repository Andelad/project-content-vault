# Version Tracking System

Simple, reliable version tracking that works across all deployment environments.

## How It Works

### Manual Version (`src/version.ts`)
Update before releases:
```typescript
export const VERSION_INFO = {
  version: '1.1.0',
  codename: 'Feature Release Name',
  releaseDate: '2025-08-16',
  features: [
    'Key feature 1',
    'Key feature 2'
  ]
};
```

### Build Timestamp
- Automatically captured during build
- Shows when current build was created
- Works in all environments (dev, production, Lovable)

## Display
Version appears in sidebar footer:
```
v1.0.0 (Feature Release Name)
Built: Aug 16, 2025, 09:55 AM
```

## Benefits
✅ Always reliable - no Git dependency  
✅ Works in all deployment environments  
✅ Simple to maintain  
✅ Clear version identification
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
