// A sample label so a first-time user sees a finished can before uploading anything.
// Sized to the 440 ml standard print template (206 × 141.4 mm).

export function demoArtwork(): string {
  const w = 2060;
  const h = 1414;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#123f31");
  bg.addColorStop(1, "#0a241c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#e3bd62";
  ctx.fillRect(0, 170, w, 12);
  ctx.fillRect(0, 1232, w, 12);

  // Hop cones on the back half of the wrap.
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#e3bd62";
  ctx.lineWidth = 6;
  for (const cx of [140, 1920]) {
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.ellipse(cx, 420 + i * 95, 90 - i * 10, 60, 0, 0, Math.PI);
      ctx.stroke();
    }
  }
  ctx.restore();

  ctx.textAlign = "center";
  ctx.fillStyle = "#f3e8cf";
  ctx.font = "700 230px Georgia, 'Times New Roman', serif";
  ctx.fillText("HOPWELL", w / 2, 660);
  ctx.fillStyle = "#e3bd62";
  ctx.font = "italic 92px Georgia, 'Times New Roman', serif";
  ctx.fillText("West Coast IPA", w / 2, 815);
  ctx.fillStyle = "#f3e8cf";
  ctx.font = "600 54px Arial, Helvetica, sans-serif";
  ctx.fillText("6.2% ABV  ·  440 ml", w / 2, 1090);
  ctx.font = "600 40px Arial, Helvetica, sans-serif";
  ctx.fillText("BREWED & CANNED IN SHEFFIELD", w / 2, 300);
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.arc(172 * i + 86, 1325, 28, 0, Math.PI * 2);
    ctx.fillStyle = "#e3bd62";
    ctx.fill();
  }
  return canvas.toDataURL("image/png");
}
