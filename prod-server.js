import { serve } from "bun";
import { join } from "path";
import { existsSync } from "fs";

// Create a production file server
const server = serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname;
    
    // Log the request
    console.log(`${req.method} - ${path}`);
    
    // Handle special routes
    if (path === "/") {
      path = "/index.html";
    } else if (path === "/define") {
      path = "/define.html";
    }
    
    // Try to serve the requested file
    try {
      // In production, all files are served from dist
      let filePath = join('dist', path);
      
      // Set appropriate content type based on file extension
      const headers = new Headers();
      if (path.endsWith('.js')) {
        headers.set('Content-Type', 'application/javascript');
      } else if (path.endsWith('.css')) {
        headers.set('Content-Type', 'text/css');
      } else if (path.endsWith('.html')) {
        headers.set('Content-Type', 'text/html');
      } else if (path.endsWith('.json')) {
        headers.set('Content-Type', 'application/json');
      } else if (path.endsWith('.svg')) {
        headers.set('Content-Type', 'image/svg+xml');
      } else if (path.endsWith('.png')) {
        headers.set('Content-Type', 'image/png');
      } else if (path.endsWith('.ico')) {
        headers.set('Content-Type', 'image/x-icon');
      } else if (path.endsWith('.webmanifest')) {
        headers.set('Content-Type', 'application/manifest+json');
      } else if (path.endsWith('.txt')) {
        headers.set('Content-Type', 'text/plain; charset=utf-8');
      }
      
      // Add cache control for static assets
      if (!path.endsWith('.html')) {
        headers.set('Cache-Control', 'public, max-age=31536000'); // 1 year
      }

      // Check if client accepts gzip and if we have a pre-compressed version
      const acceptEncoding = req.headers.get('accept-encoding') || '';
      const shouldCompress = path.match(/\.(js|css|json|txt)$/);
      const gzipPath = `${filePath}.gz`;
      
      if (acceptEncoding.includes('gzip') && shouldCompress && existsSync(gzipPath)) {
        const gzipFile = Bun.file(gzipPath);
        headers.set('Content-Encoding', 'gzip');
        headers.set('Vary', 'Accept-Encoding');
        return new Response(gzipFile, { headers });
      }
      
      const file = Bun.file(filePath);
      return file.exists().then(exists => {
        if (exists) {
          return new Response(file, { headers });
        } else {
          console.error(`File not found: ${filePath}`);
          return new Response("Not Found", { status: 404 });
        }
      });
    } catch (error) {
      console.error(`Error serving ${path}:`, error);
      return new Response("Server Error", { status: 500 });
    }
  },
});

console.log(`Production server running at http://localhost:${server.port}`); 