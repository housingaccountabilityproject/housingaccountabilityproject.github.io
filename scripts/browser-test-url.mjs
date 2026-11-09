import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// Use a local HTTP server where managed browsers disallow file URLs.
const base = process.env.SITE_TEST_BASE_URL;
export const localPageUrl = file => base
  ? new URL(file, base.endsWith('/') ? base : base + '/').href
  : pathToFileURL(resolve(file)).href;

// Keep analytics and all other external traffic out of browser QA.
export const routeLocalRequest = route => base && new URL(route.request().url()).origin === new URL(base).origin
  ? route.continue()
  : route.abort();
