# Mobile App → Web Screen Extraction Prompt

## Instructions for Mobile App Team

I need to extract all onboarding screen components from our React Native mobile app so we can render them in our Next.js web admin panel. This will allow us to see actual screen previews instead of mockups.

## What I Need for Each Screen

### 1. Component Code
Provide the complete React Native component code for each onboarding screen, including:

```typescript
// Example structure I need:
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

export function AgeStagingScreen({ 
  title, 
  description, 
  onSubmit,
  // ... other props from options JSONB
}) {
  // Component implementation
  return (
    <View style={styles.container}>
      {/* Screen content */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { /* ... */ },
  // ... all styles
})
```

### 2. Component Identifier
- The `component_id` that matches what's stored in the database
- Example: `"age_staging"`, `"relationship_status"`, etc.

### 3. Props/Options Mapping
Document how the database `options` JSONB field maps to component props:

```json
// Database options example:
{
  "inputType": "number",
  "min": 18,
  "max": 100,
  "placeholder": "Enter your age",
  "buttonText": "Continue"
}

// Maps to component props:
<AgeStagingScreen 
  inputType="number"
  min={18}
  max={100}
  placeholder="Enter your age"
  buttonText="Continue"
/>
```

### 4. Styling Information
- All `StyleSheet` definitions
- Theme values (colors, spacing, typography)
- Any responsive breakpoints
- Platform-specific styles (iOS vs Android)

### 5. Dependencies
List all:
- React Native libraries (e.g., `@react-native-community/slider`)
- Custom hooks used
- Utility functions
- Assets (images, fonts) and their paths

### 6. Event Handlers
- What events the screen triggers (matches `event_name` in database)
- What data is sent with events
- Navigation actions

## Screen List

Please provide the above information for all screens in:

### Quiz Screens (Pre-Authentication)
- [ ] Age Staging
- [ ] Relationship Status
- [ ] Truth or Dare
- [ ] Relationship Duration
- [ ] Sex Frequency
- [ ] Relationship Goal
- [ ] Intimacy Satisfaction
- [ ] Dating Interval
- [ ] (Any others)

### Conversion Screens (Post-Authentication)
- [ ] Profile Photo
- [ ] Username
- [ ] Satisfaction Slider
- [ ] Quiz Results
- [ ] Personalizing Experience
- [ ] App Rating
- [ ] Age Input
- [ ] Frequency Slider
- [ ] Nickname
- [ ] Instant Radio
- [ ] (Any others)

## Delivery Format

Please provide:
1. **Component files** (one per screen) in a format that can be imported
2. **Style definitions** (can be separate or inline)
3. **Type definitions** (TypeScript interfaces for props)
4. **README** explaining:
   - How to map database `options` to props
   - Event naming conventions
   - Any special setup required

## Example Output Format

```typescript
// screens/onboarding/AgeStagingScreen.tsx
export interface AgeStagingScreenProps {
  title?: string
  description?: string
  min?: number
  max?: number
  placeholder?: string
  buttonText?: string
  onSubmit?: (age: number) => void
}

export function AgeStagingScreen(props: AgeStagingScreenProps) {
  // Implementation
}

// styles.ts
export const ageStagingStyles = StyleSheet.create({
  // Styles
})
```

## Questions?

If any screen has special requirements, animations, or complex logic, please document it clearly.

