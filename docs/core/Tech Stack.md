# Tech Stack

**Version:** 1.0  
**Date:** December 27, 2025  
**Status:** Current Production Stack + Planned Additions

---

## Core Stack (Current)

### Frontend
- **React** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Component library (built on Radix UI)

### Backend & Database
- **Supabase** - Backend-as-a-Service
  - PostgreSQL database
  - Row Level Security (RLS)
  - Authentication
  - Real-time subscriptions
  - Storage

### State Management
- **React Context** - Global state (Auth, Settings, Timeline)
- **React Hooks** - Local component state

### Routing
- **React Router** - Client-side routing

### Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting (if configured)
- **Git** - Version control
- **GitHub** - Code hosting

### Deployment
- **Lovable** - Database migrations and schema management
- **Vercel/Netlify** (assumed) - Frontend hosting

---

## Planned Additions

### Error Monitoring
- **Sentry** - Production error tracking
  - Tracks JavaScript errors
  - Performance monitoring
  - User session replay
  - Alert notifications

### Email/Communication
- **Resend** - Transactional email service
  - User notifications
  - Feedback submissions
  - Password resets
  - Product updates

### Testing
- **Vitest** - Unit testing framework
- **@testing-library/react** - React component testing
- **Playwright** - End-to-end testing

### Performance
- **@vercel/analytics** - Performance monitoring
- Database indexing - Query optimization

### Code Quality
- **Husky** - Git hooks
- **lint-staged** - Pre-commit linting

---

## Architecture Patterns

### Code Organization
- **Domain-Driven Design** - Business logic in domain layer
- **Orchestrators** - Workflow coordination (CREATE/UPDATE/DELETE)
- **Unified Services** - Read/transform operations
- **Delegation Pattern** - Services delegate to domain rules

### File Structure
```
src/
├── components/        # React UI components
├── domain/           # Business rules and entities
│   └── rules/        # Validation and business logic
├── services/         # Application services
│   ├── orchestrators/  # Workflow coordination
│   └── unified/        # Read/transform services
├── hooks/            # React custom hooks
├── types/            # TypeScript type definitions
├── utils/            # Generic utilities
└── lib/              # Third-party integrations
```

### Data Flow
1. **User Input** → Component
2. **Component** → Hook (state management)
3. **Hook** → Orchestrator/Service
4. **Service** → Domain Rules (validation)
5. **Service** → Supabase (database)
6. **Supabase** → Service → Hook → Component

---

## External Services

### Current
- **Supabase** - Database, auth, storage
- **GitHub** - Version control, CI/CD sync

### Planned
- **Sentry** - Error tracking
- **Resend** - Email delivery
- **Vercel Analytics** (or similar) - Performance monitoring

---

## Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES6+ JavaScript features
- CSS Grid and Flexbox
- Local Storage for offline capabilities

---

## Key Dependencies

### Production
- `react` - UI library
- `react-router-dom` - Routing
- `@supabase/supabase-js` - Supabase client
- `date-fns` - Date manipulation
- `tailwindcss` - Styling
- `lucide-react` - Icons

### Development
- `typescript` - Type system
- `vite` - Build tool
- `eslint` - Linting
- `@types/react` - React type definitions

---

## Future Considerations

### Scalability
- Redis - Caching layer (if needed)
- CDN - Static asset delivery
- Database read replicas - Query performance

### Features
- Stripe - Payment processing (if monetization)
- WebSockets - Real-time collaboration
- Push notifications - Mobile/browser alerts

### DevOps
- Docker - Containerization
- GitHub Actions - CI/CD pipeline
- Staging environment - Pre-production testing

---

**Notes:**
- Tech stack decisions should align with App Logic requirements
- Prefer managed services (Supabase, Resend) over self-hosted
- Keep dependencies minimal - only add when needed
- Document breaking changes when upgrading major versions
