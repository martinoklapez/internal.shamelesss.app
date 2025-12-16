# Cursor Prompt for Mobile App

Copy and paste this prompt into your mobile app Cursor to extract onboarding component information:

---

**PROMPT:**

I need to extract all onboarding screen components from this React Native app to populate a component registry in my admin panel. Please help me:

1. **Find all onboarding screen components** used in the quiz/staging flow (pre-authentication) and conversion flow (post-authentication)

2. **For each component, extract:**
   - `component_key`: The unique identifier/key used to reference this component (e.g., "age_staging", "location_staging", "welcome_conversion")
   - `component_name`: Human-readable display name (e.g., "Age Staging", "Location Staging", "Welcome Screen")
   - `category`: Either "quiz" or "conversion" depending on when it appears in the flow
   - `description`: Brief description of what this component does
   - `props_schema`: The structure of props this component accepts, including:
     - `title`: type and whether required
     - `description`: type and whether required  
     - `options`: The structure of the JSONB options object (what fields it contains, their types, defaults)
   - `default_options`: Default values for the options JSONB field (as a JSON object)

3. **Output format:** Create a JSON array with all components, like this:

```json
[
  {
    "component_key": "age_staging",
    "component_name": "Age Staging",
    "category": "quiz",
    "description": "Screen for collecting user's age",
    "props_schema": {
      "title": { "type": "string", "required": true },
      "description": { "type": "string", "required": false },
      "options": {
        "placeholder": { "type": "string", "default": "Enter your age" },
        "min": { "type": "number", "default": 18 },
        "max": { "type": "number", "default": 100 }
      }
    },
    "default_options": {
      "placeholder": "Enter your age",
      "min": 18,
      "max": 100
    }
  },
  {
    "component_key": "location_staging",
    "component_name": "Location Staging",
    "category": "quiz",
    "description": "Screen for collecting user's location",
    "props_schema": {
      "title": { "type": "string", "required": true },
      "description": { "type": "string", "required": false },
      "options": {
        "allowCurrentLocation": { "type": "boolean", "default": true },
        "requirePreciseLocation": { "type": "boolean", "default": false }
      }
    },
    "default_options": {
      "allowCurrentLocation": true,
      "requirePreciseLocation": false
    }
  }
  // ... more components
]
```

4. **Also provide SQL INSERT statements** ready to use in Supabase:

```sql
INSERT INTO public.onboarding_components (component_key, component_name, category, description, props_schema, default_options)
VALUES 
  ('age_staging', 'Age Staging', 'quiz', 'Screen for collecting user''s age', 
   '{"title": {"type": "string", "required": true}, "description": {"type": "string", "required": false}, "options": {"placeholder": {"type": "string", "default": "Enter your age"}, "min": {"type": "number", "default": 18}, "max": {"type": "number", "default": 100}}}'::jsonb,
   '{"placeholder": "Enter your age", "min": 18, "max": 100}'::jsonb),
  -- ... more INSERT statements
;
```

5. **Look for:**
   - Component files in folders like `screens/onboarding/`, `components/onboarding/`, `screens/staging/`, etc.
   - Navigation/routing files that define the onboarding flow
   - Any configuration files that map component keys to components
   - Type definitions or interfaces for component props

6. **Identify the authentication screen** that sits between quiz and conversion screens (this doesn't need to be in the registry, but note it for reference)

Please search through the codebase and extract all this information in the formats above.

---

**After you get the output:**

1. Copy the JSON array and save it for reference
2. Copy the SQL INSERT statements
3. Run the SQL in your Supabase SQL editor to populate the `onboarding_components` table
4. The admin panel will then show these components in the dropdown when creating new screens

