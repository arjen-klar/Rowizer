let dx = 0;
let dy = 0;

function pixelSaverMove() {
  const step = 1; // 1 pixel
  const dir = Math.floor(Math.random() * 4);

  if (dir === 0) dy -= step;      // omhoog
  else if (dir === 1) dy += step; // omlaag
  else if (dir === 2) dx -= step; // links
  else if (dir === 3) dx += step; // rechts

  document.body.style.transform = `translate(${dx}px, ${dy}px)`;
  document.body.style.transition = "transform 0.2s linear";
}

// elke 50 seconden
setInterval(pixelSaverMove, 50000);