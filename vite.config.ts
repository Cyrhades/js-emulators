import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

// Custom Vite plugin to serve static image assets from /emulators/* directly from emulators/ or public/emulators/
function serveEmulatorsStaticPlugin(): Plugin {
  return {
    name: "serve-emulators-static",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith("/emulators/")) {
          const cleanUrl = req.url.split("?")[0];
          const ext = path.extname(cleanUrl).toLowerCase();
          
          // Intercept image and 3D assets, leave code files (.ts, .tsx, .js, .jsx, .json) to Vite!
          const staticExtensions = [
            ".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".ico", ".bmp",
            ".obj", ".mtl", ".gltf", ".glb", ".bin"
          ];
          if (staticExtensions.includes(ext)) {
            const relativePath = cleanUrl.replace(/^\/emulators\//, "");
            const emulatorsPath = path.resolve(__dirname, "emulators", relativePath);
            const publicEmulatorsPath = path.resolve(__dirname, "public", "emulators", relativePath);

            let targetFile = "";
            if (fs.existsSync(emulatorsPath) && fs.statSync(emulatorsPath).isFile()) {
              targetFile = emulatorsPath;
            } else if (fs.existsSync(publicEmulatorsPath) && fs.statSync(publicEmulatorsPath).isFile()) {
              targetFile = publicEmulatorsPath;
            }

            if (targetFile) {
              let contentType = "application/octet-stream";
              if (ext === ".png") contentType = "image/png";
              else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
              else if (ext === ".webp") contentType = "image/webp";
              else if (ext === ".svg") contentType = "image/svg+xml";
              else if (ext === ".gif") contentType = "image/gif";
              else if (ext === ".obj" || ext === ".mtl") contentType = "text/plain";
              else if (ext === ".gltf" || ext === ".json") contentType = "application/json";

              res.writeHead(200, { "Content-Type": contentType });
              fs.createReadStream(targetFile).pipe(res);
              return;
            }
          }
        }
        next();
      });
    },
  };
}

function serveIgdbProxyPlugin(): Plugin {
  return {
    name: "serve-igdb-proxy",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith("/igdb-proxy/")) {
          const targetPath = req.url.replace(/^\/igdb-proxy/, "");
          const targetUrl = `https://api.igdb.com${targetPath}`;

          const buffers: Buffer[] = [];
          req.on("data", (chunk) => buffers.push(chunk));
          req.on("end", async () => {
            const body = Buffer.concat(buffers).toString("utf-8");

            const headers: Record<string, string> = {
              "Content-Type": "text/plain",
            };
            if (req.headers["client-id"]) {
              headers["Client-ID"] = req.headers["client-id"] as string;
            }
            if (req.headers["authorization"]) {
              headers["Authorization"] = req.headers["authorization"] as string;
            }

            try {
              const fetchRes = await fetch(targetUrl, {
                method: "POST",
                headers,
                body,
              });

              const data = await fetchRes.text();
              res.writeHead(fetchRes.status, {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
              });
              res.end(data);
            } catch (err: any) {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: err?.message || "Proxy request failed" }));
            }
          });
          return;
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), serveEmulatorsStaticPlugin(), serveIgdbProxyPlugin()],
  server: {
    port: 3000,
    open: true,
    watch: {
      ignored: ["**/*.jpg", "**/*.png", "**/*.webp"]
    }
  }
});
