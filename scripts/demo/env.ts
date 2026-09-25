import { resolve } from 'node:path';

// Every value the demo runs with, set here so nothing is read from .env (which
// holds production credentials) and nothing reaches a real service.

export const DEMO_DIR = resolve(process.env.DEMO_DIR ?? '.demo-db');
export const API_PORT = Number(process.env.DEMO_API_PORT ?? 8787);
export const CONSOLE_ORIGIN = process.env.DEMO_CONSOLE_ORIGIN ?? 'http://localhost:5173';
export const STOREFRONT = process.env.DEMO_STOREFRONT_ORIGIN ?? 'http://localhost:3300';
export const BRIDGE_SECRET = 'plaspool-local-demo-bridge-secret-0001';

const SERVICES = [
  'RESEND_API_KEY',
  'MAIL_FROM',
  'CLERK_SECRET_KEY',
  'PAYSTACK_SECRET_KEY',
  'PAYSTACK_BASE_URL',
  'FLUTTERWAVE_SECRET_KEY',
  'FLUTTERWAVE_WEBHOOK_HASH',
  'FLUTTERWAVE_BASE_URL',
  'PAYMENTS_CALLBACK_URL',
  'CRON_SECRET',
  'FEZ_USER_ID',
  'FEZ_PASSWORD',
  'FEZ_SECRET_KEY',
  'FEZ_BASE_URL',
  'TERMINAL_SECRET_KEY',
  'TERMINAL_BASE_URL',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
  'R2_ACCOUNT_ID',
  'R2_BUCKET',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
];
for (const name of SERVICES) delete process.env[name];

Object.assign(process.env, {
  NODE_ENV: 'development',
  DATABASE_URL: 'pglite://local-demo',
  SESSION_SECRET: 'plaspool-local-demo-session-secret-0001',
  APP_ORIGINS: [CONSOLE_ORIGIN, STOREFRONT].join(','),
  STOREFRONT_ORIGIN: STOREFRONT,
  ADMIN_ORIGIN: CONSOLE_ORIGIN,
  BRAND_ASSET_ORIGIN: CONSOLE_ORIGIN,
  SHOP_AUTH_BRIDGE_SECRET: BRIDGE_SECRET,
  DEMO_OBJECTS_DIR: resolve(DEMO_DIR, 'objects'),
});
