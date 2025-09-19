# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Primary Development
- `npm run dev` - Start development server with auto-reload (ts-node-dev)
- `npm run start:dev` - Alternative development command (same as above)

### Production Build & Deploy
- `npm run build` - Compile TypeScript to JavaScript (outputs to dist/)
- `npm start` - Run production server from compiled code
- `npm run start:prod:safe` - Production start with PowerShell script on port 5000

### Utility Scripts
- `npm run verify-users` - Run user verification script
- `npm run verify-users:advanced` - Run advanced user verification
- `npm run status` - Quick status check
- `npm run test-registration` - Test user registration functionality
- `npm run test-endpoint` - Test API endpoints

## Architecture Overview

### Core Structure
This is a Node.js + TypeScript backend for a financial management system ("Vcaja") with the following key components:

**Authentication**: Uses Clerk for user authentication with JWT tokens. Authentication middleware in `src/middleware/clerkAuth.ts` handles token verification.

**Database**: MongoDB with Mongoose ODM. Connection utilities in `src/utils/db.ts`. Can skip DB connection with `SKIP_DB=true` for testing.

**Main Models**:
- `User` - User management with Clerk integration (clerkId, name, email)
- `Caja` - Financial movements (income/expenses) with categories, payment methods, and detailed validation
- `CatalogoGastos` - Expense catalog for structured spending categories

### Financial System Features
The `Caja` model supports:
- **Movement Types**: ENTRADA (income) / SALIDA (expense)
- **Income Categories**: Direct sales, operations sales, financial income, other income
- **Expense Categories**: Finance, operations, sales, administrative
- **Cost Types**: Labor, raw materials, other expenses
- **Payment Methods**: Cash, transfer, Yape, Plin, deposit, check, card
- **Validation**: Date ranges (2 years back, 1 year forward), amount limits, required fields per movement type

### API Routes Structure
- `/api/auth` - Authentication endpoints
- `/api/caja` - Financial movement operations
- `/api/users` - User management
- `/api/herramientas` - Utility tools/helpers

### Server Configuration
- Port: 4000 (default), with automatic retry on different ports if busy
- CORS: Configured for Vercel frontend (`https://tc-front.vercel.app`) and local development
- Security: Helmet, compression, rate limiting (100 requests/15min)
- Logging: Winston logger with Morgan HTTP logging
- Graceful shutdown handling for SIGINT/SIGTERM

## Environment Setup

Required environment variables:
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - For token signing
- `CLERK_SECRET_KEY` - Clerk authentication
- `CLERK_ISSUER` - Clerk issuer URL (defaults to dev)
- `CORS_ORIGIN` - Additional allowed CORS origin
- `SKIP_DB=true` - Skip database connection for testing

## Development Notes

- TypeScript compiled to `dist/` directory with ES2020 target
- Uses ts-node-dev for development with transpile-only mode for faster rebuilds
- Server handles port conflicts automatically (tries ports 4000, 4001, etc.)
- All models include timestamps and proper indexing for performance
- Financial data includes currency formatting for Peru (PEN)
- Extensive validation on financial movements to ensure data integrity