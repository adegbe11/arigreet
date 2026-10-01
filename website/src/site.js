/* arigreet.com — small, dependency-free page script. */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Airport codes for the moving strip (doubled so the loop is seamless).
  // Sticky nav tightens once you scroll.
  const navEl = document.querySelector(".nav");
  const onScroll = () => navEl?.classList.toggle("scrolled", scrollY > 40);
  addEventListener("scroll", onScroll, { passive: true });
  requestAnimationFrame(onScroll);

  // Reveal sections as they scroll in. Anything already on screen stays put.
  if (!reduce && "IntersectionObserver" in window) {
    const groups = [
      [".gen-head, .gen, .statement p, .eyebrow + .feat-grid, .story h2, .story-lede, .stats, .who h2, .who-lede, .faq h2, .faq-lede, .qa, .sendoff h2, .sendoff p, .prose-block, .links-sec h2, .page-photo", false],
      [".feat, .step, .plan, .link-card, .bx", true],
      [".photo, .plan-photo, .x-pcard", false, "rv-img"],
    ];
    // First callback runs after layout: anything already on screen stays put, the rest waits to reveal.
    const seen = new WeakSet();
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      const el = e.target;
      if (!seen.has(el)) {
        seen.add(el);
        if (e.boundingClientRect.top < innerHeight) return io.unobserve(el);
        el.classList.add(el.dataset.rv);
        return;
      }
      if (e.isIntersecting) el.classList.add("in"), io.unobserve(el);
    }), { rootMargin: "0px 0px -8% 0px" });
    for (const [sel, stagger, cls = "rv"] of groups)
      document.querySelectorAll(sel).forEach((el) => {
        if (stagger) el.style.setProperty("--i", [...el.parentElement.children].indexOf(el) % 6);
        el.dataset.rv = cls;
        io.observe(el);
      });
    document.querySelectorAll(".steps .tap").forEach((el, i) => el.style.setProperty("--i", i));

    // The statement lights up word by word as you read down the page.
    const st = document.querySelector(".statement p");
    if (st) {
      const wrap = (node) => {
        for (const n of [...node.childNodes]) {
          if (n.nodeType === 3) {
            const frag = document.createDocumentFragment();
            n.textContent.split(/(\s+)/).forEach((t) => {
              if (!t.trim()) return frag.append(t);
              const s = document.createElement("span");
              s.className = "w";
              s.textContent = t;
              frag.append(s);
            });
            n.replaceWith(frag);
          } else wrap(n);
        }
      };
      wrap(st);
      const words = [...st.querySelectorAll(".w")];
      const paint = () => {
        const r = st.getBoundingClientRect();
        const k = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35)));
        const n = Math.round(k * words.length);
        words.forEach((w, i) => w.classList.toggle("on", i < n));
      };
      addEventListener("scroll", paint, { passive: true });
      paint();
    }

    // Gentle depth on the story photos.
    const ph = [...document.querySelectorAll(".story-photos .photo img")];
    if (ph.length) {
      const par = () =>
        ph.forEach((im) => {
          const r = im.parentElement.getBoundingClientRect();
          const k = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
          im.style.transform = `scale(1.1) translateY(${(k * -24).toFixed(1)}px)`;
        });
      addEventListener("scroll", par, { passive: true });
      par();
    }
  }

  // ── Home: hero depth, story phone, photo parallax ──
  if (!reduce) {
    const floaters = [...document.querySelectorAll("[data-depth]")];
    let mx = 0, my = 0;
    const depth = () =>
      floaters.forEach((el) => {
        const d = +el.dataset.depth;
        el.style.setProperty("--tx", (mx * d).toFixed(1) + "px");
        el.style.setProperty("--ty", (my * d - scrollY * d * 0.012).toFixed(1) + "px");
      });
    if (floaters.length) {
      addEventListener("pointermove", (e) => {
        mx = e.clientX / innerWidth - 0.5;
        my = e.clientY / innerHeight - 0.5;
        depth();
      }, { passive: true });
      addEventListener("scroll", depth, { passive: true });
    }
    const bgs = [...document.querySelectorAll(".x-bg img")];
    const drift = () =>
      bgs.forEach((im) => {
        const r = im.parentElement.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return;
        const k = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
        im.style.transform = `translateY(${(k * -60).toFixed(1)}px) scale(1.05)`;
      });
    if (bgs.length) {
      let ticking = false;
      addEventListener("scroll", () => ticking || (ticking = true, requestAnimationFrame(() => (drift(), ticking = false))), { passive: true });
      setTimeout(() => requestAnimationFrame(drift), 0);
    }
    if ("IntersectionObserver" in window) {
      const lio = new IntersectionObserver((es) => es.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.querySelectorAll("span").forEach((s, i) => setTimeout(() => s.classList.add("in"), i * 260));
        lio.unobserve(e.target);
      }), { threshold: 0.4 });
      document.querySelectorAll(".x-lines").forEach((el) => lio.observe(el));
    }
  }
  const steps = [...document.querySelectorAll(".x-step")];
  const shots = [...document.querySelectorAll(".x-screen img")];
  if (steps.length && "IntersectionObserver" in window) {
    const sio = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      const n = e.target.dataset.step;
      steps.forEach((s) => s.classList.toggle("on", s === e.target));
      shots.forEach((im) => im.classList.toggle("on", im.dataset.shot === n));
    }), { rootMargin: "-45% 0px -45% 0px" });
    steps.forEach((s) => sio.observe(s));
    const story = document.querySelector(".x-story");
    const pre = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      shots.forEach((im) => (im.loading = "eager"));
      pre.disconnect();
    }, { rootMargin: "50% 0px" });
    if (story) pre.observe(story);
  }

  const track = document.getElementById("track");
  if (track) {
    const codes = [["ATH","Athens"],["LHR","London"],["LOS","Lagos"],["JFK","New York"],["DXB","Dubai"],["CDG","Paris"],["FCO","Rome"],["MAD","Madrid"],["FRA","Frankfurt"],["LIS","Lisbon"],["IST","Istanbul"],["SKG","Thessaloniki"],["ABV","Abuja"],["SIN","Singapore"],["NBO","Nairobi"],["AMS","Amsterdam"],["JTR","Santorini"],["HND","Tokyo"],["YYZ","Toronto"],["ACC","Accra"]];
    const item = ([c, n], dup) =>
      `<a class="code" href="/airports/${c.toLowerCase()}/"${dup ? ' tabindex="-1" aria-hidden="true"' : ""}><b>${c}</b><span>${n}</span></a>`;
    setTimeout(() => track.innerHTML = codes.map((c) => item(c, false)).join("") + codes.map((c) => item(c, true)).join(""), 0);
  }

  // Count the stats up once; the final numbers are already in the page.
  if (!reduce && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const to = +e.target.dataset.to, t0 = performance.now();
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / 1400);
        e.target.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString("en-US");
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }), { threshold: 0.6 });
    document.querySelectorAll("[data-to]").forEach((el) => io.observe(el));
  }

  // Local time at an airport page.
  document.querySelectorAll("[data-tz]").forEach((el) => {
    const show = () => {
      try {
        el.textContent = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: el.dataset.tz });
      } catch {}
    };
    show();
    setInterval(show, 30000);
  });

  /* ── Airport greeting board generator ── */
  const gen = document.querySelector("[data-gen]");
  if (!gen) return;
  const $ = (s) => gen.querySelector(s);
  const nameIn = $("#g-name"), topIn = $("#g-top"), airportIn = $("#g-airport");
  const board = $(".board"), nameEl = $(".board-name"), topEl = $(".board-top");
  const createBtn = $("[data-create]");
  const style = () => gen.querySelector('input[name="g-style"]:checked')?.value || "klein";
  const nameText = () => nameIn.value.trim() || "Your guest’s name";

  // Make the name as large as the sign allows.
  const fit = (el, box, maxRatio, wrap = false) => {
    const cs = getComputedStyle(box);
    const avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    el.style.whiteSpace = "nowrap";
    el.style.fontSize = "100px";
    let w = el.scrollWidth || 1;
    let lines = 1;
    // Tall screens (a phone held upright): let long names break onto two lines.
    if (wrap && box.clientHeight > box.clientWidth && /\s|-/.test(el.textContent)) {
      const words = el.textContent.split(/(?<=[\s-])/);
      const probe = document.createElement("span");
      probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font:inherit";
      el.appendChild(probe);
      w = Math.max(...words.map((t) => ((probe.textContent = t.trim()), probe.offsetWidth || 1)));
      probe.remove();
      el.style.whiteSpace = "normal";
      lines = Math.min(3, words.length);
    }
    const byWidth = (100 * avail * 0.96) / w;
    const byHeight = (box.clientHeight * maxRatio) / lines;
    el.style.fontSize = Math.max(12, Math.min(byWidth, byHeight)) + "px";
  };
  const render = () => {
    nameEl.textContent = nameText();
    topEl.textContent = topIn.value.trim();
    board.dataset.style = style();
    fit(nameEl, board, 0.42);
    const q = new URLSearchParams({ name: nameIn.value.trim(), style: style() });
    const code = (airportIn?.value || "").trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(code)) q.set("airport", code);
    if (!nameIn.value.trim()) q.delete("name");
    createBtn.href = "/app?" + q.toString();
  };
  gen.querySelector("form")?.addEventListener("submit", (e) => e.preventDefault());
  const soon = () => requestAnimationFrame(render);
  gen.addEventListener("input", soon);
  addEventListener("resize", soon);
  document.fonts?.ready.then(soon);
  soon();

  // Full screen, ready to hold up at Arrivals.
  $("[data-full]").addEventListener("click", async () => {
    const wrap = document.createElement("div");
    wrap.className = "full";
    wrap.innerHTML = `<div class="board" data-style="${style()}"><div class="board-top"></div><div class="board-name"></div><div class="board-foot"><span>arigreet.com</span></div></div><span class="full-hint">Tap to close</span>`;
    const b = wrap.querySelector(".board");
    wrap.querySelector(".board-name").textContent = nameText();
    wrap.querySelector(".board-top").textContent = topIn.value.trim();
    document.body.appendChild(wrap);
    document.body.style.overflow = "hidden";
    const refit = () => fit(wrap.querySelector(".board-name"), b, 0.55, true);
    refit();
    let lock = null;
    try { await wrap.requestFullscreen?.(); } catch {}
    try { lock = await navigator.wakeLock?.request("screen"); } catch {}
    refit();
    addEventListener("resize", refit);
    const close = () => {
      removeEventListener("resize", refit);
      lock?.release?.();
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      document.body.style.overflow = "";
      wrap.remove();
    };
    wrap.addEventListener("click", close);
    addEventListener("keydown", function esc(e) { if (e.key === "Escape") { close(); removeEventListener("keydown", esc); } });
  });

  // Save as an image to print or keep on your phone.
  $("[data-png]").addEventListener("click", async () => {
    const W = 2400, H = 1350;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const x = c.getContext("2d");
    const pal = { klein: ["#002fa7", "#ffffff", "rgba(255,255,255,.78)"], light: ["#ffffff", "#002fa7", "#4a5170"], dark: ["#0b0d12", "#ffffff", "rgba(255,255,255,.7)"] }[style()];
    try { await document.fonts.load('900 200px "Fraunces"'); } catch {}
    x.fillStyle = pal[0]; x.fillRect(0, 0, W, H);
    x.textAlign = "center"; x.textBaseline = "middle";
    const top = topIn.value.trim();
    if (top) { x.fillStyle = pal[2]; x.font = '600 64px "Geist", Arial, sans-serif'; x.fillText(top, W / 2, 150); }
    const n = nameText();
    let size = 560;
    x.font = `900 ${size}px "Fraunces", Georgia, serif`;
    const w = x.measureText(n).width;
    if (w > W * 0.88) size = Math.floor((size * W * 0.88) / w);
    x.font = `900 ${size}px "Fraunces", Georgia, serif`;
    x.fillStyle = pal[1]; x.fillText(n, W / 2, H / 2 + (top ? 30 : 0));
    x.fillStyle = pal[2]; x.font = '600 40px "Geist", Arial, sans-serif'; x.fillText("arigreet.com", W / 2, H - 90);
    const a = document.createElement("a");
    a.download = "greeting-board-" + n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".png";
    a.href = c.toDataURL("image/png");
    document.body.appendChild(a); a.click(); a.remove();
  });
})();
