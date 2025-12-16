# Onboarding Screen Extraction Guide

## Goal
Extract React Native onboarding screen components and styles to render them in the web admin panel, replacing phone mockups with actual screen previews.

## Prompt for Mobile App Team

```
I need to extract all onboarding screen components and their styles from our React Native app 
so we can render them in our Next.js web admin panel. For each screen in the onboarding flow:

1. **Component Structure**: Provide the React Native component code for each screen
   - Include all props, state, and logic
   - Include all UI elements (Text, View, Image, Button, Input, etc.)
   - Include any animations or transitions

2. **Styling Information**: Extract all styles
   - StyleSheet definitions
   - Inline styles
   - Theme values (colors, spacing, typography)
   - Responsive breakpoints if any
   - Platform-specific styles (iOS vs Android)

3. **Screen Configuration**: For each screen, provide:
   - Screen ID/identifier (matches database `component_id`)
   - Props/configuration it accepts (from `options` JSONB field)
   - Default values
   - Validation rules
   - Event handlers and their event names (matches `event_name`)

4. **Dependencies**: List all:
   - React Native libraries used
   - Custom hooks
   - Utility functions
   - Assets (images, fonts, etc.)

5. **Data Flow**: Document:
   - How screen receives data (from props, context, state)
   - What data it displays
   - What actions it triggers
   - Navigation flow between screens

Please organize this by screen type:
- Quiz Screens (pre-authentication)
- Conversion Screens (post-authentication)
```

## Implementation Approaches

### Option 1: React Native Web (Recommended)
Convert React Native components to work on web using `react-native-web`.

**Pros:**
- Reuse exact same components
- Minimal code changes
- Consistent UI across platforms

**Cons:**
- Additional bundle size
- Some RN features don't translate perfectly

### Option 2: Shared Component Library
Create a monorepo with shared components that work in both RN and Web.

**Pros:**
- Type-safe sharing
- Better performance on web
- More control

**Cons:**
- More setup complexity
- Need to maintain compatibility

### Option 3: Style Extraction + Web Recreation
Extract styles and recreate components in React/Next.js.

**Pros:**
- Native web performance
- Full web feature access

**Cons:**
- More work to maintain
- Risk of UI drift

## Recommended: React Native Web Approach

### Step 1: Install Dependencies
```bash
npm install react-native-web react-native-svg
```

### Step 2: Create Screen Renderer Component
Create a component that:
- Takes screen data from database
- Maps `component_id` to actual React Native component
- Passes `options` JSONB as props
- Renders in a phone-like container

### Step 3: Style Mapping
Map React Native styles to web:
- `StyleSheet` → CSS-in-JS or Tailwind
- `View` → `div`
- `Text` → `span`/`p`
- `Image` → `img` or `next/image`
- `TouchableOpacity` → `button` or `div` with onClick

## Next Steps

1. Get screen components from mobile team using the prompt above
2. Set up React Native Web in this project
3. Create a screen renderer that maps `component_id` → component
4. Replace phone mockups with actual rendered screens
5. Add preview/edit mode toggle

