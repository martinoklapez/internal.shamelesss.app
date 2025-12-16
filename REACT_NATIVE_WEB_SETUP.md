# React Native Web Setup Guide

This guide explains how to set up React Native Web rendering in the admin panel to display actual mobile app screens instead of mockups.

## Overview

To render React Native components on the web, you'll need to:
1. Install `react-native-web` and related dependencies
2. Set up a shared component library or import mobile app components
3. Create web-compatible wrappers for your onboarding screens
4. Update the onboarding manager to render actual components

## Step 1: Install Dependencies

```bash
npm install react-native-web react-native-svg
npm install --save-dev @types/react-native
```

## Step 2: Configure Next.js

Update `next.config.js` to handle React Native Web:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'react-native$': 'react-native-web',
    }
    config.resolve.extensions = [
      '.web.js',
      '.web.jsx',
      '.web.ts',
      '.web.tsx',
      ...config.resolve.extensions,
    ]
    return config
  },
}

module.exports = nextConfig
```

## Step 3: Create Component Renderer

Create a component that renders React Native screens based on `component_id`:

```typescript
// components/onboarding-screen-renderer.tsx
'use client'

import { View, Text, StyleSheet } from 'react-native-web'
import type { QuizScreen, ConversionScreen } from '@/types/onboarding'

interface ScreenRendererProps {
  screen: QuizScreen | ConversionScreen
  componentRegistry: Map<string, React.ComponentType<any>>
}

export function OnboardingScreenRenderer({ screen, componentRegistry }: ScreenRendererProps) {
  const Component = screen.component_id 
    ? componentRegistry.get(screen.component_id) 
    : null

  if (!Component) {
    // Fallback to styled preview
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{screen.title || 'Untitled Screen'}</Text>
        {screen.description && (
          <Text style={styles.description}>{screen.description}</Text>
        )}
      </View>
    )
  }

  // Render actual React Native component
  return (
    <Component
      title={screen.title}
      description={screen.description}
      options={screen.options}
    />
  )
}

const styles = StyleSheet.create({
  container: {
    width: 200,
    height: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
  },
})
```

## Step 4: Component Registry

Create a registry that maps `component_key` to React Native components:

```typescript
// lib/onboarding-component-registry.ts
import { AgeStagingScreen } from '@/mobile-components/AgeStagingScreen'
import { LocationStagingScreen } from '@/mobile-components/LocationStagingScreen'
// ... import all your mobile app components

export const componentRegistry = new Map([
  ['age_staging', AgeStagingScreen],
  ['location_staging', LocationStagingScreen],
  // ... map all component_keys to their components
])
```

## Step 5: Update Onboarding Manager

Update `components/onboarding-manager.tsx` to use the renderer:

```typescript
import { OnboardingScreenRenderer } from './onboarding-screen-renderer'
import { componentRegistry } from '@/lib/onboarding-component-registry'

// In ScreenNode component:
function ScreenNode({ data }: { data: any }) {
  // ... existing code ...
  
  return (
    <div className="relative">
      <OnboardingScreenRenderer 
        screen={screen} 
        componentRegistry={componentRegistry}
      />
      {/* Toggle, Edit, Delete buttons */}
    </div>
  )
}
```

## Step 6: Shared Component Library (Recommended)

For best results, create a shared component library:

```
mobile-app/
  components/
    onboarding/
      AgeStagingScreen.tsx
      LocationStagingScreen.tsx
      ...

admin-panel/
  components/
    mobile-components/  (symlink or copy from mobile-app)
      AgeStagingScreen.tsx
      LocationStagingScreen.tsx
      ...
```

Or use a monorepo structure:

```
packages/
  shared-components/
    src/
      onboarding/
        AgeStagingScreen.tsx
        ...
  mobile-app/
  admin-panel/
```

## Step 7: Style Compatibility

Ensure your React Native components use web-compatible styles:
- Use `StyleSheet.create()` for all styles
- Avoid platform-specific code (or use `Platform.select()`)
- Test all components render correctly on web

## Step 8: Testing

1. Test each component renders correctly
2. Verify props are passed correctly
3. Check that options JSONB is parsed and used properly
4. Ensure responsive behavior works

## Alternative: Component Preview API

If sharing components is complex, you could:
1. Create a preview API endpoint that renders components server-side
2. Return screenshots or HTML/CSS representations
3. Display these in the admin panel

## Next Steps

1. Extract components from mobile app (see `MOBILE_COMPONENT_EXTRACTION_GUIDE.md`)
2. Set up component registry
3. Install react-native-web
4. Update onboarding manager to use renderer
5. Test all screens render correctly

