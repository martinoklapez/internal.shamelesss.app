# Onboarding Component System

## Overview

The onboarding system now supports component-based screen creation. Instead of manually typing `component_id`, users select from a dropdown of available components that match the mobile app's component registry.

## What's Been Implemented

### 1. Component Registry Database
- **Table**: `onboarding_components`
- **Migration**: `018_create_onboarding_components_table.sql`
- Stores component metadata: `component_key`, `component_name`, `category`, `description`, `props_schema`, `default_options`

### 2. Component Selection UI
- Updated `OnboardingScreenDialog` to use a `Select` dropdown instead of free-form text input
- Components are filtered by category (quiz/conversion)
- Shows component description when selected
- Auto-fills `default_options` when a component is selected

### 3. API Endpoints
- `GET /api/onboarding/components?category=quiz|conversion` - Fetches available components

### 4. Documentation
- `MOBILE_COMPONENT_EXTRACTION_GUIDE.md` - Guide for extracting components from mobile app
- `REACT_NATIVE_WEB_SETUP.md` - Guide for setting up React Native Web rendering

## Next Steps

### Step 1: Run Database Migration
```bash
# Run the migration in your Supabase SQL editor
# File: supabase/migrations/018_create_onboarding_components_table.sql
```

### Step 2: Extract Components from Mobile App
Follow `MOBILE_COMPONENT_EXTRACTION_GUIDE.md` to:
1. Identify all onboarding components in your React Native app
2. Extract component metadata (component_key, name, props, styles)
3. Document the props structure and default options

### Step 3: Populate Component Registry
Insert components into the `onboarding_components` table:

```sql
INSERT INTO public.onboarding_components (component_key, component_name, category, description, props_schema, default_options)
VALUES 
  ('age_staging', 'Age Staging', 'quiz', 'Age input screen', 
   '{"title": "string", "description": "string", "options": {"placeholder": "string", "min": "number", "max": "number"}}'::jsonb,
   '{"placeholder": "Enter your age", "min": 18, "max": 100}'::jsonb),
  -- ... add all your components
```

### Step 4: (Optional) Set Up React Native Web
To render actual mobile app screens instead of mockups:
1. Follow `REACT_NATIVE_WEB_SETUP.md`
2. Install `react-native-web`
3. Create component registry mapping
4. Update `ScreenNode` to render actual components

## Current Behavior

- **Component Selection**: Users can now select from a dropdown of registered components
- **Custom Components**: Users can still select "None (Custom)" to create screens without a registered component
- **Auto-fill Options**: When a component is selected, its `default_options` are automatically filled in the JSON editor
- **Component Description**: Shows helpful description text when a component is selected

## Component Registry Schema

```typescript
{
  id: string (UUID)
  component_key: string (unique) // Matches component_id in screens
  component_name: string // Display name
  category: 'quiz' | 'conversion'
  description: string | null
  props_schema: jsonb | null // JSON schema for props
  default_options: jsonb | null // Default values for options field
  created_at: timestamp
  updated_at: timestamp
}
```

## Usage

1. **Adding a New Screen**: Click "Add Quiz Screen" or "Add Conversion Screen"
2. **Select Component**: Choose from the dropdown of available components
3. **Customize**: Edit title, description, and options JSON as needed
4. **Save**: Component ID is automatically set based on selection

## Future Enhancements

- [ ] React Native Web rendering for actual screen previews
- [ ] Component preview thumbnails
- [ ] Props validation based on `props_schema`
- [ ] Visual options editor (instead of raw JSON)
- [ ] Component versioning

