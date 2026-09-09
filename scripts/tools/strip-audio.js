const ffmpeg = require("ffmpeg-static");
const { execSync } = require("child_process");
const fs = require("fs");

console.log("Stripping audio track from public/videos/hero-loop.mp4...");
const tempOut = "public/videos/hero-loop-silent.mp4";
const target = "public/videos/hero-loop.mp4";

execSync(`"${ffmpeg}" -i "${target}" -an -c:v copy "${tempOut}" -y`);
fs.copyFileSync(tempOut, target);
fs.unlinkSync(tempOut);
console.log("Successfully stripped audio track from hero-loop.mp4!");
