
# Gemini Workspace Memo

This document provides a high-level overview of the Whisperoo Family Bloom web application, its technical stack, and development conventions to guide future development.

## 1. Project Overview

**Name:** Whisperoo Family Bloom

**Purpose:** A web application designed for families, likely to help parents and caregivers connect and share information. The application features user authentication, a detailed onboarding process to collect family information, and a dashboard.

**Key Features:**

*   **User Authentication:** Users can create an account, log in, and verify their identity using OTP. Google authentication is also available.
*   **Onboarding Flow:** A multi-step process to gather information about the user, including their role in the family (mom, dad, caregiver), whether they are expecting, and the number and ages of their children.
*   **Dashboard:** A central hub for users after they have completed the onboarding process.
*   **Profile Management:** Users can manage their profile information.

## 2. Technical Stack

**Frontend:**

*   **Framework:** React
*   **Language:** TypeScript
*   **Build Tool:** Vite
*   **Styling:** Tailwind CSS with PostCSS
*   **UI Components:** A rich set of custom UI components, likely based on a library like Shadcn/UI, are located in `src/components/ui`.

**Backend:**

*   **Service:** Supabase is used for the database, authentication, and backend logic.
*   **Database:** PostgreSQL with a schema defined in `database-schema.sql`. The schema includes tables for `profiles` and `kids`.
*   **Authentication:** Supabase Auth is used for user management and authentication, including email/password and Google OAuth.

**Linting and Formatting:**

*   **Linter:** ESLint (`eslint.config.js`)
*   **Formatter:** Prettier (likely used, but no explicit config file found)

## 3. Project Structure

The project follows a standard React application structure:

```
/
├── public/               # Static assets
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── layouts/      # Layout components (e.g., AuthLayout)
│   │   └── ui/           # Core UI elements (buttons, inputs, etc.)
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions
│   ├── pages/            # Application pages/routes
│   │   ├── auth/         # Authentication pages
│   │   └── onboarding/   # Onboarding flow pages
│   └── utils/            # Utility functions (e.g., auth helpers)
├── database-schema.sql   # Supabase database schema
├── package.json          # Project dependencies and scripts
└── vite.config.ts        # Vite configuration
```

## 4. Development Conventions

**State Management:**

*   Component-level state is managed with React hooks (`useState`, `useEffect`).
*   For global state, especially for authentication, Supabase's client is likely used to manage user sessions.

**Routing:**

*   React Router is used for client-side routing. The main routes are defined in `src/App.tsx`.

**API Interaction:**

*   The application interacts with the Supabase backend using the `@supabase/supabase-js` library. The Supabase client is initialized and used for database operations and authentication.

**Styling:**

*   Tailwind CSS is the primary styling solution. Utility classes are used directly in the JSX.
*   Custom styles are defined in `src/App.css` and `src/index.css`.

**Testing:**

*   There are no testing frameworks configured in the `package.json`. This is an area for future improvement.

## 5. How to Run the Application

1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Set up Supabase:**
    *   Create a new Supabase project.
    *   Run the SQL from `database-schema.sql` in the Supabase SQL editor to create the necessary tables and functions.
    *   Obtain the Supabase URL and anon key and add them to a `.env` file in the root of the project:
        ```
        VITE_SUPABASE_URL=your-supabase-url
        VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
        ```
3.  **Run the Development Server:**
    ```bash
    npm run dev
    ```

## 6. Future Development

*   **Add a testing framework:** Implement unit and integration tests using a framework like Jest and React Testing Library.
*   **Expand dashboard functionality:** Add more features to the dashboard to make it more useful for users.
*   **Implement profile editing:** Allow users to edit their profile information after onboarding.
*   **Flesh out the "lovable-uploads" feature:** The purpose of this feature is unclear, but it could be for users to upload photos or other files.
