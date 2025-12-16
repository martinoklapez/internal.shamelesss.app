# Onboarding Components Registry

This document contains the extracted component registry for the Shameless app's onboarding and conversion flows.

## Component Categories

### Quiz Components (Pre-Authentication)
These components appear in the `quiz_screens_staging` flow before user authentication:
- `loading` - Animated loading screen
- `options` - Standard radio button group
- `instant_radio` - Radio group with social icons
- `name_input` - Name text input
- `username_input` - Username text input
- `age_input` - Age numeric input
- `profile_image` - Profile photo upload
- `frequency_slider` - Frequency selection slider (1x-5x)
- `satisfaction_slider` - Satisfaction rating slider (1-5)
- `testimonial_loader` - Testimonial carousel loader
- `info` - Simple info screen (title + description)

### Conversion Components (Post-Authentication)
These components appear in the `conversion_screens_staging` flow after authentication:
- All quiz components (listed above) - Can be reused in conversion flow
- `quiz_results` - Quiz results comparison chart
- `rate_app_blurred` - App rating prompt with blur overlay
- `rate_app_default` - App rating prompt without blur

## Authentication Flow

The authentication screens sit between the quiz and conversion flows. These are handled separately and are **not** part of the component registry, as they are static screens, not dynamically configured components.

## Usage Instructions

1. **Run Database Migrations**:
   - First run: `018_create_onboarding_components_table.sql` (creates the table)
   - Then run: `019_insert_onboarding_components.sql` (populates the components)

2. **Admin Panel Integration**: 
   - The admin panel will now show these components in a dropdown when creating new screens
   - Use the `component_key` as the value for the `component_id` field in `quiz_screens_staging` or `conversion_screens_staging` tables

3. **Component Selection**:
   - When adding a new screen, select a component from the dropdown
   - The component's `default_options` will automatically populate the options JSON field
   - You can still customize the options JSON as needed

## Component Details

### Loading Screen (`loading`)
- **Category**: quiz
- **Auto-advances**: Yes (after completion)
- **Special Behavior**: Skips automatically if it's the first screen in the flow
- **Options**: None required

### Options (Radio Group) (`options`)
- **Category**: quiz
- **Requires Selection**: Yes
- **Options Format**: 
  ```json
  {
    "options": [
      {"id": "1", "label": "Option 1", "value": "option1"},
      {"id": "2", "label": "Option 2", "value": "option2"}
    ]
  }
  ```
- **Saves Response**: Yes (via `onboarding_responses` table)

### Instant Radio (`instant_radio`)
- **Category**: quiz
- **Auto-advances**: Yes (on selection)
- **Special Features**: Automatic icon detection for social platforms (Instagram, TikTok, Reddit, YouTube, Twitter/X, Facebook, App Store, Website, Partner/GF/BF)
- **Options Format**: Same as `options` component

### Input Components
All input components validate input and save directly to the user's profile:

- **Name Input** (`name_input`): Validates minimum 2 characters
- **Username Input** (`username_input`): Validates minimum 3 characters, alphanumeric + underscore only, checks availability
- **Age Input** (`age_input`): Validates age between 18 and 120
- **Profile Image** (`profile_image`): Opens photo library, allows cropping, can be skipped

### Slider Components
Both slider components use discrete steps (1-5):

- **Frequency Slider** (`frequency_slider`): Shows frequency labels (1x-5x)
- **Satisfaction Slider** (`satisfaction_slider`): Shows satisfaction labels with emoji markers (😡 😕 😐 🙂 🤩)

### Testimonial Loader (`testimonial_loader`)
- **Category**: quiz
- **Auto-advances**: Yes (after 6 seconds)
- **Special Features**: Rotates through user reviews/testimonials, shows circular progress indicator
- **Options**: 
  - `duration`: Total display time (default: 6000ms)
  - `carouselInterval`: Time between testimonial changes (default: 1500ms)

### Info Screen (`info`)
- **Category**: quiz
- **Behavior**: Simple screen with title and description, requires manual "Next" button press
- **Use Case**: Information-only screens with no interactive components

### Quiz Results (`quiz_results`)
- **Category**: conversion
- **Description**: Displays comparison chart showing current vs potential improvement
- **Options**: None required

### Rate App Components
Both rate app components trigger the native app store review dialog:

- **Rate App Blurred** (`rate_app_blurred`): 
  - Shows blurred overlay with 4-second countdown
  - Blocks navigation until countdown completes
  
- **Rate App Default** (`rate_app_default`): 
  - Shows review prompt immediately
  - Always allows navigation (shows Next button)

## Database Tables

- **Quiz Screens**: `quiz_screens_staging` table
- **Conversion Screens**: `conversion_screens_staging` table
- **Component Registry**: `onboarding_components` table

## Files

1. `onboarding_components_registry.json` - JSON array of all components (for reference)
2. `supabase/migrations/019_insert_onboarding_components.sql` - SQL INSERT statements with ON CONFLICT handling
3. `ONBOARDING_COMPONENTS_REGISTRY.md` - This documentation file

## Next Steps

1. Run the migrations in Supabase SQL editor
2. Test component selection in the admin panel
3. Create new onboarding screens using the component dropdown
4. (Optional) Set up React Native Web rendering for live previews (see `REACT_NATIVE_WEB_SETUP.md`)

