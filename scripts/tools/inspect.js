const ffmpegPath = require("ffmpeg-static");
const { execSync } = require("child_process");

console.log("FFMPEG:", ffmpegPath);
try {
  const res = execSync(`"${ffmpegPath}" -i "public/videos/hero-loop.webm" 2>&1`).toString();
  console.log("WEBM:\n", res.split("\n").filter(l => l.includes("Duration") || l.includes("Stream")).join("\n"));
} catch (e) {
  console.log("WEBM output:\n", (e.stdout || e.message).toString().split("\n").filter(l => l.includes("Duration") || l.includes("Stream")).join("\n"));
}

try {
  const res = execSync(`"${ffmpegPath}" -i "public/videos/hero-loop.mp4" 2>&1`).toString();
  console.log("MP4:\n", res.split("\n").filter(l => l.includes("Duration") || l.includes("Stream")).join("\n"));
} catch (e) {
  console.log("MP4 output:\n", (e.stdout || e.message).toString().split("\n").filter(l => l.includes("Duration") || l.includes("Stream")).join("\n"));
}
