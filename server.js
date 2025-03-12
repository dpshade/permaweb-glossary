import { serve } from "bun";
import { join } from "path";

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
      path = "/public/index.html";
    }
    
    // Handle favicon.ico requests to prevent errors
    if (path === "/favicon.ico") {
      // Return an empty response with 204 No Content
      return new Response(null, { status: 204 });
    }
    
    // Try to serve the requested file
    try {
      // Remove leading slash for relative path
      const relativePath = path.startsWith('/') ? path.substring(1) : path;
      const file = Bun.file(relativePath);
      
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
          }
          
          return new Response(file, { headers });
        } else {
          console.error(`File not found: ${path}`);
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