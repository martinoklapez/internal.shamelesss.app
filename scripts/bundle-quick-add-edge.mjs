import { build } from 'esbuild'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(root, '..')

await build({
  entryPoints: [path.join(projectRoot, 'lib/edge/quick-add-worker-entry.ts')],
  outfile: path.join(
    projectRoot,
    'supabase/functions/_shared/quick-add-worker.bundle.mjs'
  ),
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  // Bundle app deps (e.g. libphonenumber-js); Supabase client is provided by Edge via npm:
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

console.log('Bundled quick-add worker → supabase/functions/_shared/quick-add-worker.bundle.mjs')
