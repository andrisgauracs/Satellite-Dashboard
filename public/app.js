/* Consolidated frontend script:
   - loads satellites list
   - polls /api/positions every 4s (pollInterval)
   - initializes three.js globe with controls, texture, lights
   - pointer-drag rotates globe (inverted), wheel zooms camera
   - satellite markers (spheres + sprite labels) inherit globe rotation
*/

(() => {
  // --- DOM refs ---
  const satListEl = document.getElementById("sat-list");
  const statusEl = document.getElementById("status");
  const refreshBtn = document.getElementById("refresh");
  const threeContainer = document.getElementById("three-container");
  const debugEl = document.getElementById("debug");

  // --- state & config ---
  let SATS = [];
  let latest = [];
  let timer = null;
  const pollInterval = 2000;

  // --- three.js state ---
  let renderer, scene, camera, controls, globe, satGroup;
  const GLOBE_RADIUS = 200;
  const ALT_SCALE = 0.06; // km -> visual offset

  // --- helpers: UI list rendering ---
  function renderList() {
    satListEl.innerHTML = SATS.map(
      (s) => `
			<li id="sat-${s.satid}">
				<div><strong>${
          s.name || s.satid
        }</strong><div style="font-size:12px;color:#9fb0d6">ID ${
        s.satid
      }</div></div>
				<div class="props">—</div>
			</li>
		`
    ).join("");
  }

  function updateListData(data) {
    for (const s of data || []) {
      const el = document.getElementById(`sat-${s.satid}`);
      if (!el) continue;
      const props = el.querySelector(".props");
      if (!props) continue;
      if (s.error) {
        props.innerHTML = `<span style="color:#ff7b7b">${s.error}</span>`;
        continue;
      }
      props.innerHTML = `
			<div style="text-align:right;font-size:13px">
				lat: ${s.latitude != null ? s.latitude.toFixed(4) : "—"}<br>
				lon: ${s.longitude != null ? s.longitude.toFixed(4) : "—"}<br>
				alt: ${s.altitude_km ? s.altitude_km.toFixed(1) + " km" : "—"}<br>
				t: ${new Date((s.timestamp || Date.now() / 1000) * 1000).toLocaleTimeString()}
			</div>`;
    }
  }

  // --- load satellites list ---
  async function loadSats() {
    try {
      const r = await fetch("/api/satellites");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      SATS = await r.json();
      renderList();
    } catch (err) {
      console.error("Failed to load satellites", err);
      SATS = [];
      renderList();
      statusEl.textContent = `Satellites load error`;
    }
  }

  // --- fetch positions and update UI/3D ---
  // override fetchAndRender to accept a debug flag so manual refresh can request debug info
  async function fetchAndRender(nowish = false, debug = false) {
    try {
      // observer fields removed — request positions without observer params
      const url = `/api/positions${debug ? "?debug=true" : ""}`;
      const r = await fetch(url);

      // keep raw body for debug
      let rawBody;
      try {
        rawBody = await r.clone().json();
      } catch (e) {
        rawBody = await r.clone().text();
      }
      console.log("Raw /api/positions response", rawBody);
      if (debugEl) {
        debugEl.style.display = "block";
        debugEl.textContent = JSON.stringify(rawBody, null, 2);
      }

      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (!j || !Array.isArray(j.sats)) {
        console.warn("Invalid /api/positions payload", j);
        statusEl.textContent = `Invalid positions response`;
        return;
      }

      statusEl.textContent = `Updated: ${new Date(
        j.updated || Date.now()
      ).toLocaleTimeString()} ${j.cached ? "(cached)" : ""}`;
      latest = j.sats;
      updateListData(latest);
      updateThreeMarkers(latest);

      // If debug payload included raw per-sat info, also show that for easier diagnosis
      if (debug && j.raw) {
        console.info("Server debug/raw details:", j.raw);
        // keep the debug panel showing raw
        if (debugEl) debugEl.textContent = JSON.stringify(j.raw, null, 2);
      }
    } catch (err) {
      console.error("fetchAndRender error", err);
      statusEl.textContent = `Error fetching positions: ${err.message || err}`;
    }
  }

  // --- polling control ---
  function startPolling() {
    if (timer) clearInterval(timer);
    fetchAndRender();
    timer = setInterval(fetchAndRender, pollInterval);
  }

  // --- three.js: utilities ---
  function lonLatToCartesian(lon, lat, alt_km = 0) {
    const radius = GLOBE_RADIUS + Math.max(2, (alt_km || 0) * ALT_SCALE);
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    return new THREE.Vector3(x, y, z);
  }

  function createLabelCanvas(text, width = 256, height = 64) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#fff";
    ctx.font = "20px sans-serif";
    ctx.textBaseline = "middle";
    let measured = ctx.measureText(text).width;
    let fontSize = 20;
    while (measured > width - 16 && fontSize > 10) {
      fontSize -= 1;
      ctx.font = `${fontSize}px sans-serif`;
      measured = ctx.measureText(text).width;
    }
    ctx.fillText(text, 8, height / 2);
    canvas._lastText = text;
    return canvas;
  }

  // create/update markers (Three.js)
  function updateThreeMarkers(satData) {
    if (!satGroup) return;
    const existing = new Map();
    satGroup.children.forEach((ch) =>
      existing.set(String(ch.userData.satid), ch)
    );

    for (const s of satData || []) {
      const sid = String(s.satid);
      let group = existing.get(sid);
      const color = s.satid === 25544 ? 0x2aa6ff : 0x6df0e8;

      if (!group) {
        const sphereGeom = new THREE.SphereGeometry(4, 8, 8);
        const sphereMat = new THREE.MeshBasicMaterial({ color });
        const sphere = new THREE.Mesh(sphereGeom, sphereMat);
        sphere.userData.type = "marker";

        const canvas = createLabelCanvas(s.name || sid);
        const tex = new THREE.CanvasTexture(canvas);
        // Allow depth testing so labels are occluded when behind the globe.
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: tex,
            depthTest: true,
            depthWrite: false,
          })
        );
        sprite.scale.set(40, 10, 1);
        sprite.position.set(0, 10, 0);
        // no renderOrder forcing so depthTest can occlude labels

        const g = new THREE.Group();
        g.add(sphere);
        g.add(sprite);
        g.userData.satid = sid;
        satGroup.add(g);
        group = g;
      } else {
        const sphere = group.children.find((c) => c.isMesh);
        if (sphere && sphere.material) sphere.material.color.setHex(color);
        const sprite = group.children.find((c) => c.isSprite);
        if (
          sprite &&
          sprite.material &&
          sprite.material.map &&
          sprite.material.map.image
        ) {
          const canvas = sprite.material.map.image;
          if (!canvas._lastText || canvas._lastText !== (s.name || sid)) {
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "rgba(0,0,0,0.55)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#fff";
            ctx.font = "20px sans-serif";
            ctx.textBaseline = "middle";
            ctx.fillText(s.name || sid, 8, canvas.height / 2);
            canvas._lastText = s.name || sid;
            sprite.material.map.needsUpdate = true;
          }
          // Ensure reused sprites also respect depth testing
          sprite.material.depthTest = true;
          sprite.material.depthWrite = false;
          sprite.renderOrder = 0;
        }
      }

      if (s.latitude != null && s.longitude != null) {
        const pos = lonLatToCartesian(s.longitude, s.latitude, s.altitude_km);
        if (pos) {
          group.position.copy(pos);
          group.visible = true;
          const sphere = group.children.find((c) => c.isMesh);
          if (sphere) {
            const r = Math.max(2, 6 - Math.min(400, s.altitude_km || 0) / 100);
            if (sphere.geometry) sphere.geometry.dispose();
            sphere.geometry = new THREE.SphereGeometry(r, 8, 8);
          }
        }
      } else {
        group.visible = false;
      }
    }

    const seen = new Set((satData || []).map((s) => String(s.satid)));
    satGroup.children.slice().forEach((ch) => {
      if (!seen.has(ch.userData.satid)) {
        const sphere = ch.children.find((c) => c.isMesh);
        if (sphere) {
          if (sphere.geometry) sphere.geometry.dispose();
          if (sphere.material) sphere.material.dispose();
        }
        const sprite = ch.children.find((c) => c.isSprite);
        if (sprite && sprite.material && sprite.material.map)
          sprite.material.map.dispose();
        if (sprite && sprite.material) sprite.material.dispose();
        ch.remove();
      }
    });
  }

  // --- texture helper: draw SVG into 2048x1024 equirectangular canvas ---
  function loadEquirectangularTextureFromSVG(
    url,
    outWidth = 2048,
    outHeight = 1024
  ) {
    return fetch(url)
      .then((r) => r.blob())
      .then(
        (blob) =>
          new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              try {
                const canvas = document.createElement("canvas");
                canvas.width = outWidth;
                canvas.height = outHeight;
                const ctx = canvas.getContext("2d");
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                const scale = canvas.width / img.width;
                const destH = img.height * scale;
                const dy = Math.round((canvas.height - destH) / 2);
                ctx.drawImage(img, 0, dy, canvas.width, destH);
                const tex = new THREE.CanvasTexture(canvas);
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.ClampToEdgeWrapping;
                tex.mapping = THREE.EquirectangularReflectionMapping;
                tex.needsUpdate = true;
                resolve(tex);
              } catch (e) {
                reject(e);
              }
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(blob);
          })
      );
  }

  // --- pointer rotation & zoom UX ---
  let isPointerDown = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  const ROTATE_SPEED = 0.005;
  const MAX_PITCH = Math.PI / 2 - 0.01;
  const MIN_PITCH = -MAX_PITCH;

  // --- three.js init ---
  function initThree() {
    if (!threeContainer) {
      console.error("three-container not found");
      return;
    }

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(threeContainer.clientWidth, threeContainer.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    threeContainer.innerHTML = "";
    threeContainer.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
      45,
      threeContainer.clientWidth / threeContainer.clientHeight,
      0.1,
      10000
    );
    camera.position.set(
      GLOBE_RADIUS * 2.6,
      GLOBE_RADIUS * 0.8,
      GLOBE_RADIUS * 2.6
    );
    camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(5, 10, 7.5);
    scene.add(dir);
    const point = new THREE.PointLight(0xffffff, 0.45);
    point.position.set(
      GLOBE_RADIUS * 1.6,
      GLOBE_RADIUS * 0.8,
      GLOBE_RADIUS * 1.6
    );
    scene.add(point);

    // create placeholder globe; texture applied async
    globe = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64),
      new THREE.MeshStandardMaterial({
        color: 0x0a2340,
        roughness: 1,
        metalness: 0,
        emissive: 0x0a1626,
        emissiveIntensity: 0.12,
      })
    );
    globe.position.set(0, 0, 0);
    scene.add(globe);

    // satGroup as child of globe so it inherits rotation
    satGroup = new THREE.Group();
    satGroup.position.set(0, 0, 0);
    globe.add(satGroup);

    loadEquirectangularTextureFromSVG("/map/world.svg")
      .then((tex) => {
        globe.material.map = tex;
        globe.material.emissiveIntensity = 0.08;
        globe.material.needsUpdate = true;
        renderer.render(scene, camera);
      })
      .catch((err) => console.warn("Texture load failed", err));

    // controls: wait for THREE.OrbitControls to be attached by helper module (three-orbit-controls.js)
    let attempts = 0;
    const maxAttempts = 30;
    const wait = setInterval(() => {
      attempts++;
      if (typeof THREE.OrbitControls === "function") {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        controls.minDistance = GLOBE_RADIUS * 1.1;
        controls.maxDistance = GLOBE_RADIUS * 6;
        controls.target.set(0, 0, 0);
        controls.update();
        // disable rotation in controls; we rotate globe itself
        controls.enableRotate = false;
        controls.enablePan = false;
        clearInterval(wait);
      } else if (attempts >= maxAttempts) {
        clearInterval(wait);
        console.warn("OrbitControls not available; continuing without them");
      }
    }, 100);

    // pointer handlers for globe rotation (inverted)
    const el = renderer.domElement;
    el.style.touchAction = "none";
    el.style.cursor = "grab";

    el.addEventListener(
      "pointerdown",
      (ev) => {
        if (ev.button !== undefined && ev.button !== 0) return;
        isPointerDown = true;
        lastPointerX = ev.clientX;
        lastPointerY = ev.clientY;
        try {
          el.setPointerCapture(ev.pointerId);
        } catch (e) {}
        if (controls) controls.enabled = false;
        el.style.cursor = "grabbing";
      },
      { passive: true }
    );

    el.addEventListener(
      "pointermove",
      (ev) => {
        if (!isPointerDown || !globe) return;
        const dx = ev.clientX - lastPointerX,
          dy = ev.clientY - lastPointerY;
        lastPointerX = ev.clientX;
        lastPointerY = ev.clientY;
        // INVERTED: add deltas so dragging left rotates globe left, etc.
        globe.rotation.y += dx * ROTATE_SPEED;
        globe.rotation.x += dy * ROTATE_SPEED;
        globe.rotation.x = Math.max(
          MIN_PITCH,
          Math.min(MAX_PITCH, globe.rotation.x)
        );
      },
      { passive: true }
    );

    el.addEventListener(
      "pointerup",
      (ev) => {
        isPointerDown = false;
        try {
          el.releasePointerCapture(ev.pointerId);
        } catch (e) {}
        if (controls) controls.enabled = true;
        el.style.cursor = "grab";
      },
      { passive: true }
    );

    el.addEventListener("pointercancel", () => {
      isPointerDown = false;
      if (controls) controls.enabled = true;
      el.style.cursor = "grab";
    });

    // wheel zoom: move camera along its direction vector
    el.addEventListener(
      "wheel",
      (ev) => {
        ev.preventDefault();
        if (!camera) return;
        const dir = new THREE.Vector3().copy(camera.position).normalize();
        const dist = camera.position.length();
        const factor = 1 + Math.sign(ev.deltaY) * 0.12;
        let newDist = THREE.MathUtils.clamp(
          dist * factor,
          GLOBE_RADIUS * 1.05,
          GLOBE_RADIUS * 6
        );
        camera.position.copy(dir.multiplyScalar(newDist));
        if (controls) controls.update();
      },
      { passive: false }
    );

    window.addEventListener("resize", () => {
      if (!threeContainer || !renderer || !camera) return;
      const w = threeContainer.clientWidth,
        h = threeContainer.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });

    // animation loop
    (function animate() {
      requestAnimationFrame(animate);
      if (controls && typeof controls.update === "function") controls.update();
      if (renderer && camera) renderer.render(scene, camera);
    })();
  }

  // --- global error handlers for helpful UI message ---
  window.addEventListener("error", (ev) => {
    console.error("Unhandled error:", ev.error || ev.message, ev);
    statusEl.textContent = `Error: ${
      ev.error?.message || ev.message || "unknown"
    }`;
  });
  window.addEventListener("unhandledrejection", (ev) => {
    console.error("Unhandled promise rejection:", ev.reason);
    statusEl.textContent = `Error: ${
      ev.reason?.message || ev.reason || "unhandled rejection"
    }`;
  });

  // --- wire up controls ---
  refreshBtn.addEventListener("click", () => fetchAndRender(true, true));
  // observer inputs removed — no change listeners to attach

  // --- startup ---
  loadSats()
    .then(() => {
      initThree();
      startPolling();
    })
    .catch((err) => {
      console.error("Startup error", err);
      initThree();
      startPolling();
    });
})();
