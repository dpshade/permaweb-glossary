import { serve } from "bun";
import { join } from "path";
import { existsSync } from "fs";

// Create a simple file server
const server = serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname;
    
    // Log the request
    console.log(`${req.method} - ${path}`);
    
    // Default to index.html for root path
    if (path === "/") {
      path = "/index.html";
    }
    
    // Try to serve the requested file
    try {
      // Determine the file path - check in different directories
      let filePath;
      
      // First check if the file exists in public directory
      if (path.startsWith('/')) {
        filePath = join('public', path);
        
        // If file doesn't exist in public, check if it's in src directory
        if (!existsSync(filePath) && (path.startsWith('/src/'))) {
          // For src paths, look at the root level
          filePath = path.substring(1); // Remove leading slash
        }
      } else {
        filePath = path;
      }
      
      const file = Bun.file(filePath);
      
      // Check if the file exists before returning it
      return file.exists().then(exists => {
        if (exists) {
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
          }
          
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

console.log(`Server running at http://localhost:${server.port}`); 