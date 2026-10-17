export function startStarfield(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  let w = 0;
  let h = 0;
  let raf = 0;
  const stars = [];

  function resize() {
    w = canvas.width = window.innerWidth * devicePixelRatio;
    h = canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    stars.length = 0;
    const count = Math.floor((window.innerWidth * window.innerHeight) / 9000);
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        z: Math.random() * 0.8 + 0.2,
        a: Math.random() * 0.6 + 0.2,
      });
    }
  }

  function frame() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const s of stars) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(160, 230, 255, ${s.a})`;
      ctx.arc(s.x, s.y, s.z * 1.4, 0, Math.PI * 2);
      ctx.fill();
      s.y += s.z * 0.15;
      if (s.y > window.innerHeight) {
        s.y = 0;
        s.x = Math.random() * window.innerWidth;
      }
    }
    raf = requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
  };
}
