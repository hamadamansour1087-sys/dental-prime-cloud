import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const reelIds = [
  "reel-01","reel-02","reel-03","reel-04","reel-05",
  "reel-06","reel-07","reel-08","reel-09","reel-10",
];

// Parse CLI args for which reels to render
const args = process.argv.slice(2);
const toRender = args.length > 0 ? args : reelIds;

console.log("Bundling...");
const bundled = await bundle({
  entryPoint: path.resolve(__dirname, "../src/reels-index.ts"),
  webpackOverride: (config) => config,
});

const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: { args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] },
  chromeMode: "chrome-for-testing",
});

fs.mkdirSync("/mnt/documents/hamd-reels", { recursive: true });

for (const id of toRender) {
  console.log(`Rendering ${id}...`);
  const composition = await selectComposition({ serveUrl: bundled, id, puppeteerInstance: browser });
  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: "h264",
    outputLocation: `/mnt/documents/hamd-reels/${id}.mp4`,
    puppeteerInstance: browser,
    muted: true,
    concurrency: 1,
  });
  console.log(`✅ ${id} done`);
}

await browser.close({ silent: false });
console.log("All reels rendered!");
