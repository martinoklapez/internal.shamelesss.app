# Admin Panel

A Next.js TypeScript web application with RadixUI components and Supabase authentication.

## Features

- Sign-in form (no signup)
- Protected routes with middleware
- Automatic redirect to `/games` after successful sign-in
- Sign-out functionality
- RadixUI components for UI
- Supabase for authentication and database

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Supabase:**
   - Create a new project at [supabase.com](https://supabase.com)
   - Get your project URL and anon key from the project settings
   - Create a `.env.local` file in the root directory:
     ```env
     NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```

3. **Create a user in Supabase:**
   - Go to your Supabase dashboard
   - Navigate to Authentication > Users
   - Create a new user manually (since signup is disabled)

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Open [http://localhost:3000](http://localhost:3000)** in your browser

## Project Structure

```
├── app/
│   ├── games/          # Protected games page
│   ├── globals.css     # Global styles
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Sign-in page
├── components/
│   ├── ui/             # RadixUI components
│   └── sign-out-button.tsx
├── lib/
│   ├── supabase/       # Supabase client utilities
│   └── utils.ts        # Utility functions
└── middleware.ts       # Route protection middleware
```

## Authentication Flow

1. User visits `/` (sign-in page)
2. User enters email and password
3. On successful sign-in, user is redirected to `/games`
4. Middleware protects `/games` route - unauthenticated users are redirected to `/`
5. Authenticated users visiting `/` are automatically redirected to `/games`

## Technologies

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **RadixUI** - Accessible UI components
- **Supabase** - Authentication and database
- **Tailwind CSS** - Styling

