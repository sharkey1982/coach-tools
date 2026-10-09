/* ============================================================================
   Coach Tools · shared full-screen celebration (fireworks)
   Rockets launch from the bottom of the screen and burst into coloured
   sparks across the WHOLE page, with a big pop-in banner. Pure canvas, no
   dependencies, never blocks taps (pointer-events: none), cleans itself up.

   Usage:
     Celebrate.fireworks({
       tier: "target",            // "target" | "big" | "huge" | "epic"
       title: "Daily target hit!",
       subtitle: "+8 coins",      // optional
       emoji: "✅",           // optional, shown above the title
     });

   Tiers get progressively longer/louder:
     target  ~5s   daily target / small wins
     big     ~7s   finishing a whole spelling list; 3/7-day streaks
     huge    ~9s   perfect score; 14/30-day streaks
     epic    ~13s  100/200-day streaks — adds confetti rain + a grand finale

   Calling it while a show is already running upgrades/extends that show
   instead of stacking a second canvas (e.g. target hit on the same answer
   that finishes the list).

   Honours prefers-reduced-motion with a short, gentle version.
   ============================================================================ */

(function () {
  if (window.Celebrate) return;

  const TIERS = {
    target: { duration: 5000,  rockets: 8,  burst: 70,  confetti: 0,   rank: 1 },
    big:    { duration: 7000,  rockets: 14, burst: 90,  confetti: 0,   rank: 2 },
    huge:   { duration: 9000,  rockets: 22, burst: 110, confetti: 60,  rank: 3 },
    epic:   { duration: 13000, rockets: 40, burst: 140, confetti: 160, rank: 4 },
  };
  const GRAVITY = 0.055;
  const MAX_PARTICLES = 1100;

  let show = null; // the one running show, if any

  function injectStyles() {
    if (document.getElementById("ct-celebrate-style")) return;
    const st = document.createElement("style");
    st.id = "ct-celebrate-style";
    st.textContent = `
      #ct-celebrate { position: fixed; inset: 0; z-index: 10000; pointer-events: none; overflow: hidden;
        background: rgba(6, 8, 26, 0); transition: background 0.5s ease-out; }
      #ct-celebrate.ct-on { background: rgba(6, 8, 26, 0.66); }
      #ct-celebrate canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
      #ct-celebrate .ct-banner {
        position: absolute; left: 50%; top: 24%; transform: translate(-50%, -50%) scale(0.3);
        width: min(92vw, 560px); text-align: center; opacity: 0;
        animation: ct-pop 0.7s cubic-bezier(.2,1.6,.4,1) 0.15s forwards;
        text-shadow: 0 3px 0 rgba(0,0,0,0.35), 0 0 28px rgba(0,0,0,0.45);
      }
      #ct-celebrate.ct-leaving .ct-banner { animation: ct-out 0.9s ease-in forwards; }
      #ct-celebrate.ct-leaving { transition: opacity 0.9s ease-in, background 0.5s; opacity: 0; }
      #ct-celebrate .ct-emoji { font-size: 64px; line-height: 1.1; animation: ct-bounce 0.9s ease-in-out infinite; }
      #ct-celebrate .ct-title {
        font-family: 'Oswald', 'Impact', sans-serif; font-weight: 700; text-transform: uppercase;
        font-size: clamp(34px, 11vw, 64px); line-height: 1.05; letter-spacing: 0.03em;
        background: linear-gradient(180deg, #FFF6B8 0%, #FFD23F 45%, #FF8A3D 100%);
        -webkit-background-clip: text; background-clip: text; color: transparent;
        -webkit-text-stroke: 1.5px rgba(80, 30, 0, 0.55);
        filter: drop-shadow(0 3px 0 rgba(0,0,0,0.35));
        text-shadow: none;
      }
      #ct-celebrate .ct-sub {
        margin-top: 8px; font-family: 'JetBrains Mono', monospace; font-weight: 700;
        font-size: clamp(15px, 4.4vw, 22px); color: #fff; letter-spacing: 0.04em;
      }
      @keyframes ct-pop { 0% { opacity: 0; transform: translate(-50%,-50%) scale(0.3) rotate(-6deg); }
                          100% { opacity: 1; transform: translate(-50%,-50%) scale(1) rotate(0); } }
      @keyframes ct-out { to { opacity: 0; transform: translate(-50%,-70%) scale(1.1); } }
      @keyframes ct-bounce { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-8px) scale(1.12); } }
      @media (prefers-reduced-motion: reduce) {
        #ct-celebrate .ct-emoji { animation: none; }
        #ct-celebrate .ct-banner { animation-duration: 0.01s; }
      }
    `;
    document.head.appendChild(st);
  }

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function makeShow(opts) {
    injectStyles();
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tier = TIERS[opts.tier] || TIERS.target;

    const root = document.createElement("div");
    root.id = "ct-celebrate";
    root.setAttribute("aria-hidden", "true");
    const confCanvas = document.createElement("canvas"); // confetti lives on its own canvas: the sparks canvas fades for trails, which would smear it
    root.appendChild(confCanvas);
    const canvas = document.createElement("canvas");
    root.appendChild(canvas);
    const banner = document.createElement("div");
    banner.className = "ct-banner";
    root.appendChild(banner);
    document.body.appendChild(root);
    requestAnimationFrame(() => root.classList.add("ct-on"));

    const ctx = canvas.getContext("2d");
    const confCtx = confCanvas.getContext("2d");
    let W = 0, H = 0, dpr = 1;
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = confCanvas.width = Math.round(W * dpr); canvas.height = confCanvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      confCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    const s = {
      root, banner, canvas, ctx, confCtx, tierName: opts.tier in TIERS ? opts.tier : "target",
      start: performance.now(), duration: reduced ? Math.min(tier.duration, 3000) : tier.duration,
      rockets: [], sparks: [], confetti: [], launches: [], finale: false,
      leaving: false, raf: 0, resize, reduced,
    };
    s.cfg = tier;
    scheduleLaunches(s, tier);
    setBanner(s, opts);
    return s;
  }

  function setBanner(s, opts) {
    s.banner.innerHTML =
      (opts.emoji ? `<div class="ct-emoji">${opts.emoji}</div>` : "") +
      `<div class="ct-title"></div>` +
      (opts.subtitle ? `<div class="ct-sub"></div>` : "");
    s.banner.querySelector(".ct-title").textContent = opts.title || "Well done!";
    const sub = s.banner.querySelector(".ct-sub");
    if (sub) sub.textContent = opts.subtitle;
  }

  function scheduleLaunches(s, tier) {
    const n = s.reduced ? 3 : tier.rockets;
    const window_ = s.duration * 0.72;
    for (let i = 0; i < n; i++) {
      // front-load a little so the screen lights up straight away, then spread the rest
      const t = i === 0 ? 0 : (i < 4 ? rand(0.1, 0.9) * 1000 : rand(0.6, 1) * window_ * (i / n) + rand(0, 400));
      s.launches.push(t);
    }
    s.launches.sort((a, b) => a - b);
    if (tier.rank >= 3 && !s.reduced) {
      // grand finale: a salvo near the end
      const base = s.duration * 0.78;
      for (let i = 0; i < 6 + tier.rank * 2; i++) s.launches.push(base + i * 120 + rand(0, 90));
      s.launches.sort((a, b) => a - b);
    }
    if (tier.confetti && !s.reduced) {
      for (let i = 0; i < tier.confetti; i++) {
        s.confetti.push({
          x: rand(0, 1), y: rand(-1.2, 0), vx: rand(-0.4, 0.4), vy: rand(1.2, 3.2),
          w: rand(6, 12), h: rand(4, 8), rot: rand(0, 6.28), vr: rand(-0.2, 0.2),
          color: `hsl(${Math.floor(rand(0, 360))},90%,60%)`, sway: rand(0, 6.28),
        });
      }
    }
  }

  function launchRocket(s) {
    const x = rand(W(s) * 0.12, W(s) * 0.88);
    const apex = rand(H(s) * 0.12, H(s) * 0.55);          // how high it climbs before bursting
    const vy = -Math.sqrt(2 * GRAVITY * (H(s) - apex)) * 1.0;
    s.rockets.push({ x, y: H(s) + 6, vx: rand(-0.6, 0.6), vy, hue: Math.floor(rand(0, 360)), trail: [] });
  }
  const W = (s) => s.canvas.width / (Math.min(window.devicePixelRatio || 1, 2));
  const H = (s) => s.canvas.height / (Math.min(window.devicePixelRatio || 1, 2));

  function explode(s, x, y, hue) {
    const count = Math.round(s.cfg.burst * (s.reduced ? 0.5 : rand(0.8, 1.15)));
    const style = pick(["round", "round", "ring", "double", "willow"]);
    const sat = 100, light = 60;
    const base = (h) => `hsl(${(h + 360) % 360},${sat}%,${light}%)`;
    const add = (ang, spd, color, life, size, drag) => {
      if (s.sparks.length >= MAX_PARTICLES) return;
      s.sparks.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, color, life, age: 0, size, drag });
    };
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + rand(-0.05, 0.05);
      if (style === "round") add(rand(0, 6.283), rand(0.6, 5.2), base(hue + rand(-25, 25)), rand(55, 95), rand(1.4, 2.6), 0.985);
      else if (style === "ring") add(ang, 4.4 + rand(-0.15, 0.15), base(hue), rand(60, 85), 2.4, 0.982);
      else if (style === "double") {
        add(ang, 4.8, base(hue), rand(60, 90), 2.3, 0.982);
        if (i % 2 === 0) add(ang, 2.4, base(hue + 140), rand(55, 80), 2.0, 0.982);
      } else add(rand(0, 6.283), rand(0.4, 4.2), `hsl(${40 + rand(-8, 8)},100%,${rand(60, 75)}%)`, rand(100, 150), 1.8, 0.99); // golden willow, long hang-time
    }
    // bright core flash
    for (let i = 0; i < 6 && s.sparks.length < MAX_PARTICLES; i++) {
      s.sparks.push({ x, y, vx: rand(-1, 1), vy: rand(-1, 1), color: "#fff", life: rand(10, 18), age: 0, size: rand(3, 5), drag: 0.9 });
    }
    if (navigator.vibrate && !s.reduced && Math.random() < 0.12) { try { navigator.vibrate(20); } catch (e) {} }
  }

  function frame(s, now) {
    const elapsed = now - s.start;
    const ctx = s.ctx, w = W(s), h = H(s);

    // fade previous frame for glowing trails (canvas is transparent so the page shows through)
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";

    // launches due
    while (s.launches.length && s.launches[0] <= elapsed) { s.launches.shift(); launchRocket(s); }

    // rockets
    for (let i = s.rockets.length - 1; i >= 0; i--) {
      const r = s.rockets[i];
      r.trail.push({ x: r.x, y: r.y }); if (r.trail.length > 9) r.trail.shift();
      r.x += r.vx; r.y += r.vy; r.vy += GRAVITY;
      ctx.beginPath();
      r.trail.forEach((p, j) => {
        ctx.fillStyle = `hsla(${r.hue},100%,75%,${(j / r.trail.length) * 0.8})`;
        ctx.fillRect(p.x - 1.2, p.y - 1.2, 2.4, 2.4);
      });
      ctx.fillStyle = "#fff"; ctx.fillRect(r.x - 1.8, r.y - 1.8, 3.6, 3.6);
      if (r.vy >= -0.4) { explode(s, r.x, r.y, r.hue); s.rockets.splice(i, 1); }
    }

    // sparks
    for (let i = s.sparks.length - 1; i >= 0; i--) {
      const p = s.sparks[i];
      p.age++; p.vx *= p.drag; p.vy = p.vy * p.drag + GRAVITY * 0.55;
      p.x += p.vx; p.y += p.vy;
      if (p.age > p.life) { s.sparks.splice(i, 1); continue; }
      const k = 1 - p.age / p.life;
      ctx.globalAlpha = Math.max(0, k);
      ctx.fillStyle = p.color;
      const sz = p.size * (0.5 + k * 0.6);
      ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
      if (p.age % 5 === 0 && Math.random() < 0.15) { // crackle glitter
        ctx.globalAlpha = 0.9; ctx.fillStyle = "#fff"; ctx.fillRect(p.x, p.y, 1.6, 1.6);
      }
    }
    ctx.globalAlpha = 1;

    // confetti (epic / huge) — own canvas, cleared every frame
    if (s.confetti.length) {
      const cc = s.confCtx;
      cc.clearRect(0, 0, w, h);
      s.confetti.forEach((c) => {
        c.y += c.vy / h; c.sway += 0.06; c.x += (c.vx + Math.sin(c.sway) * 0.5) / w; c.rot += c.vr;
        if (c.y > 1.1 && elapsed < s.duration * 0.8) { c.y = rand(-0.2, -0.02); c.x = rand(0, 1); }
        const px = c.x * w, py = c.y * h;
        if (py < -20 || py > h + 20) return;
        cc.save(); cc.translate(px, py); cc.rotate(c.rot); cc.fillStyle = c.color;
        cc.fillRect(-c.w / 2, -c.h / 2, c.w, c.h * (0.4 + Math.abs(Math.sin(c.sway)) * 0.6)); cc.restore();
      });
    }

    // the fade-out trick never quite reaches zero alpha, so wipe the canvas once the sky is empty
    if (!s.sparks.length && !s.rockets.length) { ctx.globalCompositeOperation = "source-over"; ctx.clearRect(0, 0, w, h); }

    const busy = s.rockets.length || s.sparks.length || s.launches.length;
    if (elapsed < s.duration || busy) {
      if (elapsed > s.duration + 9000) return finish(s); // hard stop safety net
      if (elapsed >= s.duration && !s.leaving) { s.leaving = true; s.root.classList.add("ct-leaving"); }
      s.raf = requestAnimationFrame((t) => frame(s, t));
    } else finish(s);
  }

  function finish(s) {
    cancelAnimationFrame(s.raf);
    window.removeEventListener("resize", s.resize);
    s.root.remove();
    if (show === s) show = null;
  }

  function fireworks(opts) {
    opts = opts || {};
    const want = TIERS[opts.tier] ? opts.tier : "target";
    if (show) {
      // a show is already running: extend it and upgrade the banner if the new one is bigger
      const cur = TIERS[show.tierName];
      const nu = TIERS[want];
      if (nu.rank > cur.rank) { show.tierName = want; show.cfg = nu; setBanner(show, opts); }
      else if (opts.title && nu.rank === cur.rank) setBanner(show, opts);
      show.duration = Math.max(show.duration - (performance.now() - show.start), 0) + nu.duration * 0.6;
      show.start = performance.now();
      show.root.classList.remove("ct-leaving"); show.leaving = false;
      scheduleLaunches(show, nu);
      return;
    }
    show = makeShow({ tier: want, title: opts.title, subtitle: opts.subtitle, emoji: opts.emoji });
    show.raf = requestAnimationFrame((t) => { show && (show.start = t, frame(show, t)); });
  }

  function stop() { if (show) finish(show); }

  window.Celebrate = { fireworks, stop, TIERS: Object.keys(TIERS) };
})();
