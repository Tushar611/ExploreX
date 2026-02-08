# Nomad Connect

## Overview

Nomad Connect is a mobile social networking app for van life / digital nomad communities. It's built as a React Native (Expo) app with an Express.js backend. The app lets users discover and match with other nomads (Tinder-style swiping), chat with matches, organize group activities, browse community forums, and access AI-powered features like a travel advisor chatbot, photo analysis, and van build cost estimation. It also includes safety features like an SOS button with shake detection.

The project follows a client-server architecture where the Expo app communicates with an Express API. Data is stored in PostgreSQL via Supabase, and the schema is managed with Drizzle ORM.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Project Structure

- `client/` — React Native app code (screens, components, navigation, hooks, context, lib utilities)
- `server/` — Express.js backend (API routes, storage layer)
- `shared/` — Shared code between client and server (database schema with Drizzle ORM)
- `app/` — Expo Router entry points (minimal, delegates to `client/navigation/RootStackNavigator`)
- `components/` — Root-level component duplicates (used by Expo Router's `app/` directory)
- `assets/` — Images, fonts, and other static assets
- `scripts/` — Build scripts for static web export
- `migrations/` — Drizzle ORM migration files

### Frontend Architecture

- **Framework**: React Native with Expo SDK 54, using the managed workflow
- **Navigation**: React Navigation v7 with a native stack navigator at the root, bottom tabs for main sections (Discover, Connections, AI Advisor, Activities, Profile), and nested stack navigators per tab
- **State Management**: React Context API for auth, data, theme, and subscription state. TanStack React Query for server state/caching
- **Styling**: StyleSheet with a custom theming system supporting light/dark modes. Uses a warm sunset color palette (orange/coral tones). Theme is stored in AsyncStorage for persistence
- **Animations**: React Native Reanimated for gesture-based animations and transitions
- **UI Components**: Custom component library (ThemedText, ThemedView, Icon, GradientButton, SwipeCard, etc.) — no external UI framework
- **Path Aliases**: `@/` maps to `./client/`, `@shared/` maps to `./shared/` (configured in both babel and tsconfig)

### Backend Architecture

- **Server**: Express.js running on port 5000 (configured in `server/index.ts`)
- **API Pattern**: RESTful JSON API. Routes registered in `server/routes.ts`
- **CORS**: Dynamic origin allowlist based on Replit environment variables, plus localhost support for dev
- **AI Integration**: Groq API (LLaMA 3.1 8B model) for the AI chatbot, photo analysis, cost estimation, and compatibility scoring
- **Storage Abstraction**: `IStorage` interface in `server/storage.ts` with an in-memory implementation (`MemStorage`). This is the basic user CRUD layer — most data operations go through Supabase directly in routes
- **Build**: Server bundles with esbuild for production (`server:build` script)

### Database

- **Provider**: PostgreSQL via Supabase
- **ORM**: Drizzle ORM with `drizzle-zod` for schema validation
- **Schema** (`shared/schema.ts`): Tables include `users`, `password_reset_otps`, `ai_chat_sessions`, `activities`, and more
- **Migrations**: Managed via `drizzle-kit push` (schema-push approach, not file-based migrations)
- **Direct DB Access**: The server uses both a `pg` Pool (direct PostgreSQL connection) and the Supabase client for different operations

### Authentication

- **Provider**: Supabase Auth (email/password)
- **Client**: Supabase JS client initialized in `client/lib/supabase.ts`
- **Server**: Supabase Admin client with service role key for server-side operations
- **Password Reset**: Custom OTP-based flow stored in a dedicated database table
- **Session Persistence**: Auth state persisted via AsyncStorage

### Subscription / Monetization

- **Provider**: RevenueCat for in-app purchases
- **Tiers**: Free, Pro, Expert, Lifetime
- **Gating**: `PremiumGate` component wraps premium features and shows upgrade prompts

### Key Features by Screen

- **Discover** — Swipe cards for matching with other users
- **Connections/Matches** — Chat with matched users (text, photos, location sharing, files, audio)
- **Activities** — Create/join group activities with location picking, safety ratings, and activity chat
- **AI Advisor** — AI chatbot, photo analysis, cost estimator, expert marketplace
- **Profile** — User profile editing, travel badges, verification, theme customization
- **SOS** — Emergency button with shake-to-trigger, SMS/call integration, location sharing
- **Social Radar** — Nearby nomad discovery
- **Forum** — Community posts with categories and upvoting

## External Dependencies

### Core Services

- **Supabase** — PostgreSQL database, authentication, and file storage (photo/file uploads)
  - Env vars: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - Storage bucket configured via `EXPO_PUBLIC_SUPABASE_BUCKET`
- **PostgreSQL** — Direct connection via `DATABASE_URL` environment variable (used by Drizzle and pg Pool)
- **Groq API** — AI chat completions using LLaMA 3.1 8B Instant model
  - Env var: `GROQ_API_KEY`
- **RevenueCat** — In-app purchase and subscription management
  - Configured in `client/services/revenuecat`

### Key NPM Packages

- `expo` (SDK 54) — Core framework
- `@react-navigation/*` — Navigation (native stack, bottom tabs)
- `react-native-reanimated` — Animations
- `react-native-gesture-handler` — Gesture handling (swipe cards, swipeable messages)
- `@tanstack/react-query` — Server state management
- `drizzle-orm` / `drizzle-kit` — Database ORM and migrations
- `@supabase/supabase-js` — Supabase client
- `expo-image-picker` — Photo selection
- `expo-location` — GPS/location services
- `expo-audio` — Audio recording/playback
- `expo-document-picker` — File selection
- `expo-sensors` — Accelerometer for shake detection (SOS)
- `expo-sms` — SMS sending (SOS)
- `react-native-maps` — Map views (optional, graceful fallback if unavailable)
- `react-native-keyboard-controller` — Keyboard-aware views
- `react-native-svg` — Custom SVG icons and illustrations
- `expo-linear-gradient` — Gradient backgrounds and buttons

### Environment Variables Required

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key (server only) |
| `GROQ_API_KEY` | Groq AI API key |
| `EXPO_PUBLIC_DOMAIN` | Public domain for API requests |
| `EXPO_PUBLIC_SUPABASE_BUCKET` | Supabase storage bucket name |