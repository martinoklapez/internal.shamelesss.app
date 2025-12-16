# Mobile Component Extraction Guide

This guide will help you extract all dynamic screen components and their styles from your React Native mobile app to use in the web admin panel.

## Step 1: Identify All Onboarding Components

In your React Native app, find all components used in the onboarding flow. These are typically:
- Quiz/staging screens (pre-authentication)
- Conversion screens (post-authentication)

## Step 2: Extract Component Information

For each component, extract the following information:

### Component Metadata
```typescript
{
  component_key: "age_staging",           // Unique identifier (used as component_id)
  component_name: "Age Staging",           // Display name
  category: "quiz" | "conversion",        // Screen type
  description: "Component for age input",  // What it does
  props_schema: {                          // Expected props structure
    title: "string",
    description: "string",
    options: {
      placeholder?: "string",
      min?: "number",
      max?: "number",
      // ... other component-specific options
    }
  }
}
```

### Component Styles
Extract the visual styling information:
- Colors (background, text, borders)
- Typography (font sizes, weights, families)
- Spacing (padding, margins)
- Layout (flexbox properties, dimensions)
- Border radius
- Shadows/elevation

## Step 3: Create Component Registry

Create a JSON file or database table with all components:

```json
{
  "components": [
    {
      "component_key": "age_staging",
      "component_name": "Age Staging",
      "category": "quiz",
      "description": "Age input screen",
      "props_schema": {
        "title": "string",
        "description": "string",
        "options": {
          "placeholder": "string",
          "min": "number",
          "max": "number"
        }
      },
      "default_options": {
        "placeholder": "Enter your age",
        "min": 18,
        "max": 100
      }
    },
    // ... more components
  ]
}
```

## Step 4: Component Props Structure

For each component, document:
1. **Required props**: What must be provided
2. **Optional props**: What can be customized
3. **Options structure**: The JSONB `options` field structure
4. **Default values**: What happens if options are empty

## Step 5: Visual Style Extraction

For each component, extract:
- **Container styles**: Background, padding, border radius
- **Text styles**: Title, description, input text
- **Input styles**: Text inputs, sliders, radio buttons, etc.
- **Button styles**: Primary, secondary actions
- **Layout**: How elements are arranged

## Example Extraction Template

```typescript
// Component: Age Staging
{
  component_key: "age_staging",
  component_name: "Age Staging",
  category: "quiz",
  
  // Visual styles
  styles: {
    container: {
      backgroundColor: "#FFFFFF",
      padding: 20,
      borderRadius: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      color: "#000000",
      marginBottom: 8,
    },
    description: {
      fontSize: 16,
      color: "#666666",
      marginBottom: 24,
    },
    input: {
      height: 50,
      borderWidth: 1,
      borderColor: "#E0E0E0",
      borderRadius: 8,
      paddingHorizontal: 16,
    }
  },
  
  // Props structure
  props_schema: {
    title: { type: "string", required: true },
    description: { type: "string", required: false },
    options: {
      placeholder: { type: "string", default: "Enter your age" },
      min: { type: "number", default: 18 },
      max: { type: "number", default: 100 },
    }
  }
}
```

## Step 6: Export Component List

Once extracted, you can:
1. Import into the admin panel database
2. Use in the component selection dropdown
3. Render previews using react-native-web

## Next Steps

After extraction:
1. Add components to `onboarding_components` table
2. Update admin panel to use component registry
3. Implement react-native-web rendering for previews

