# TipJar - Automated Tip Distribution System

## Overview

TipJar is a web application that automates tip distribution calculations for service industry workers (specifically designed for Starbucks partners). The system processes uploaded schedule images via OCR, extracts partner hours data, calculates individual payouts based on a total tip pool, and provides detailed bill breakdowns for cash distribution. The application features a Starbucks-inspired spring color theme with a modern, responsive interface.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18 with TypeScript
- Vite as build tool and dev server
- Wouter for client-side routing (lightweight alternative to React Router)
- TanStack Query for server state management and API requests
- Tailwind CSS v4 for styling with Material Design 3 influences
- Radix UI for accessible component primitives
- shadcn/ui component library built on Radix UI

**State Management:**
- React Context API (`TipContext`) for global tip distribution state
- Manages partner hours, extracted OCR text, and distribution data
- TanStack Query handles server-side data caching and synchronization

**UI Design Philosophy:**
- Custom Starbucks spring-themed color palette (dark slate backgrounds with pastel accents)
- Material Design 3 design tokens for consistent spacing, elevation, and typography
- Responsive mobile-first design
- CSS custom properties for theming with dark mode default

**Key Components:**
- `FileDropzone`: Drag-and-drop image upload with OCR processing feedback
- `PartnerCard`: Displays individual partner payout with bill breakdown
- `PartnerPayoutsList`: Grid layout showing all partner distributions
- `ResultsSummaryCard`: Overall distribution statistics (total hours, hourly rate, total amount)
- `ManualEntryModal`: Fallback for manual partner data entry when OCR fails

### Backend Architecture

**Server Framework:**
- Express.js with TypeScript
- ESM modules (type: "module" in package.json)
- Development: tsx for TypeScript execution
- Production: esbuild for compilation

**Deployment Targets:**
- Primary: Netlify Functions (serverless)
- Alternative: Vercel (configured via vercel.json)
- Local development server via Vite middleware mode

**API Endpoints:**
- `POST /api/ocr`: Image upload and OCR processing
- `POST /api/distributions/calculate`: Tip distribution calculation
- `GET /api/distributions`: Historical distributions retrieval
- `POST /api/partners`: Partner management
- `GET /api/partners`: Partner list retrieval

**Business Logic:**
- Tip calculation: Divides total tip pool by total hours to get hourly rate, then multiplies by individual hours
- Hourly rate truncated to 2 decimal places without rounding
- Payout amounts rounded to nearest dollar for cash distribution
- Bill breakdown uses greedy algorithm with denominations: $20, $10, $5, $1

### Data Storage

**Database:**
- Drizzle ORM configured for PostgreSQL
- Primary provider: Neon serverless PostgreSQL (via `@neondatabase/serverless`)
- Schema defined in `shared/schema.ts`

**Tables:**
- `users`: User authentication (username, password)
- `partners`: Partner roster (id, name)
- `distributions`: Historical tip distributions (date, amounts, hourly rate, partner data as JSONB)

**Storage Abstraction:**
- `IStorage` interface defines CRUD operations
- `MemStorage` class provides in-memory fallback for development
- Database connection via `DATABASE_URL` environment variable

### External Dependencies

**OCR Service - Nanonets:**
- Primary OCR provider for image text extraction
- Model: `Nanonets-ocr2-7B` (configurable)
- Endpoint: `https://app.nanonets.com/api/v2/OCR/Model/{modelId}/LabelFile/`
- Authentication: API key via `NANONETS_API_KEY` environment variable
- Optional user-provided API keys via `x-nanonets-key` header
- Optional model override via `x-nanonets-model` header and `NANONETS_MODEL_ID` env var

**Rate Limiting Strategy:**
- In-memory rate limiter tracking requests per minute
- Default: 15 requests per minute (configurable in `server/config/rate-limit.ts`)
- Exponential backoff retry logic (3 attempts, delays: 1s, 2s, 4s)
- Maximum delay capped at 30 seconds
- Error detection for quota exceeded responses (status 429)

**OCR Processing Pipeline:**
1. Client uploads image via FormData
2. Server converts to base64
3. Nanonets API call with retry logic
4. Text extraction from nested JSON response
5. Pattern matching to extract partner names and hours
6. Fallback to manual entry if OCR fails

**Third-Party Libraries:**
- `multer`: File upload handling (memory storage, 10MB limit)
- `node-fetch`: HTTP client with FormData support
- `zod`: Schema validation (via drizzle-zod)
- `next-themes`: Theme management (dark mode)
- Animation: Framer Motion (configured), Animate.css (included)

**Session Management:**
- `SESSION_SECRET` environment variable for session encryption
- Cookie-based sessions with Express

**Build and Deployment:**
- Netlify: Custom build command (`npm run build:netlify`) creates serverless functions
- Vite production build outputs to `dist/public`
- Serverless functions in `netlify/functions/`
- Environment variables required: `NANONETS_API_KEY`, `NANONETS_MODEL_ID`, `SESSION_SECRET`, `DATABASE_URL`