import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import vue from '@astrojs/vue';
import sentry from '@sentry/astro';

// Ensure environment variables are loaded
import dotenv from 'dotenv';
dotenv.config();

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: netlify({
    edgeMiddleware: true,
    split: true,
  }),
  integrations: [
    vue({
      template: {
        compilerOptions: { isCustomElement: (tag) => tag.startsWith('sl-') },
      },
      devtools: false,
    }),
    sentry({
      dsn: 'https://63a5e1fe7a29dc3df46923bd277aa87e@o4505086842437632.ingest.us.sentry.io/4508463077588992',
      sourceMapsUploadOptions: {
        project: 'eventua11y',
        authToken: process.env.SENTRY_AUTH_TOKEN,
      },
    }),
  ],
});
