
# Whisperoo Supabase Setup Guide

This guide will help you set up the Supabase backend for the Whisperoo onboarding application.

## Database Schema Setup

1. **Create a new Supabase project** at [supabase.com](https://supabase.com)

2. **Run the database schema**:
   - Go to the SQL Editor in your Supabase dashboard
   - Copy and paste the contents of `database-schema.sql`
   - Execute the script to create all tables, functions, and policies

## Environment Variables

Add these environment variables to your project:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Database Tables Created

### `profiles`
- Extends Supabase auth.users with additional user information
- Stores: first_name, email, role, custom_role, expecting_status, has_kids, kids_count, onboarded

### `kids`
- Stores individual child information for each parent
- Links to profiles via parent_id
- Stores flexible age information as text



## Key Features

### Authentication
- Email/password authentication through Supabase Auth
- Google OAuth support (requires additional configuration)
- Automatic profile creation on user signup

### Row Level Security (RLS)
- Users can only access their own data
- Secure policies for all tables
- Data isolation between users



## Next Steps for Implementation

1. **Install Supabase client**:
   ```bash
   npm install @supabase/supabase-js
   ```

2. **Create Supabase client configuration**:
   ```typescript
   // lib/supabase.ts
   import { createClient } from '@supabase/supabase-js'
   
   const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
   const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
   
   export const supabase = createClient(supabaseUrl, supabaseAnonKey)
   ```

3. **Replace localStorage auth utility** with actual Supabase auth
4. **Implement data persistence** in onboarding steps
5. **Add email verification** flow
6. **Set up Google OAuth** (optional)

## Database Functions Available


- `handle_new_user()` - Automatically creates profile on signup
- `update_updated_at_column()` - Updates timestamps on record changes

## Security Features

- Row Level Security enabled on all tables
- Users can only access their own data
- Secure functions with SECURITY DEFINER
- Proper indexing for performance
