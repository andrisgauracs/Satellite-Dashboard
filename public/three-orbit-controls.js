// Minimal module to attach OrbitControls to the global THREE object.
// Try the skypack ES module first, fall back to injecting the UMD script if imports fail.
(async function attachOrbitControls() {
  try {
    const m = await import(
      "https://cdn.skypack.dev/three@0.151.3/examples/jsm/controls/OrbitControls.js"
    );
    window.THREE = window.THREE || {};
    window.THREE.OrbitControls = m.OrbitControls;
  } catch (err) {
    console.warn(
      "Failed to load OrbitControls via skypack:",
      err,
      " — falling back to injecting UMD script."
    );
    // Fallback: inject the UMD (non-module) OrbitControls which attaches to window.THREE
    const s = document.createElement("script");
    s.src =
      "https://unpkg.com/three@0.151.3/examples/js/controls/OrbitControls.js";
    s.async = true;
    s.onload = () => {
      if (window.THREE && window.THREE.OrbitControls) {
        console.info("OrbitControls attached via UMD script.");
      } else {
        console.warn("OrbitControls UMD loaded but did not attach to THREE.");
      }
    };
    s.onerror = (e) => {
      console.warn("Failed to load OrbitControls UMD script", e);
    };
    document.head.appendChild(s);
  }
})();
