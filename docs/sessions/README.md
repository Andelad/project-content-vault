# Sessions - Temporary Working Documents

This folder contains **temporary documentation** created by AI assistants during development sessions.

## Purpose

AI-generated documents that are:
- Implementation summaries
- Migration/change logs  
- Incident reports
- Work-in-progress documentation
- Audit reports
- Any document with status markers like "COMPLETE" or "DEPRECATED"

## Lifecycle

These documents are **ephemeral** and should be:
1. Created during active development work
2. Reviewed once work is complete
3. **Deleted** when no longer needed
4. Never considered "source of truth"

## Cleanup

Periodically review and delete old files. Ask yourself:
- Is this implementation complete? → Delete it
- Was this incident resolved? → Delete it  
- Is this information now in core docs? → Delete it

## What NOT to Put Here

Permanent documentation belongs in:
- `/docs/core/` - Framework and architecture
- `/docs/features/` - Feature-specific documentation
- `/docs/operations/` - Testing, deployment, integrations
