import { build } from 'esbuild'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(root, '..')

await build({
  entryPoints: [path.join(projectRoot, 'lib/edge/outreach-sends-worker-entry.ts')],
  outfile: path.join(
    projectRoot,
    'supabase/functions/_shared/outreach-sends-worker.bundle.mjs'
  ),
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  external: [
    '@supabase/supabase-js',
    '@supabase/auth-js',
    '@supabase/functions-js',
    '@supabase/realtime-js',
    '@supabase/storage-js',
    '@supabase/postgrest-js',
  ],
  alias: {
    '@': projectRoot,
  },
  logLevel: 'info',
})

console.log(
  'Bundled outreach sends worker → supabase/functions/_shared/outreach-sends-worker.bundle.mjs'
)
