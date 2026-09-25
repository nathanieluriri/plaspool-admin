#!/usr/bin/env node
// The console (Vite) for the demo API on :8787. The Clerk key is emptied so the
// page never loads the production Clerk instance; the demo signs in through
// /api/__demo/sign-in instead. Vite does not override variables already set.
import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['vite', '--port', '5173', '--strictPort'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, VITE_CLERK_PUBLISHABLE_KEY: '', API_PORT: '8787' },
});
process.exit(result.status ?? 0);
