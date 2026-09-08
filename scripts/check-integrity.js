const ffmpeg = require("ffmpeg-static");
const { execSync } = require("child_process");

console.log("Checking hero-loop.webm...");
try {
  const out1 = execSync(`"${ffmpeg}" -v error -i "public/videos/hero-loop.webm" -f null - 2>&1`).toString();
  console.log("WebM errors:", out1 || "None");
} catch (e) {
  console.log("WebM error caught:", e.message);
}

console.log("Checking hero-loop.mp4...");
try {
  const out2 = execSync(`"${ffmpeg}" -v error -i "public/videos/hero-loop.mp4" -f null - 2>&1`).toString();
  console.log("MP4 errors:", out2 || "None");
} catch (e) {
  console.log("MP4 error caught:", e.message);
}
