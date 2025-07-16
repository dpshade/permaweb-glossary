import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  build: {
    inlineStylesheets: 'always'
  },
  server: {
    headers: {
      'X-Frame-Options': 'ALLOWALL',
      'Content-Security-Policy': "frame-ancestors *;"
    }
  },
  devToolbar: {
    enabled: false
  }
}); 