# AI Characters Setup Guide

## Prerequisites

1. **Replicate API Token**: You need a Replicate API token
   - Get it from: https://replicate.com/account/api-tokens
   - Add to environment variables: `REPLICATE_API_TOKEN`

## Database Setup

1. **Run the SQL migration**:
   - Go to Supabase Dashboard > SQL Editor
   - Run the SQL from: `supabase/migrations/create_ai_characters_tables.sql`
   - This creates:
     - `ai_characters` table
     - `character_reference_images` table
     - `character_generated_images` table
     - All necessary indexes and RLS policies

## Storage Buckets Setup

1. **Create storage buckets** (see `supabase/STORAGE_SETUP.md`):
   - `character-references` (public)
   - `character-generated` (public)

## Environment Variables

Add to your `.env.local` or Vercel environment variables:
```
REPLICATE_API_TOKEN=your_replicate_api_token_here
```

## Replicate Model Configuration

Update the model identifier in `lib/replicate/client.ts`:
- Current placeholder: `'nano-banana-pro'`
- Replace with actual model identifier from Replicate (e.g., `'owner/nano-banana-pro'` or version hash)
- Check Replicate docs for the exact format

## Usage

1. **Create Characters**: Go to `/characters` page
2. **Add Reference Images**: Click on a character to manage reference images
3. **Set Default References**: Click the star icon on reference images to mark as default
4. **Generate Images**: Go to `/generate` page, select character, enter prompt, and generate

## Features

- Character management with CRUD operations
- Reference image library with default selection
- Image generation via Replicate Nano Banana Pro
- Automatic saving of generated images to character library
- Auto-incrementing generation numbers per character

