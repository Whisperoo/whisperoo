# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

7 Claude rules
1. First think through the problem, read the codebase for relevant files, and write a plan to tasks/todo.md.
2. The plan should have a list of todo items that you can check off as you complete them
3. Before you begin working, check in with me and I will verify the plan.
4. Then, begin working on the todo items, marking them as complete as you go.
5. Please every step of the way just give me a high level explanation of what changes you made
6. Make every task and code change you do as simple as possible. We want to avoid making any massive or complex changes. Every change should impact as little code as possible. Everything is about simplicity.
7. Finally, add a review section to the [todo.md](http://todo.md/) file with a summary of the changes you made and any other relevant information.


## Development Commands

- `npm run dev` - Start development server with Vite
- `npm run build` - Production build
- `npm run build:dev` - Development build
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Tech Stack

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS
- **State Management**: React Query (@tanstack/react-query)
- **Routing**: React Router v6
- **Forms**: React Hook Form with Zod validation
- **Backend**: Supabase (PostgreSQL with Row Level Security)
- **Vector Search**: pgvector extension for AI-powered knowledge retrieval
- **Edge Functions**: Deno runtime for serverless chat functionality

## Architecture

This is a React SPA for family-focused AI chat with comprehensive parent-child conversation management.

### Route Structure
- `/` - Splash/landing page
- `/auth/*` - Authentication flow (create account, login, OTP verification)
- `/onboarding/*` - Multi-step onboarding (role, kids info, completion)
- `/dashboard` - Main app dashboard
- `/chat` - AI-powered 24/7 support chat interface

### Key Components
- **Layouts**: `AuthLayout` and `OnboardingLayout` provide consistent structure
- **UI Components**: Located in `src/components/ui/` - all shadcn/ui components
- **Auth Utilities**: `src/utils/auth.ts` handles authentication logic
- **Custom Hooks**: `src/hooks/` contains reusable hooks like `use-mobile`
- **Chat Components**: 
  - `Chat.tsx` - Main chat interface with real-time messaging
  - `MessageBubble.tsx` - Individual message display component
  - `ChildSwitcher.tsx` - Context switcher for general vs child-specific conversations

### Supabase Integration
- **Database Schema**: Located in `supabase/migrations/20250701000001_initial_whisperoo_schema.sql`
- **Tables**: 
  - `profiles` - Parent/user accounts
  - `kids` - Child profiles with age-based context
  - `sessions` - Chat conversation sessions with summaries
  - `messages` - Individual chat messages with role and metadata
  - `chat_memory_summaries` - AI-generated conversation memories for context
  - `expert_documents` - Vector knowledge base
- **Row Level Security**: Comprehensive data isolation between families
- **Edge Functions**: 
  - `chat_ai` - Processes user messages and generates AI responses with context
  - `update_session_summary` - AI-powered conversation summarization and memory creation
- **Environment Variables**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`

### Database Commands
- **Migration**: `supabase db push` to apply schema changes
- **Functions**: `supabase functions deploy <function-name>` to deploy Edge Functions
- **Local Development**: `supabase start` for local development stack

### AI Chat Features
- **Session Management**: Persistent conversation contexts
- **Child Profiles**: Age-appropriate advice based on child details
- **Memory**: Conversation summaries maintain context across sessions
- **Vector Search**: Expert knowledge retrieval from document embeddings
- **Security**: RLS ensures parents only access their own family data

## Project Context

Whispéroo is a family-focused AI chat application that helps parents have informed conversations about their children. The app provides personalized advice based on child profiles (age, development stage, etc.) and maintains conversation context through intelligent session management.