const fs = require("fs");
const path = require("path");
const ffmpegPath = require("ffmpeg-static");
const { execSync } = require("child_process");

console.log("Using ffmpeg binary:", ffmpegPath);

const srcPath = path.join(__dirname, "../public/videos/Metallic_cubes_circulating_on_track_202609062223.mp4");
const outDir = path.join(__dirname, "../public/videos");
const mp4Out = path.join(outDir, "hero-loop.mp4");
const webmOut = path.join(outDir, "hero-loop.webm");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.copyFileSync(srcPath, mp4Out);
console.log("Copied new MP4 to:", mp4Out);

console.log("Converting new video to WebM with VP9 (high quality, small size, loop-ready)...");
const command = `"${ffmpegPath}" -i "${mp4Out}" -c:v libvpx-vp9 -crf 28 -b:v 0 -an "${webmOut}" -y`;
execSync(command, { stdio: "inherit" });

console.log("WebM conversion completed successfully!");
const mp4Stat = fs.statSync(mp4Out);
const webmStat = fs.statSync(webmOut);
console.log(`New MP4 size: ${(mp4Stat.size / 1024 / 1024).toFixed(2)} MB`);
console.log(`New WebM size: ${(webmStat.size / 1024 / 1024).toFixed(2)} MB`);



