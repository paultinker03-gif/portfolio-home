function R(p){ try { return (window.CVRES ? window.CVRES(p) : p); } catch(e){ return p; } }
(() => {

class SmartScene extends HTMLElement {
  connectedCallback() {
    if (this._started) return;
    this._started = true;
    const bg = this.getAttribute('background') || '#C6D9EF';
    this._transparent = bg === 'transparent' || bg === 'none';
    this.style.display = 'block';
    this.style.width = '100%';
    this.style.height = '100%';
    this.style.background = this._transparent ? 'transparent' : bg;

    const boot = () => {
      if (this._booted) return;
      this._booted = true;
      if (this._bootTimer) clearTimeout(this._bootTimer);
      this._build().catch(e => console.error('[smart-scene]', e));
    };
    // build immediately (matches the Guardian scene); the observer below only
    // pauses/resumes rendering once it is live
    boot();
  }

  disconnectedCallback() {
    if (this._bootTimer) clearTimeout(this._bootTimer);
    if (this._lazyIO) this._lazyIO.disconnect();
    if (this._visIO) this._visIO.disconnect();
    if (this._stop) this._stop();
  }

  async _build() {
    const THREE = await import('three');
    const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    this.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
    camera.position.set(0, 0, 34);

    scene.add(new THREE.AmbientLight(0xffffff, 0.32));
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbcccdd, 0.28));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(-8, 12, 16);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.28);
    fill.position.set(10, -4, 10);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xdbe9ff, 0.5);
    rim.position.set(4, 6, -12);
    scene.add(rim);

    const root = new THREE.Group();
    scene.add(root);
    const stack = new THREE.Group();
    root.add(stack);

    const texLoader = new THREE.TextureLoader();
    const loadTex = src => {
      const t = texLoader.load(src);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return t;
    };

    function roundedRectShape(w, h, r) {
      const s = new THREE.Shape();
      const x = -w / 2, y = -h / 2;
      s.moveTo(x + r, y);
      s.lineTo(x + w - r, y);
      s.quadraticCurveTo(x + w, y, x + w, y + r);
      s.lineTo(x + w, y + h - r);
      s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      s.lineTo(x + r, y + h);
      s.quadraticCurveTo(x, y + h, x, y + h - r);
      s.lineTo(x, y + r);
      s.quadraticCurveTo(x, y, x + r, y);
      return s;
    }

    function uvShape(w, h, r) {
      const g = new THREE.ShapeGeometry(roundedRectShape(w, h, r), 24);
      const pos = g.attributes.position, uvs = [];
      for (let k = 0; k < pos.count; k++) uvs.push((pos.getX(k) + w / 2) / w, (pos.getY(k) + h / 2) / h);
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      return g;
    }

    // ---------- phone (same construction as the Guardian scene) ----------
    const bodyMat = new THREE.MeshPhysicalMaterial({ name: 'phone-body', color: 0x2f3337, roughness: 0.5, metalness: 0.6, clearcoat: 0.15, clearcoatRoughness: 0.5, envMapIntensity: 0.5 });
    const edgeMat = new THREE.MeshPhysicalMaterial({ name: 'phone-edge', color: 0x3c4146, roughness: 0.34, metalness: 0.92, clearcoat: 0.25, clearcoatRoughness: 0.35, envMapIntensity: 1.05 });
    const speakerMat = new THREE.MeshStandardMaterial({ name: 'speaker', color: 0x9aa0a5, roughness: 0.6, metalness: 0.6 });
    const cardMat = new THREE.MeshStandardMaterial({ name: 'card', color: 0xffffff, roughness: 0.55, metalness: 0.05, envMapIntensity: 0.5 });

    const makePhone = (src, h, aspect) => {
      const g = new THREE.Group();
      const w = h * aspect;
      const bezel = h * 0.022, depth = h * 0.031, bevel = h * 0.008;

      const bodyGeo = new THREE.ExtrudeGeometry(roundedRectShape(w, h, w * 0.13), {
        depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 24
      });
      bodyGeo.translate(0, 0, -depth / 2);
      g.add(new THREE.Mesh(bodyGeo, bodyMat));

      const railGeo = new THREE.ExtrudeGeometry(roundedRectShape(w + w * 0.008, h + w * 0.008, w * 0.135), {
        depth: depth * 0.42, bevelEnabled: true, bevelThickness: bevel * 0.45, bevelSize: bevel * 0.45, bevelSegments: 2, curveSegments: 24
      });
      railGeo.translate(0, 0, -depth * 0.21);
      g.add(new THREE.Mesh(railGeo, edgeMat));

      const sw = w - bezel * 2, sh = h - bezel * 2;
      const sgeo = uvShape(sw, sh, sw * 0.105);
      const screenTex = loadTex(src);
      screenTex.repeat.set(1, 1846 / 1848);
      screenTex.offset.set(0, 0);
      const screen = new THREE.Mesh(sgeo, new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
      screen.position.z = depth / 2 + bevel + 0.01;
      g.add(screen);

      const notch = new THREE.Mesh(new THREE.CapsuleGeometry(w * 0.008, w * 0.16, 4, 12), speakerMat);
      notch.rotation.z = Math.PI / 2;
      notch.position.set(0, h / 2 - bezel * 0.55, depth / 2 + bevel + 0.014);
      g.add(notch);

      g.userData.screen = screen;
      return g;
    };

    // ---------- flat interface card (no phone) ----------
    const makeCard = (src, w, h) => {
      const g = new THREE.Group();
      const r = Math.min(w, h) * 0.055;
      const depth = 0.16;
      const backGeo = new THREE.ExtrudeGeometry(roundedRectShape(w, h, r), {
        depth, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 2, curveSegments: 18
      });
      backGeo.translate(0, 0, -depth);
      g.add(new THREE.Mesh(backGeo, cardMat));

      const fgeo = uvShape(w, h, r);
      const face = new THREE.Mesh(fgeo, new THREE.MeshBasicMaterial({ map: loadTex(src), transparent: true, toneMapped: false }));
      face.position.z = 0.045;
      g.add(face);

      return g;
    };

    // ---------- coin (nordic-gold rim, cupronickel core — simplified 1 euro) ----------
    // procedural micro-relief so the metal reads as struck, worn coin rather than chrome
    const grainMaps = (() => {
      const S = 256;
      const nc = document.createElement('canvas'); nc.width = nc.height = S;
      const rc = document.createElement('canvas'); rc.width = rc.height = S;
      const nx = nc.getContext('2d'), rx = rc.getContext('2d');
      const nd = nx.createImageData(S, S), rd = rx.createImageData(S, S);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4;
        const n = (Math.random() - 0.5) * 26;
        nd.data[i] = 128 + n; nd.data[i + 1] = 128 + n * 0.8; nd.data[i + 2] = 255; nd.data[i + 3] = 255;
        const g = 150 + (Math.random() - 0.5) * 70 + Math.sin(x * 0.9) * 8;
        rd.data[i] = rd.data[i + 1] = rd.data[i + 2] = g; rd.data[i + 3] = 255;
      }
      nx.putImageData(nd, 0, 0); rx.putImageData(rd, 0, 0);
      const mk = c => {
        const t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(3, 3);
        return t;
      };
      return { normal: mk(nc), rough: mk(rc) };
    })();

    // milled reeding for the rim's side face
    const reedTex = (() => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 16;
      const x = c.getContext('2d');
      for (let i = 0; i < 512; i++) {
        const v = 100 + Math.round(70 * (0.5 + 0.5 * Math.sin(i * 1.1)));
        x.fillStyle = `rgb(${v},${v},${v})`;
        x.fillRect(i, 0, 1, 16);
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    })();

    const goldMat = new THREE.MeshStandardMaterial({
      name: 'coin-gold', color: 0xa8875a, roughness: 0.86, metalness: 0.7, envMapIntensity: 0.55,
      roughnessMap: grainMaps.rough, normalMap: grainMaps.normal, normalScale: new THREE.Vector2(2.2, 2.2)
    });
    const goldEdgeMat = new THREE.MeshStandardMaterial({
      name: 'coin-gold-edge', color: 0x84663a, roughness: 1.0, metalness: 0.7, envMapIntensity: 0.4,
      roughnessMap: reedTex, bumpMap: reedTex, bumpScale: 0.1
    });
    const silverMat = new THREE.MeshStandardMaterial({
      name: 'coin-silver', color: 0x94989a, roughness: 0.84, metalness: 0.7, envMapIntensity: 0.55,
      roughnessMap: grainMaps.rough, normalMap: grainMaps.normal, normalScale: new THREE.Vector2(2.0, 2.0)
    });

    const tintMats = k => {
      const dim = m => { const c = m.clone(); c.color = m.color.clone().multiplyScalar(k); return c; };
      return { gold: dim(goldMat), edge: dim(goldEdgeMat), silver: dim(silverMat) };
    };

    // flat matte, unlit: renders the exact hex without lights/tonemapping washing it out
    const recolor = c => {
      const mk = hex => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex), toneMapped: false });
      return { gold: mk(c.gold), edge: mk(c.edge), silver: mk(c.silver) };
    };

    // face wear: polished centre field, duller toward the rim, faint concentric circulation scratches
    const wearRough = (() => {
      const S = 256, c = document.createElement('canvas');
      c.width = c.height = S;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      grad.addColorStop(0, '#5c5c5c');      // smooth field
      grad.addColorStop(0.62, '#9a9a9a');
      grad.addColorStop(1, '#e0e0e0');      // scuffed toward the rim
      g.fillStyle = grad; g.fillRect(0, 0, S, S);
      g.lineWidth = 1;
      for (let i = 0; i < 90; i++) {
        const rad = 12 + Math.random() * (S / 2 - 14);
        const a0 = Math.random() * Math.PI * 2;
        g.strokeStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.12})`;
        g.beginPath();
        g.arc(S / 2, S / 2, rad, a0, a0 + 0.3 + Math.random() * 1.4);
        g.stroke();
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.NoColorSpace;
      return t;
    })();

    // face tone: radial wear darkening + optional struck numeral
    const faceTex = (txt, lift) => {
      const S = 256, c = document.createElement('canvas');
      c.width = c.height = S;
      const g = c.getContext('2d');
      const bg = lift ? '#c7c7c7' : '#ffffff';
      g.fillStyle = bg; g.fillRect(0, 0, S, S);
      if (txt) {
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = 'bold 230px Georgia, serif';
        g.fillStyle = '#ffffff'; g.fillText(txt, S / 2, S / 2);
      }
      // rim-ward grime, and a few high-points rubbed bright
      const grad = g.createRadialGradient(S / 2, S / 2, S * 0.18, S / 2, S / 2, S / 2);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.22)');
      g.fillStyle = grad; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 40; i++) {
        const rad = 14 + Math.random() * (S / 2 - 16);
        const a0 = Math.random() * Math.PI * 2;
        g.lineWidth = 1;
        g.strokeStyle = `rgba(255,255,255,${0.06 + Math.random() * 0.1})`;
        g.beginPath();
        g.arc(S / 2, S / 2, rad, a0, a0 + 0.2 + Math.random());
        g.stroke();
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const faceCache = {};
    const faceMat = (base, txt, lightColor) => {
      const m = base.clone();
      const key = (txt || '-') + (lightColor ? 'L' : '');
      m.map = faceCache[key] || (faceCache[key] = faceTex(txt, !!lightColor));
      m.roughnessMap = wearRough;
      m.roughness = 0.72;
      if (lightColor) m.color = new THREE.Color(lightColor);
      return m;
    };

    const makeCoin = (r, blur, tint, colors, mark, allGold) => {
      const outer = new THREE.Group();
      const t = r * 0.24;
      const build = mats => {
        const inner = new THREE.Group();
        const tBody = t * 0.66, tCh = t * 0.17;   // chamfered rim profile
        const goldFace = faceMat(mats.gold);
        inner.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, tBody, 64, 1, true), mats.edge));
        [1, -1].forEach(s => {
          const ch = new THREE.Mesh(
            new THREE.CylinderGeometry(s > 0 ? r * 0.93 : r, s > 0 ? r : r * 0.93, tCh, 64, 1, false),
            [mats.gold, s > 0 ? goldFace : mats.gold, s > 0 ? mats.gold : goldFace]);
          ch.position.y = s * (tBody / 2 + tCh / 2);
          inner.add(ch);
        });
        const coreBase = allGold ? mats.gold : mats.silver;
        const coreFace = faceMat(coreBase, mark,
          mark ? new THREE.Color(allGold ? 0xe3b878 : 0xcdd1d3).multiplyScalar(tint || 1) : null);
        inner.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.63, r * 0.63, t * 1.02, 48, 1),
          [coreBase, coreFace, coreFace]));
        inner.rotation.x = Math.PI / 2; // faces the camera
        return inner;
      };
      const base = colors ? recolor(colors)
        : tint ? tintMats(tint) : { gold: goldMat, edge: goldEdgeMat, silver: silverMat };
      if (!blur) {
        outer.add(build(base));
        return outer;
      }
      // cheap defocus: stack translucent offset copies over a small disc
      const N = 7, op = 0.6;
      const soft = m => {
        const c = m.clone();
        c.transparent = true; c.opacity = op; c.depthWrite = false;
        return c;
      };
      const mats = { gold: soft(base.gold), edge: soft(base.edge), silver: soft(base.silver) };
      for (let i = 0; i < N; i++) {
        const g = build(mats);
        const a = (i / N) * Math.PI * 2;
        const rad = i === 0 ? 0 : blur * (0.45 + 0.55 * ((i % 3) / 2));
        g.position.set(Math.cos(a) * rad, Math.sin(a) * rad, 0);
        outer.add(g);
      }
      return outer;
    };

    // ---------- composition ----------
    // Phones (≤700px, or a phone on its side) keep the original layout: phone + DEWS card + board.
    // Tablets and up get the "duo": two phones that flip between Smart (light, LTR) and
    // Zurich (dark, RTL) depending on which half of the screen the cursor is on.
    const MOBILE_Q = '(max-width: 700px), (max-height: 500px) and (orientation: landscape)';
    const mq = (() => {
      try { if (parent !== window && parent.matchMedia) return parent.matchMedia(MOBILE_Q); } catch (e) {}
      return window.matchMedia(MOBILE_Q);
    })();
    const TILT = 10 * Math.PI / 180;
    const legacyG = new THREE.Group(), duoG = new THREE.Group();
    stack.add(legacyG, duoG);
    let floatersLegacy = null, floatersDuo = null, duoPhones = [];

    const buildLegacy = () => {
      const CARD_W = 11.0 * (548 / 1157);
      const phone = makePhone(R('uploads/smart-dashboard-2026.webp?v=3'), 11.91, 824 / 1848);
      phone.position.set(-1.0, 0.1, 1.6);
      phone.rotation.set(0, 0, TILT);
      legacyG.add(phone);

      const dews = makeCard(R('uploads/zurich-balance-2026.webp?v=3'), 11.59 * (824 / 1848), 11.59);
      dews.position.set(4.25, 0.9, -0.8);
      dews.rotation.set(0, 0, TILT);
      legacyG.add(dews);

      const board = makeCard(R('uploads/smart-343d.webp'), CARD_W, CARD_W * (495 / 620));
      board.position.set(-6.2, -0.3, 3.2);
      board.rotation.set(0, 0, TILT);
      legacyG.add(board);

      floatersLegacy = [
        { obj: phone, base: phone.position.clone(), amp: 0.30, speed: 0.55, phase: 0, depth: 1.2, follow: 0.15, yaw: 0 },
        { obj: dews, base: dews.position.clone(), amp: 0.40, speed: 0.42, phase: 1.6, depth: 0.7, follow: 0.10, yaw: 0 },
        { obj: board, base: board.position.clone(), amp: 0.34, speed: 0.36, phase: 3.2, depth: 0.35, follow: 0.21, yaw: 0 }
      ];
    };

    const buildDuo = () => {
      const PH = 11.9, PA = 624 / 1398;
      // Each phone has one screen and swaps it halfway through a full 360° turn (while it faces
      // away). RTL reads right-to-left, so on Zurich the dashboard is on the right phone and the
      // balance on the left. The phones spin in opposite directions, in step, and ease apart
      // mid-turn, so they never pass through each other.
      const mk = (smartSrc, zurichSrc, pos, tiltDeg, yaw, spin, f) => {
        const outer = new THREE.Group(), flip = new THREE.Group();
        const phone = makePhone(R(smartSrc), PH, PA);
        const texS = phone.userData.screen.material.map;
        const texZ = loadTex(R(zurichSrc));
        texZ.repeat.set(1, 1846 / 1848);
        flip.add(phone);
        outer.add(flip);
        outer.position.set(pos[0], pos[1], pos[2]);
        outer.rotation.z = tiltDeg * Math.PI / 180;
        duoG.add(outer);
        return Object.assign({ obj: outer, flip, mat: phone.userData.screen.material, texS, texZ, spin,
          base: outer.position.clone(), yaw, ang: 0, from: 0, to: 0, t0: -1, push: 0, lift: 0 }, f);
      };
      const a = mk('uploads/smart-dashboard-light.webp?v=5', 'uploads/zurich-balance-dark.webp?v=5',
        [-1.55, -0.35, 1.3], 7, 0.16, 1, { amp: 0.30, speed: 0.55, phase: 0, depth: 1.1, follow: 0.15, apart: -1 });
      const b = mk('uploads/smart-balance-light.webp?v=5', 'uploads/zurich-dashboard-dark.webp?v=5',
        [3.75, 0.45, -0.6], -7, -0.16, -1, { amp: 0.36, speed: 0.46, phase: 1.6, depth: 0.75, follow: 0.12, apart: 1 });
      duoPhones = [a, b];
      floatersDuo = duoPhones;
      duoPhones.forEach(ph => { ph.ang = ph.to = side === 'zurich' ? ph.spin * Math.PI * 2 : 0; poseDuo(ph); });
    };
    const DUO_CX = 1.1; // centre of the pair in world units (midway between the phone centres)
    // apply a phone's spin angle: rotation, which screen shows, and how far the pair eases apart
    const poseDuo = ph => {
      ph.flip.rotation.y = ph.ang;
      const tex = Math.abs(ph.ang) > Math.PI ? ph.texZ : ph.texS;
      if (ph.mat.map !== tex) { ph.mat.map = tex; ph.mat.needsUpdate = true; }
      const s = Math.abs(Math.sin(ph.ang / 2)); // 0 at rest, 1 when facing away
      ph.push = ph.apart * 1.4 * s;
      ph.lift = 0.6 * s;
    };

    const coinSpecs = [
      { r: 0.98, pos: [7.4, 4.3, -3.2], duo: [7.9, 4.6, -3.4], duoScale: 0.9, tilt: [-0.28, 0, 0.5], idle: 0.22, gain: 1.0, amp: 0.30, speed: 0.5, phase: 0.4, blur: 0, tint: 0.55, mark: '1' },
      { r: 0.84, pos: [-7.2, 1.6, 8.0], duo: [-4.9, 1.9, 7.0], duoScale: 0.82, tilt: [0.18, 0, -0.55], idle: -0.3, gain: 1.3, amp: 0.36, speed: 0.62, phase: 2.1, blur: 0, mark: '1' },
      { r: 0.9, pos: [3.6, -4.2, 2.6], duo: [5.9, -2.6, 3.4], tilt: [-0.12, 0, 0.9], idle: 0.26, gain: 1.15, amp: 0.28, speed: 0.44, phase: 4.0, blur: 0, tint: 0.72, mark: '10', allGold: true }
    ];
    const coins = coinSpecs.map(s => {
      const c = makeCoin(s.r, s.blur ? s.blur * s.r : 0, s.tint, s.colors, s.mark, s.allGold);
      c.position.set(s.pos[0], s.pos[1], s.pos[2]);
      c.rotation.set(s.tilt[0], 0, s.tilt[2]);
      root.add(c);
      return { obj: c, spec: s, base: c.position.clone(), spin: 0 };
    });

    let mode = null, floaters = [];
    const applyMode = () => {
      const m = mq.matches ? 'legacy' : 'duo';
      if (m === mode) return;
      mode = m;
      if (m === 'legacy' && !floatersLegacy) buildLegacy();
      if (m === 'duo' && !floatersDuo) buildDuo();
      legacyG.visible = m === 'legacy';
      duoG.visible = m === 'duo';
      floaters = m === 'legacy' ? floatersLegacy : floatersDuo;
      coins.forEach(c => {
        const p = m === 'duo' ? c.spec.duo : c.spec.pos;
        c.base.set(p[0], p[1], p[2]);
        c.obj.scale.setScalar(m === 'duo' ? (c.spec.duoScale || 1) : 1);
      });
    };
    try { mq.addEventListener('change', applyMode); } catch (e) { try { mq.addListener(applyMode); } catch (e2) {} }

    // ---------- Smart / Zurich side ----------
    let side = 'zurich'; // Smart opens on Zurich; the page then follows the cursor
    const now = () => performance.now() / 1000; // real time, so the flip keeps pace with the background fade
    const setSide = s => {
      s = s === 'zurich' ? 'zurich' : 'smart';
      if (s === side) return;
      side = s;
      duoPhones.forEach(ph => { ph.from = ph.ang; ph.to = s === 'zurich' ? ph.spin * Math.PI * 2 : 0; ph.t0 = now(); });
    };
    applyMode();
    const embedded = (() => { try { return parent !== window; } catch (e) { return true; } })();
    addEventListener('message', e => {
      const d = e.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === 'smart-side') setSide(d.side);
      else if (d.type === 'smart-pointer' && mode === 'duo') setFromNorm(d.nx * 2 - 1, d.ny * 2 - 1);
    });

    // ---------- pointer ----------
    const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
    let vel = 0;
    const setFromNorm = (nx, ny) => {
      vel = Math.min(3.2, vel + Math.hypot(nx - target.x, ny - target.y) * 5.5);
      target.x = nx; target.y = ny;
    };
    const setFromEvent = (cx, cy) => {
      const rct = this.getBoundingClientRect();
      setFromNorm(((cx - rct.left) / rct.width) * 2 - 1, ((cy - rct.top) / rct.height) * 2 - 1);
    };
    const onMove = e => {
      setFromEvent(e.clientX, e.clientY);
      // the page decides the side from where the cursor is on the whole screen
      if (embedded) {
        try { parent.postMessage({ type: 'smart-ptr', nx: e.clientX / innerWidth, ny: e.clientY / innerHeight }, '*'); } catch (err) {}
      } else if (mode === 'duo') {
        setSide(e.clientX >= innerWidth / 2 ? 'zurich' : 'smart');
      }
    };
    const onTouch = e => { if (e.touches[0]) setFromEvent(e.touches[0].clientX, e.touches[0].clientY); };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });

    // ---------- swipe (same contract as the Guardian scene) ----------
    let drag = null;
    this.addEventListener('touchstart', e => {
      const t0 = e.touches[0];
      if (t0) drag = { x: t0.clientX, y: t0.clientY, tx: 0, ty: 0, x0: t0.clientX, y0: t0.clientY, t: performance.now() };
    }, { passive: true });
    this.addEventListener('touchmove', e => {
      if (!drag) return;
      const t0 = e.touches[0];
      if (!t0) return;
      const ddx = t0.clientX - drag.x, ddy = t0.clientY - drag.y;
      drag = { x: t0.clientX, y: t0.clientY, tx: drag.tx + ddx, ty: drag.ty + ddy };
    }, { passive: true });
    // Touch screens: this scene covers most of the Smart panel, so its taps and swipes never reach
    // the homepage. Pass them up: a tap (where on the screen) picks Smart/Zurich, a sideways swipe
    // flips the theme or changes section (same thresholds as the homepage's own swipe).
    const endTouchDrag = () => {
      if (drag) {
        const ax = Math.abs(drag.tx), ay = Math.abs(drag.ty);
        if (ax < 12 && ay < 12 && performance.now() - drag.t < 600) {
          try { parent.postMessage({ type: 'smart-tap', nx: drag.x0 / innerWidth, ny: drag.y0 / innerHeight }, '*'); } catch (err) {}
        } else if (ax > 60 && ax > ay * 1.5) {
          try { parent.postMessage({ type: 'gu3d-swipe', dir: drag.tx < 0 ? 1 : -1 }, '*'); } catch (err) {}
        }
      }
      drag = null;
    };
    this.addEventListener('touchend', endTouchDrag, { passive: true });
    this.addEventListener('touchcancel', endTouchDrag, { passive: true });

    // ---------- resize ----------
    const resize = () => {
      const w = this.clientWidth || 1, h = this.clientHeight || 1;
      renderer.setSize(w, h, true);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = w / h;
      const portrait = h > w;
      const fitW = portrait ? 26 : 32.2, fitH = portrait ? 26 : 18.3;
      const vFov = (camera.fov * Math.PI) / 180;
      const distH = (fitH / 2) / Math.tan(vFov / 2);
      const distW = (fitW / 2) / Math.tan(vFov / 2) / camera.aspect;
      camera.position.z = Math.max(distH, distW) * 1.02;
      camera.position.x = 0;
      camera.position.y = 0;
      camera.updateProjectionMatrix();
    };
    let centreX = 0, centreCur = 0, centreSnap = false, centreKnown = false, centreTick = 0;
    const measureCentre = () => {
      if (mode !== 'duo') return;
      let left = 0, width = this.clientWidth || innerWidth, pageW = innerWidth;
      let fe = null;
      try { fe = window.frameElement; } catch (e) {}
      if (fe) {
        const r = fe.getBoundingClientRect();
        if (!r.width) return;
        // ignore the panel slide-in (a translateX on the scene's wrapper), so it's right from the start
        let tx = 0;
        try {
          const wrap = fe.parentElement, cs = wrap && getComputedStyle(wrap).transform;
          if (cs && cs !== 'none') tx = new DOMMatrixReadOnly(cs).m41;
          const own = getComputedStyle(fe).transform;
          const ownScale = own && own !== 'none' ? new DOMMatrixReadOnly(own).a : 1;
          tx *= r.width / ((fe.offsetWidth || r.width) * ownScale);
        } catch (e) {}
        left = r.left - tx; width = r.width;
        pageW = fe.ownerDocument.documentElement.clientWidth || pageW;
      }
      const ndc = ((pageW / 2 - left) / width) * 2 - 1;
      const halfW = Math.tan(camera.fov * Math.PI / 360) * (camera.position.z - 0.35) * camera.aspect;
      centreX = ndc * halfW - DUO_CX;
      if (!centreKnown) { centreKnown = true; centreSnap = true; } // first reading: jump, later: glide
    };
    new ResizeObserver(() => { resize(); measureCentre(); }).observe(this);
    let _lw = 0, _lh = 0;
    this._checkSize = () => {
      const w = this.clientWidth || 1, h = this.clientHeight || 1;
      if (w !== _lw || h !== _lh) { _lw = w; _lh = h; resize(); }
    };
    addEventListener('resize', this._checkSize, { passive: true });
    addEventListener('orientationchange', this._checkSize, { passive: true });
    resize();

    const num = (names, d) => {
      for (const n of names) { const v = parseFloat(this.getAttribute(n)); if (!isNaN(v)) return v; }
      return d;
    };
    const clock = new THREE.Clock();
    let t = 0;
    const frame = () => {
      const px = num(['parallax'], 1), fs = num(['float-speed', 'floatspeed'], 1);
      const dt = Math.min(clock.getDelta(), 0.05);
      t += dt * fs;
      this._checkSize();
      this.style.background = this._transparent ? 'transparent'
        : (mode === 'duo' && side === 'zurich' ? '#051240' : (this.getAttribute('background') || '#C6D9EF'));
      // spin each duo phone a full turn towards its target side (in step, eased)
      duoPhones.forEach(ph => {
        if (ph.t0 < 0) return;
        const k = Math.min(1, Math.max(0, (now() - ph.t0) / 1.1));
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        ph.ang = ph.from + (ph.to - ph.from) * e;
        poseDuo(ph);
        if (k >= 1) ph.t0 = -1;
      });
      if (++centreTick % 20 === 0) measureCentre();
      centreCur += (centreX - centreCur) * (centreSnap ? 1 : 0.12);
      centreSnap = false;
      cur.x += (target.x - cur.x) * 0.16;
      cur.y += (target.y - cur.y) * 0.16;
      vel *= Math.pow(0.02, dt); // decays back to the idle drift

      root.rotation.y = -cur.x * 0.07 * px;
      root.rotation.x = cur.y * 0.05 * px;
      stack.rotation.y = -cur.x * 0.05 * px;
      stack.rotation.x = cur.y * 0.03 * px;
      root.position.x = (mode === 'duo' ? centreCur : 0) - cur.x * 1.1 * px;
      root.position.y = -cur.y * 0.35 * px;

      floaters.forEach(f => {
        f.obj.position.y = f.base.y + Math.sin(t * f.speed + f.phase) * f.amp - cur.y * 0.5 * px;
        f.obj.position.x = f.base.x + (f.push || 0) + Math.cos(t * f.speed * 0.7 + f.phase) * f.amp * 0.35 + cur.x * f.depth * px;
        // each interface starts face-on and turns toward the cursor at its own rate
        f.obj.rotation.y = (f.yaw || 0) - cur.x * f.follow * px;
        f.obj.position.z = f.base.z + (f.lift || 0);
        f.obj.rotation.x = cur.y * f.follow * 0.55 * px;
      });

      coins.forEach(c => {
        const s = c.spec;
        c.spin += dt * (s.idle + Math.sign(s.idle) * vel * s.gain * 1.8);
        c.obj.rotation.y = c.spin;
        c.obj.rotation.z = s.tilt[2] + Math.sin(t * s.speed + s.phase) * 0.10 + cur.x * 0.05;
        c.obj.rotation.x = s.tilt[0] + Math.sin(t * s.speed * 0.8 + s.phase) * 0.07 - cur.y * 0.05;
        c.obj.position.y = c.base.y + Math.sin(t * s.speed + s.phase) * s.amp - cur.y * 1.1 * px;
        c.obj.position.x = c.base.x + Math.cos(t * s.speed * 0.7 + s.phase) * s.amp * 0.4 + cur.x * 1.5 * px;
      });

      renderer.render(scene, camera);
    };

    let running = false;
    const start = () => {
      if (running) return;
      running = true;
      clock.getDelta();
      renderer.setAnimationLoop(frame);
    };
    this._stop = () => {
      if (!running) return;
      running = false;
      renderer.setAnimationLoop(null);
    };
    let onScreen = true;
    const sync = () => (onScreen && !document.hidden ? start() : this._stop());
    if (typeof IntersectionObserver !== 'undefined') {
      this._visIO = new IntersectionObserver(es => {
        onScreen = es.some(e => e.isIntersecting);
        if (!onScreen) frame();
        sync();
      }, { rootMargin: '80px 0px' });
      this._visIO.observe(this);
    }
    document.addEventListener('visibilitychange', sync);
    sync();
    frame();
  }
}

if (!customElements.get('smart-scene')) customElements.define('smart-scene', SmartScene);
})();
