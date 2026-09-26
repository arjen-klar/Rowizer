let dx = 0;
let dy = 0;
const wrapper = document.getElementById("wrapper");

wrapper.style.position = "relative";
wrapper.style.transition = "left 0.2s linear, top 0.2s linear";

function pixelSaverMove() {
  const step = 1; // 1 pixel
  const dir = Math.floor(Math.random() * 4);

  if (dir === 0) dy -= step;      // omhoog
  else if (dir === 1) dy += step; // omlaag
  else if (dir === 2) dx -= step; // links
  else if (dir === 3) dx += step; // rechts

  wrapper.style.left = `${dx}px`;
  wrapper.style.top = `${dy}px`;
}

// elke 50 seconden
setInterval(pixelSaverMove, 50000);