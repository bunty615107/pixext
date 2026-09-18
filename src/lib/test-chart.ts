export function generateTestChart(): Promise<File> {
  const width = 1280;
  const height = 720;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas is not available."));

  ctx.fillStyle = "#141410";
  ctx.fillRect(0, 0, width, height);

  const bars = ["#E24B4B", "#E08A2B", "#E0C84B", "#3FA66A", "#3B82C4", "#5B4FBF", "#D9D4C8", "#1A1916"];
  const barW = width / bars.length;
  bars.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(i * barW, 0, barW + 1, 160);
  });

  for (let x = 0; x < width; x++) {
    const t = x / (width - 1);
    const g = Math.round(t * 255);
    ctx.fillStyle = `rgb(${g},${g},${g})`;
    ctx.fillRect(x, 168, 1, 72);
  }

  const cell = 16;
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#F4F1EA" : "#2A2824";
      ctx.fillRect(48 + x * cell, 280 + y * cell, cell, cell);
    }
  }

  ctx.strokeStyle = "#E8E4D9";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(360, 360, 90, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(360, 270);
  ctx.lineTo(360, 450);
  ctx.moveTo(270, 360);
  ctx.lineTo(450, 360);
  ctx.stroke();

  ctx.fillStyle = "#B8C4B0";
  ctx.beginPath();
  ctx.arc(560, 320, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#E8E4D9";
  ctx.fillRect(640, 284, 120, 72);
  ctx.fillStyle = "#9A958A";
  ctx.beginPath();
  ctx.moveTo(800, 356);
  ctx.lineTo(860, 284);
  ctx.lineTo(920, 356);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#3A3834";
  ctx.lineWidth = 1;
  for (let i = 0; i < 24; i++) {
    ctx.beginPath();
    ctx.moveTo(980, 260 + i * 8);
    ctx.lineTo(1240, 260 + i * 8);
    ctx.stroke();
  }

  ctx.fillStyle = "#F4F1EA";
  ctx.font = "600 42px Outfit, sans-serif";
  ctx.fillText("PixExt test chart", 48, 520);
  ctx.fillStyle = "#9A958A";
  ctx.font = "400 22px Outfit, sans-serif";
  ctx.fillText("1280 × 720  ·  color bars  ·  grayscale  ·  edges", 48, 558);
  ctx.fillText("Use this to preview JPEG, WebP, PNG, BMP, ICO, and AVIF output.", 48, 592);

  ctx.fillStyle = "#E8E4D9";
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(48 + i * 28, 640, 2 + i, 28);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not create the test chart."));
        return;
      }
      resolve(new File([blob], "pixext-test-chart.png", { type: "image/png" }));
    }, "image/png");
  });
}
