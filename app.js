(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const dex = $("dex"), video = $("video"), work = $("work");
  const el = {
    lens: $("lens"), noCam: $("noCam"), scanMsg: $("scanMsg"),
    photo: $("photo"), sprite: $("sprite"), dexNo: $("dexNo"),
    name: $("name"), genus: $("genus"), types: $("types"),
    ht: $("ht"), wt: $("wt"), desc: $("desc"), toast: $("toast"),
    shutter: $("btnShutter"), shutterLbl: $("shutterLbl"),
    flip: $("btnFlip"), upload: $("btnUpload"), reroll: $("btnReroll"), save: $("btnSave"),
    file: $("file"),
  };

  const MAX_ID = 1025;
  const API = "https://pokeapi.co/api/v2";
  const ART = (id) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

  const state = {
    mode: "scan",       // "scan" | "entry"
    facing: "user",     // camera facing: "user" | "environment"
    stream: null,
    photo: null,        // data URL of captured photo
    mirrored: false,
    entry: null,
    token: 0,           // invalidates in-flight lookups
    typer: null,
  };

  /* ───────────── helpers ───────────── */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let toastTimer;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2400);
  }
  const pad3 = (n) => String(n).padStart(3, "0");
  const fmt = (n) => (Math.round(n * 10) / 10).toString();

  /* ───────────── camera ───────────── */
  async function startCamera() {
    stopCamera();
    el.noCam.hidden = true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return camFailed();
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: state.facing }, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      video.srcObject = state.stream;
      const track = state.stream.getVideoTracks()[0];
      const s = track && track.getSettings ? track.getSettings() : {};
      // Mirror the selfie camera like a mirror; never mirror the back camera.
      const front = s.facingMode ? s.facingMode === "user" : state.facing === "user";
      state.mirrored = front;
      video.classList.toggle("mirror", front);
      await video.play().catch(() => {});
      el.scanMsg.textContent = "POINT AT A TRAINER";
      el.shutter.disabled = false;
    } catch (err) {
      console.warn("Camera error:", err);
      camFailed();
    }
  }
  function camFailed() {
    el.noCam.hidden = false;
    el.shutter.disabled = true;
    el.scanMsg.textContent = "";
  }
  function stopCamera() {
    if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
    state.stream = null;
  }

  function captureFrame() {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return null;
    // Crop to portrait 4:5 so it fills the photo window nicely.
    const aspect = 4 / 5;
    let sw = vw, sh = vh;
    if (vw / vh > aspect) sw = vh * aspect; else sh = vw / aspect;
    const sx = (vw - sw) / 2, sy = (vh - sh) / 2;
    const out = Math.min(1080, sh);
    work.width = Math.round(out * aspect);
    work.height = Math.round(out);
    const ctx = work.getContext("2d");
    ctx.save();
    if (state.mirrored) { ctx.translate(work.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, work.width, work.height);
    ctx.restore();
    return work.toDataURL("image/jpeg", 0.9);
  }

  function loadFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const aspect = 4 / 5, iw = img.naturalWidth, ih = img.naturalHeight;
        let sw = iw, sh = ih;
        if (iw / ih > aspect) sw = ih * aspect; else sh = iw / aspect;
        const out = Math.min(1080, sh);
        work.width = Math.round(out * aspect);
        work.height = Math.round(out);
        work.getContext("2d").drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, work.width, work.height);
        URL.revokeObjectURL(url);
        resolve(work.toDataURL("image/jpeg", 0.9));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
      img.src = url;
    });
  }

  /* ───────────── Pokédex data ───────────── */
  const clean = (s) => s.replace(/[\n\f\r]+/g, " ").replace(/\s+/g, " ").trim();
  const title = (s) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  async function getJSON(url, signal) {
    const r = await fetch(url, { signal });
    if (!r.ok) throw new Error(url + " " + r.status);
    return r.json();
  }

  async function fetchEntryOnline() {
    const id = 1 + Math.floor(Math.random() * MAX_ID);
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    try {
      const [sp, po] = await Promise.all([
        getJSON(`${API}/pokemon-species/${id}`, ctl.signal),
        getJSON(`${API}/pokemon/${id}`, ctl.signal),
      ]);
      const en = (arr, key) => (arr || []).filter((x) => x.language && x.language.name === "en");
      const texts = en(sp.flavor_text_entries).map((x) => clean(x.flavor_text)).filter(Boolean);
      if (!texts.length) throw new Error("no english text");
      const nm = en(sp.names)[0];
      const gn = en(sp.genera)[0];
      return {
        id,
        name: nm ? nm.name : title(sp.name),
        genus: gn ? gn.genus : "Pokémon",
        types: po.types.sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
        h: po.height / 10,
        w: po.weight / 10,
        text: texts[Math.floor(Math.random() * texts.length)],
      };
    } finally {
      clearTimeout(t);
    }
  }

  function fetchEntryOffline(avoidId) {
    const pool = window.FALLBACK_DEX.filter((p) => p.id !== avoidId);
    return { ...pool[Math.floor(Math.random() * pool.length)] };
  }

  async function getEntry(avoidId) {
    try {
      return await fetchEntryOnline();
    } catch (e) {
      console.warn("Using offline entry:", e.message);
      return fetchEntryOffline(avoidId);
    }
  }

  /* ───────────── rendering the entry ───────────── */
  function fitName() {
    el.name.style.fontSize = "";
    let size = parseFloat(getComputedStyle(el.name).fontSize);
    while (el.name.scrollWidth > el.name.clientWidth && size > 9) {
      size -= 1;
      el.name.style.fontSize = size + "px";
    }
  }

  function typeText(text) {
    clearInterval(state.typer);
    el.desc.textContent = "";
    el.desc.classList.add("typing");
    el.desc.scrollTop = 0;
    let i = 0;
    const finish = () => { clearInterval(state.typer); el.desc.textContent = text; el.desc.classList.remove("typing"); el.desc.scrollTop = 0; };
    state.typer = setInterval(() => {
      i += 2;
      el.desc.textContent = text.slice(0, i);
      el.desc.scrollTop = el.desc.scrollHeight;
      if (i >= text.length) finish();
    }, 22);
    el.desc.onclick = finish;
  }

  function showEntry(e) {
    state.entry = e;
    el.dexNo.textContent = "№ " + pad3(e.id);
    el.name.textContent = e.name;
    el.genus.textContent = e.genus;
    el.ht.textContent = fmt(e.h) + " m";
    el.wt.textContent = fmt(e.w) + " kg";
    el.types.innerHTML = "";
    e.types.forEach((t) => {
      const s = document.createElement("span");
      s.className = "chip t-" + t;
      s.textContent = t;
      el.types.appendChild(s);
    });
    el.sprite.hidden = true;
    el.sprite.onload = () => { el.sprite.hidden = false; };
    el.sprite.onerror = () => { el.sprite.hidden = true; };
    el.sprite.src = ART(e.id);
    fitName();
    typeText(e.text);
  }

  function clearEntry() {
    clearInterval(state.typer);
    el.dexNo.textContent = "№ ---";
    el.name.textContent = "???";
    el.name.style.fontSize = "";
    el.genus.innerHTML = "&nbsp;";
    el.types.innerHTML = "";
    el.ht.textContent = "-"; el.wt.textContent = "-";
    el.desc.textContent = ""; el.desc.classList.remove("typing");
    el.sprite.hidden = true;
  }

  /* ───────────── flow ───────────── */
  function setMode(mode) {
    state.mode = mode;
    dex.dataset.mode = mode;
    const entry = mode === "entry";
    el.shutterLbl.textContent = entry ? "RETAKE" : "SCAN";
    el.flip.disabled = entry;
    el.reroll.disabled = !entry;
    el.save.disabled = !entry;
  }

  async function analyze(avoidId) {
    const token = ++state.token;
    dex.classList.add("loading");
    el.lens.classList.add("busy");
    clearEntry();
    el.reroll.disabled = true; el.save.disabled = true;
    const [entry] = await Promise.all([getEntry(avoidId), sleep(1500)]);
    if (token !== state.token) return; // user moved on
    dex.classList.remove("loading");
    el.lens.classList.remove("busy");
    showEntry(entry);
    el.reroll.disabled = false; el.save.disabled = false;
    if (navigator.vibrate) navigator.vibrate(30);
  }

  async function onPhoto(dataUrl) {
    state.photo = dataUrl;
    el.photo.src = dataUrl;
    stopCamera();
    setMode("entry");
    analyze();
  }

  async function onShutter() {
    if (state.mode === "entry") { // retake
      state.token++;
      dex.classList.remove("loading");
      el.lens.classList.remove("busy");
      setMode("scan");
      startCamera();
      return;
    }
    const url = captureFrame();
    if (!url) return toast("CAMERA NOT READY");
    onPhoto(url);
  }

  /* ───────────── save / share card ───────────── */
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function wrap(ctx, text, maxW) {
    const words = text.split(" "), lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }
  function loadImg(src, cors) {
    return new Promise((res) => {
      const i = new Image();
      if (cors) i.crossOrigin = "anonymous";
      i.onload = () => res(i);
      i.onerror = () => res(null);
      i.src = src;
    });
  }
  const TYPE_COL = { normal:"#8e8f7a", fire:"#e8571c", water:"#3b82e8", electric:"#e0b000", grass:"#3fa43f", ice:"#58bcc4",
    fighting:"#b32d22", poison:"#9a35a8", ground:"#b89440", flying:"#8b79e8", psychic:"#e84f86", bug:"#8ea01c",
    rock:"#9c8828", ghost:"#654a8c", dragon:"#5a2de0", dark:"#5b4638", steel:"#8a8aa6", fairy:"#d97ca0" };

  async function renderCard() {
    const e = state.entry;
    try { await document.fonts.load('20px "Press Start 2P"'); } catch (_) {}
    const PIX = '"Press Start 2P", ui-monospace, Menlo, monospace';
    const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    const W = 1080, H = 1920;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d");

    // body
    const bg = g.createLinearGradient(0, 0, W * .5, H);
    bg.addColorStop(0, "#f0423b"); bg.addColorStop(.4, "#d6221d"); bg.addColorStop(1, "#a3121a");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(255,255,255,.2)"; g.fillRect(0, 0, W, 10);

    // top bar: lens + leds
    g.fillStyle = "#6e0a10"; g.fillRect(0, 196, W, 10);
    g.fillStyle = "#f5f5f7"; g.beginPath(); g.arc(130, 108, 66, 0, 7); g.fill();
    g.lineWidth = 8; g.strokeStyle = "#161616"; g.stroke();
    const lg = g.createRadialGradient(112, 90, 4, 130, 108, 46);
    lg.addColorStop(0, "#d8ecff"); lg.addColorStop(.25, "#5cb0ff"); lg.addColorStop(.6, "#2f86ff"); lg.addColorStop(1, "#0b3a9c");
    g.fillStyle = lg; g.beginPath(); g.arc(130, 108, 46, 0, 7); g.fill();
    g.lineWidth = 5; g.strokeStyle = "#0a2a6e"; g.stroke();
    [["#ff4b4b", 240], ["#ffd23a", 284], ["#4cdc6a", 328]].forEach(([col, x]) => {
      g.fillStyle = col; g.beginPath(); g.arc(x, 62, 15, 0, 7); g.fill();
      g.lineWidth = 5; g.strokeStyle = "#161616"; g.stroke();
    });
    g.font = `26px ${PIX}`; g.fillStyle = "#ffd9d6"; g.textAlign = "right"; g.textBaseline = "middle";
    g.fillText("POKÉDEX", W - 50, 108); g.textAlign = "left";

    // bezel
    const bx = 40, by = 236, bw = W - 80, bh = 1590;
    g.save(); g.shadowColor = "rgba(0,0,0,.4)"; g.shadowBlur = 30; g.shadowOffsetY = 10;
    const bz = g.createLinearGradient(0, by, 0, by + bh);
    bz.addColorStop(0, "#f2f2f5"); bz.addColorStop(1, "#cfd0d6");
    g.fillStyle = bz;
    g.beginPath();
    g.moveTo(bx + 28, by); g.arcTo(bx + bw, by, bx + bw, by + bh, 28); g.arcTo(bx + bw, by + bh, bx, by + bh, 28);
    g.arcTo(bx, by + bh, bx, by, 100); g.arcTo(bx, by, bx + bw, by, 28); g.closePath(); g.fill();
    g.restore();
    g.lineWidth = 8; g.strokeStyle = "#161616"; g.stroke();
    g.fillStyle = "#e0443d"; [510, 570].forEach((x) => { g.beginPath(); g.arc(x, by + 28, 9, 0, 7); g.fill(); });

    // screen
    const sx = 80, sy = by + 60, sw = W - 160, sh = 1390;
    const sg = g.createRadialGradient(W / 2, sy, 0, W / 2, sy, sh);
    sg.addColorStop(0, "#143626"); sg.addColorStop(.7, "#0c2218");
    g.fillStyle = sg; rr(g, sx, sy, sw, sh, 18); g.fill();
    g.lineWidth = 7; g.strokeStyle = "#2a2a2e"; g.stroke();

    // photo
    const px = sx + 24, py = sy + 24, pw = sw - 48;
    // size the description box to its text; the photo gets the rest
    let dsize = 38, lines;
    for (; dsize >= 24; dsize -= 2) {
      g.font = `500 ${dsize}px ${SANS}`;
      lines = wrap(g, e.text, pw - 56);
      if (lines.length * dsize * 1.38 + 60 <= 420) break;
    }
    const dh0 = Math.max(200, Math.round(lines.length * dsize * 1.38 + 60));
    const ph = Math.min(960, sh - 48 - 256 - dh0);
    const photo = await loadImg(state.photo);
    g.save(); rr(g, px, py, pw, ph, 12); g.clip();
    g.fillStyle = "#000"; g.fillRect(px, py, pw, ph);
    if (photo) {
      const s = Math.max(pw / photo.width, ph / photo.height);
      g.drawImage(photo, px + (pw - photo.width * s) / 2, py + (ph - photo.height * s) / 2, photo.width * s, photo.height * s);
    }
    g.restore();
    g.lineWidth = 7; g.strokeStyle = "#bfe9cf"; rr(g, px, py, pw, ph, 12); g.stroke();

    // number tag
    const tagTxt = "№ " + pad3(e.id);
    g.font = `26px ${PIX}`;
    const tw = g.measureText(tagTxt).width + 36;
    g.fillStyle = "rgba(8,24,16,.85)"; rr(g, px + 16, py + 16, tw, 58, 8); g.fill();
    g.lineWidth = 4; g.strokeStyle = "#bfe9cf"; g.stroke();
    g.fillStyle = "#fff"; g.textBaseline = "middle"; g.fillText(tagTxt, px + 34, py + 47);

    // sprite badge
    const sprite = await loadImg(ART(e.id), true);
    if (sprite) {
      const r = 110, cx = px + pw - r - 22, cy = py + ph - r - 22;
      g.fillStyle = "#fff"; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
      g.lineWidth = 8; g.strokeStyle = "#0a1a12"; g.stroke();
      g.lineWidth = 4; g.strokeStyle = "#bfe9cf"; g.beginPath(); g.arc(cx, cy, r + 8, 0, 7); g.stroke();
      const sz = r * 1.6; g.drawImage(sprite, cx - sz / 2, cy - sz / 2, sz, sz);
    }

    // name
    let y = py + ph + 80;
    let fs = 54; const nameTxt = e.name.toUpperCase();
    g.textBaseline = "alphabetic"; g.fillStyle = "#fff";
    do { g.font = `${fs}px ${PIX}`; fs -= 2; } while (g.measureText(nameTxt).width > pw && fs > 20);
    g.fillText(nameTxt, px, y);
    // genus
    y += 56; g.font = `600 36px ${SANS}`; g.fillStyle = "#6fb985"; g.fillText(e.genus, px, y);

    // types + HT/WT
    y += 38;
    let cx = px;
    g.font = `22px ${PIX}`;
    e.types.forEach((t) => {
      const label = t.toUpperCase(), w = g.measureText(label).width + 36;
      g.fillStyle = TYPE_COL[t] || "#777"; rr(g, cx, y, w, 54, 8); g.fill();
      g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,.45)"; g.stroke();
      g.fillStyle = "#fff"; g.textBaseline = "middle"; g.fillText(label, cx + 18, y + 29);
      cx += w + 12;
    });
    g.textAlign = "right"; g.textBaseline = "middle";
    const hw = `${fmt(e.h)} m   ${fmt(e.w)} kg`;
    g.font = `600 34px ${SANS}`; g.fillStyle = "#c9f7c8"; g.fillText(hw, px + pw, y + 29);
    g.textAlign = "left";

    // description
    y += 54 + 28;
    const dh = sy + sh - 24 - y;
    g.fillStyle = "rgba(0,0,0,.4)"; rr(g, px, y, pw, dh, 12); g.fill();
    g.lineWidth = 5; g.strokeStyle = "#3b7a57"; g.stroke();
    g.fillStyle = "#c9f7c8"; g.textBaseline = "alphabetic"; g.font = `500 ${dsize}px ${SANS}`;
    lines.forEach((ln, i) => g.fillText(ln, px + 28, y + 30 + dsize + i * dsize * 1.38));

    // bezel foot
    g.fillStyle = "#c9231c"; g.beginPath(); g.arc(bx + 70, by + bh - 52, 22, 0, 7); g.fill();
    g.lineWidth = 5; g.strokeStyle = "#161616"; g.stroke();
    g.fillStyle = "#8b8c94";
    [0, 1, 2].forEach((i) => { g.save(); g.translate(bx + bw - 140 + i * 30, by + bh - 52); g.rotate(.31); rr(g, -5, -24, 10, 48, 5); g.fill(); g.restore(); });

    return new Promise((res) => c.toBlob(res, "image/png"));
  }

  async function onSave() {
    if (!state.entry || !state.photo) return;
    el.save.disabled = true;
    try {
      const blob = await renderCard();
      const fname = `pokedex-${pad3(state.entry.id)}-${state.entry.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
      const file = new File([blob], fname, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: `${state.entry.name} — Pokédex entry` }); return; }
        catch (err) { if (err && err.name === "AbortError") return; }
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = fname;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast("SAVED TO DOWNLOADS");
    } catch (err) {
      console.error(err); toast("COULD NOT SAVE");
    } finally {
      el.save.disabled = state.mode !== "entry";
    }
  }

  /* ───────────── events ───────────── */
  el.shutter.addEventListener("click", onShutter);
  el.flip.addEventListener("click", () => { state.facing = state.facing === "user" ? "environment" : "user"; startCamera(); });
  el.upload.addEventListener("click", () => el.file.click());
  el.file.addEventListener("change", async () => {
    const f = el.file.files && el.file.files[0];
    el.file.value = "";
    if (!f) return;
    try { onPhoto(await loadFile(f)); } catch (_) { toast("COULD NOT READ PHOTO"); }
  });
  el.reroll.addEventListener("click", () => state.mode === "entry" && analyze(state.entry && state.entry.id));
  el.save.addEventListener("click", onSave);
  window.addEventListener("resize", () => state.mode === "entry" && fitName());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopCamera();
    else if (state.mode === "scan") startCamera();
  });

  /* ───────────── boot ───────────── */
  setMode("scan");
  startCamera();
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
