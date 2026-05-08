(() => {
  'use strict';

  const SCREEN_W = 640;
  const SCREEN_H = 360;
  const SCALE = 3;
  const TILE = 16;
  const LEVEL_Y = 58;
  const WORLD_W = 3550;
  const GRAVITY = 0.48;
  const MAX_FALL = 10;
  const TITLE = 'Pixel Dash Run';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  canvas.width = SCREEN_W;
  canvas.height = SCREEN_H;
  ctx.imageSmoothingEnabled = false;

  const keys = new Set();
  const pressed = new Set();
  window.addEventListener('keydown', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'ShiftLeft', 'ShiftRight'].includes(e.code)) e.preventDefault();
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));

  const imgNames = {
    bgFar: 'assets/bg_far_stage1.png',
    bgMid: 'assets/bg_mid_stage1.png',
    tiles: 'assets/tiles.png'
  };
  const images = {};
  function loadImage(name, src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { images[name] = img; resolve(); };
      img.onerror = () => { images[name] = null; resolve(); };
      img.src = src;
    });
  }

  const sourceRects = {};

  function rect(x, y, w, h) { return { x, y, w, h }; }

  const solids = [
    rect(-80, 224, 515, 90), rect(542, 238, 170, 76), rect(780, 220, 210, 94),
    rect(1078, 236, 150, 78), rect(1292, 212, 245, 102), rect(1610, 238, 165, 76),
    rect(1850, 204, 250, 110), rect(2208, 236, 180, 78), rect(2460, 218, 250, 96),
    rect(2800, 236, 165, 78), rect(3045, 236, 128, 78), rect(3290, 192, 230, 122),
    rect(238, 176, 110, 16), rect(614, 156, 98, 16), rect(840, 132, 112, 16),
    rect(1128, 158, 132, 16), rect(1404, 142, 116, 16), rect(1728, 122, 154, 16),
    rect(1966, 150, 120, 16), rect(2328, 142, 128, 16), rect(2582, 126, 126, 16),
    rect(2868, 150, 126, 16), rect(3066, 160, 92, 16), rect(3188, 128, 100, 16),
    rect(3334, 96, 112, 16),
    rect(760, 96, 86, 16), rect(1598, 94, 92, 16), rect(2188, 100, 94, 16),
    rect(2948, 94, 96, 16)
  ];

  const props = [
    { x: 130, y: 184, kind: 'lamp' }, { x: 620, y: 168, kind: 'rail' },
    { x: 1135, y: 166, kind: 'lamp' }, { x: 1605, y: 178, kind: 'rail' },
    { x: 2240, y: 174, kind: 'lamp' }, { x: 2830, y: 170, kind: 'rail' }
  ];
  const springsSeed = [[506, 204], [1246, 212], [2148, 212], [2998, 214], [3230, 104]];
  const dashOrbsSeed = [[666, 128], [808, 68], [930, 104], [1510, 116], [1642, 66], [1788, 92], [2232, 72], [2364, 112], [2655, 94], [2992, 66], [3186, 104], [3370, 64]];
  const hazards = [
    rect(724, 230, 44, 12), rect(1555, 230, 42, 12), rect(2120, 232, 40, 12),
    rect(2412, 230, 42, 12), rect(2986, 230, 42, 12), rect(3180, 236, 50, 12)
  ];

  const gemsSeed = [
    [302, 146], [334, 140], [622, 126], [780, 68], [812, 62], [844, 68],
    [850, 104], [888, 98], [926, 104], [1148, 128], [1182, 122], [1216, 128],
    [1430, 112], [1466, 106], [1502, 112], [1618, 66], [1652, 60], [1686, 66],
    [1738, 92], [1778, 86], [1818, 92], [1988, 124], [2026, 118], [2210, 72],
    [2246, 66], [2282, 72], [2340, 112], [2378, 106], [2592, 96], [2634, 90],
    [2676, 96], [2888, 122], [2926, 118], [2970, 66], [3006, 60], [3042, 66],
    [3166, 104], [3204, 98], [3242, 104], [3348, 68], [3384, 62], [3420, 68]
  ];
  const enemySeed = [
    [360, 196], [886, 192], [1190, 208], [1508, 184], [2264, 208], [2924, 208], [3250, 180]
  ];
  const airEnemySeed = [[820, 74], [940, 120], [1518, 126], [1660, 72], [1792, 96], [2240, 78], [2364, 118], [2660, 100], [3000, 72], [3190, 120], [3380, 72]];
  const checkpointsSeed = [1040, 2050, 3045];

  let mode = 'title';
  let cameraX = 0;
  let runTimer = 0;
  let hitStop = 0;
  let finishTimer = 0;
  let checkpointX = 72;
  let flashText = '';
  let flashTimer = 0;
  let particles = [];
  let gems = [];
  let enemies = [];
  let checkpoints = [];
  let springs = [];
  let dashOrbs = [];

  const player = {
    x: 72, y: 160, w: 16, h: 30, vx: 0, vy: 0, hp: 3, maxHp: 3, lives: 3,
    onGround: false, coyote: 0, jumpBuffer: 0, jumps: 0, facing: 1, inv: 0,
    dashTimer: 0, dashCooldown: 0, powered: 0, wallDir: 0, combo: 0, dead: false
  };

  function resetCollectibles() {
    gems = gemsSeed.map(([x, y]) => ({ x, y, w: 15, h: 15, got: false, pulse: Math.random() * 6 }));
    enemies = enemySeed.map(([x, y], i) => ({ x, y, w: 28, h: 28, vx: i % 2 ? 0.72 : -0.72, alive: true, crush: 0, floating: false }));
    enemies.push(...airEnemySeed.map(([x, y], i) => ({ x, y, baseY: y, w: 30, h: 30, vx: 0, alive: true, crush: 0, floating: true, phase: i * 1.7 })));
    checkpoints = checkpointsSeed.map((x) => ({ x, y: 176, w: 20, h: 46, active: false }));
    springs = springsSeed.map(([x, y]) => ({ x, y, w: 28, h: 16, cooldown: 0 }));
    dashOrbs = dashOrbsSeed.map(([x, y]) => ({ x, y, w: 22, h: 22, used: false, pulse: Math.random() * 6 }));
  }

  function startGame() {
    mode = 'play';
    runTimer = 0;
    finishTimer = 0;
    checkpointX = 72;
    resetCollectibles();
    Object.assign(player, { x: 72, y: 160, vx: 0, vy: 0, hp: 3, lives: 3, inv: 80, dashTimer: 0, dashCooldown: 0, powered: 0, wallDir: 0, combo: 0, dead: false });
    burst(player.x + 12, player.y + 12, 24, ['#ffffff', '#ffd85a', '#6ef7ff'], 3, 3.2);
    showFlash('READY');
  }

  function showFlash(text) { flashText = text; flashTimer = 82; }

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function burst(x, y, count, colors, size = 3, speed = 2.5) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random());
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.2, life: 22 + Math.random() * 28, max: 50, c: colors[i % colors.length], size: size * (0.65 + Math.random() * 0.8) });
    }
  }

  function getGroundBelow(x, startY) {
    let best = 9999;
    for (const s of solids) {
      if (x >= s.x - 2 && x <= s.x + s.w + 2 && s.y >= startY && s.y < best) best = s.y;
    }
    return best;
  }

  function respawn() {
    if (player.lives <= 0) {
      mode = 'gameover';
      showFlash('TRY AGAIN');
      return;
    }
    const gy = getGroundBelow(checkpointX + 10, 0);
    Object.assign(player, { x: checkpointX, y: gy - player.h, vx: 0, vy: 0, hp: player.maxHp, inv: 120, dashTimer: 0, dashCooldown: 0, powered: 0, wallDir: 0, combo: 0, dead: false });
    burst(player.x + 12, player.y + 14, 18, ['#ff5a5a', '#ffffff'], 3, 2.6);
    showFlash('CHECKPOINT');
  }

  function damage() {
    if (player.inv > 0 || mode !== 'play') return;
    player.hp--;
    player.inv = 95;
    hitStop = 7;
    burst(player.x + player.w / 2, player.y + player.h / 2, 22, ['#ff3131', '#ffb13b', '#ffffff'], 3, 3.6);
    if (player.hp <= 0) {
      player.lives--;
      respawn();
    }
  }

  function updateCourseGimmicks() {
    for (const spring of springs) {
      if (spring.cooldown > 0) spring.cooldown--;
      if (spring.cooldown <= 0 && overlap(player, spring) && player.vy >= 0) {
        player.y = spring.y - player.h;
        player.vy = -11.4;
        player.onGround = false;
        player.coyote = 0;
        player.jumps = 1;
        player.powered = Math.max(player.powered, 70);
        spring.cooldown = 28;
        burst(spring.x + spring.w / 2, spring.y, 22, ['#65f7ff', '#ffd85a', '#ffffff'], 2.5, 3.4);
        showFlash('BOOST');
      }
    }
    for (const hazard of hazards) {
      if (overlap(player, hazard)) {
        damage();
      }
    }
  }

  function solidAt(entity) {
    for (const s of solids) if (overlap(entity, s)) return s;
    return null;
  }

  function moveAxis(axis) {
    if (axis === 'x') player.x += player.vx;
    else player.y += player.vy;

    let guard = 0;
    let s;
    while ((s = solidAt(player)) && guard++ < 8) {
      if (axis === 'x') {
        if (player.vx > 0) { player.x = s.x - player.w; player.wallDir = 1; }
        if (player.vx < 0) { player.x = s.x + s.w; player.wallDir = -1; }
        player.vx = 0;
      } else {
        if (player.vy > 0) {
          player.y = s.y - player.h;
          player.vy = 0;
          player.onGround = true;
          player.coyote = 8;
          player.jumps = 0;
          player.combo = 0;
        } else if (player.vy < 0) {
          player.y = s.y + s.h;
          player.vy = 0;
        }
      }
    }
  }

  function updatePlayer() {
    if (pressed.has('Space') || pressed.has('ArrowUp') || pressed.has('KeyW')) player.jumpBuffer = 8;
    if (player.jumpBuffer > 0) player.jumpBuffer--;
    if (player.inv > 0) player.inv--;
    if (player.dashCooldown > 0) player.dashCooldown--;
    if (player.powered > 0) player.powered--;

    const left = keys.has('ArrowLeft') || keys.has('KeyA');
    const right = keys.has('ArrowRight') || keys.has('KeyD');
    const dashPressed = pressed.has('ShiftLeft') || pressed.has('ShiftRight') || pressed.has('KeyX');
    const accel = player.onGround ? 0.36 : 0.25;
    const max = player.powered > 0 ? 4.4 : 3.45;

    if (left) { player.vx -= accel; player.facing = -1; }
    if (right) { player.vx += accel; player.facing = 1; }
    if (!left && !right && player.onGround) player.vx *= 0.77;
    if (!left && !right && !player.onGround) player.vx *= 0.965;
    player.vx = Math.max(-max, Math.min(max, player.vx));

    if (dashPressed && player.dashCooldown <= 0) {
      player.dashTimer = 11;
      player.dashCooldown = 58;
      player.vx = player.facing * 7.0;
      player.vy *= 0.35;
      player.powered = Math.max(player.powered, 45);
      burst(player.x + player.w / 2, player.y + player.h / 2, 18, ['#6ef7ff', '#ffffff', '#ffd85a'], 2.5, 3.1);
    }
    if (player.dashTimer > 0) {
      player.dashTimer--;
      player.vy *= 0.78;
    } else {
      player.vy += GRAVITY;
      if (player.vy > MAX_FALL) player.vy = MAX_FALL;
    }

    if (player.jumpBuffer > 0) {
      if (!player.onGround && player.coyote <= 0 && player.wallDir !== 0) {
        player.vx = -player.wallDir * 5.6;
        player.vy = -8.9;
        player.facing = -player.wallDir;
        player.jumps = 1;
        player.jumpBuffer = 0;
        player.powered = Math.max(player.powered, 50);
        burst(player.x + player.w / 2, player.y + player.h / 2, 18, ['#65f7ff', '#ffffff'], 2.3, 3.0);
        showFlash('WALL KICK');
      } else if (player.onGround || player.coyote > 0 || player.jumps < 2) {
        const second = !player.onGround && player.coyote <= 0;
        player.vy = second ? -7.3 : -8.7;
        player.onGround = false;
        player.coyote = 0;
        player.jumps = second ? 2 : 1;
        player.jumpBuffer = 0;
        burst(player.x + player.w / 2, player.y + player.h, second ? 16 : 10, second ? ['#6ef7ff', '#ffffff'] : ['#e9d2a2', '#ffffff'], 2.2, second ? 2.9 : 1.9);
      }
    }

    if (!player.onGround && player.coyote > 0) player.coyote--;
    player.onGround = false;
    player.wallDir = 0;
    moveAxis('x');
    moveAxis('y');

    if (player.y > 318) {
      player.hp = 0;
      player.lives--;
      respawn();
    }
    if (player.x < 0) player.x = 0;
  }

  function updateEnemies() {
    for (const e of enemies) {
      if (!e.alive) { if (e.crush > 0) e.crush--; continue; }
      if (e.floating) {
        e.y = e.baseY + Math.sin(runTimer * 0.06 + e.phase) * 8;
      } else {
        e.x += e.vx;
        const ahead = e.vx > 0 ? e.x + e.w + 2 : e.x - 2;
        const foot = getGroundBelow(ahead, e.y + e.h - 4);
        if (foot > e.y + e.h + 8) e.vx *= -1;
        for (const s of solids) {
          if (overlap(e, s)) {
            if (e.vx > 0) e.x = s.x - e.w;
            else e.x = s.x + s.w;
            e.vx *= -1;
          }
        }
      }
      if (overlap(player, e)) {
        const wasAbove = player.vy > 0 && player.y + player.h - player.vy <= e.y + 8;
        if (wasAbove || player.dashTimer > 0) {
          e.alive = false;
          e.crush = 26;
          player.combo++;
          player.vy = -6.8 - Math.min(player.combo, 3) * 0.65;
          player.dashCooldown = 0;
          player.jumps = Math.min(player.jumps, 1);
          player.powered = Math.max(player.powered, 90);
          hitStop = 5;
          burst(e.x + e.w / 2, e.y + 10, 34 + player.combo * 6, ['#ffd85a', '#ff5a5a', '#ffffff'], 3, 4.2);
          showFlash(player.combo > 1 ? `COMBO x${player.combo}` : 'COMBO');
        } else {
          damage();
        }
      }
    }
  }

  function updateGems() {
    for (const g of gems) {
      if (g.got) continue;
      if (overlap(player, g)) {
        g.got = true;
        player.powered = Math.max(player.powered, 120);
        player.dashCooldown = Math.min(player.dashCooldown, 14);
        burst(g.x + 8, g.y + 8, 16, ['#65f7ff', '#ffd85a', '#ffffff'], 2.5, 3.0);
      }
    }
    for (const c of checkpoints) {
      if (!c.active && overlap(player, c)) {
        c.active = true;
        checkpointX = c.x;
        burst(c.x + 10, c.y + 18, 24, ['#65f7ff', '#ffd85a', '#ffffff'], 2.6, 3.1);
        showFlash('SAVE');
      }
    }
    for (const orb of dashOrbs) {
      if (orb.used) continue;
      if (overlap(player, orb)) {
        orb.used = true;
        player.dashCooldown = 0;
        player.jumps = Math.min(player.jumps, 1);
        player.powered = Math.max(player.powered, 100);
        burst(orb.x + 11, orb.y + 11, 28, ['#65f7ff', '#ffffff', '#ffd85a'], 3, 4.4);
        showFlash('DASH READY');
      }
    }
    if (player.x > 3395 && player.y < 170 && mode === 'play') {
      mode = 'clear';
      finishTimer = 0;
      hitStop = 18;
      showFlash('FINISH');
      burst(player.x + 20, player.y, 150, ['#ffd85a', '#ff5a5a', '#65f7ff', '#ffffff'], 4.5, 6.4);
      for (let i = 0; i < 6; i++) {
        burst(3300 + i * 28, 82 + Math.sin(i) * 28, 28, ['#ffd85a', '#ff5a5a', '#65f7ff', '#ffffff'], 3.5, 5.2);
      }
    }
  }

  function updateParticles() {
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      p.life--;
    }
    particles = particles.filter((p) => p.life > 0).slice(-420);
  }

  function update() {
    if (hitStop > 0) {
      hitStop--;
      updateParticles();
      pressed.clear();
      return;
    }
    if (flashTimer > 0) flashTimer--;

    if (mode === 'title') {
      if (pressed.has('Space') || pressed.has('Enter')) startGame();
      pressed.clear();
      return;
    }
    if (mode === 'gameover') {
      if (pressed.has('Space') || pressed.has('Enter')) startGame();
      updateParticles();
      pressed.clear();
      return;
    }
    if (mode === 'clear') {
      finishTimer++;
      if (finishTimer % 8 === 0) burst(3290 + Math.random() * 220, 50 + Math.random() * 110, 26, ['#ffd85a', '#ff5a5a', '#65f7ff', '#ffffff'], 3.4, 4.8);
      if (finishTimer % 22 === 0) burst(player.x + Math.random() * 80, player.y - 40 + Math.random() * 50, 42, ['#ffd85a', '#ffffff'], 4.2, 5.8);
      if (pressed.has('Space') || pressed.has('Enter')) startGame();
      updateParticles();
      pressed.clear();
      return;
    }

    runTimer++;
    updatePlayer();
    updateCourseGimmicks();
    updateEnemies();
    updateGems();
    updateParticles();
    const target = player.x + player.w / 2 - SCREEN_W * 0.38;
    cameraX += (target - cameraX) * 0.13;
    cameraX = Math.max(0, Math.min(WORLD_W - SCREEN_W, cameraX));
    pressed.clear();
  }

  function drawImageCrop(name, sx, sy, sw, sh, dx, dy, dw, dh, flip = false) {
    const img = images[name];
    if (!img) return false;
    ctx.save();
    if (flip) {
      ctx.translate(Math.floor(dx + dw), Math.floor(dy));
      ctx.scale(-1, 1);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, Math.floor(dw), Math.floor(dh));
    } else {
      ctx.drawImage(img, sx, sy, sw, sh, Math.floor(dx), Math.floor(dy), Math.floor(dw), Math.floor(dh));
    }
    ctx.restore();
    return true;
  }

  function drawBackground() {
    const far = images.bgFar;
    const mid = images.bgMid;
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    if (far) {
      const w = SCREEN_W * 1.8;
      const off = Math.floor(cameraX * 0.15) % w;
      ctx.drawImage(far, -off, -54, w, SCREEN_H * 1.35);
      ctx.drawImage(far, w - off, -54, w, SCREEN_H * 1.35);
    }
    if (mid) {
      const w = SCREEN_W * 1.8;
      const off = Math.floor(cameraX * 0.36) % w;
      ctx.drawImage(mid, -off, -42, w, SCREEN_H * 1.32);
      ctx.drawImage(mid, w - off, -42, w, SCREEN_H * 1.32);
    }
    ctx.fillStyle = 'rgba(11,16,27,0.22)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  }

  function drawProps() {
    for (const p of props) {
      const x = Math.floor(p.x - cameraX * 0.82);
      if (x < -80 || x > SCREEN_W + 80) continue;
      const y = p.y;
      if (p.kind === 'lamp') {
        ctx.fillStyle = '#2b1b14';
        ctx.fillRect(x, y, 6, 48);
        ctx.fillStyle = '#ffd85a';
        ctx.fillRect(x - 8, y - 8, 22, 12);
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#ffd85a';
        ctx.fillRect(x - 20, y + 4, 46, 30);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = 'rgba(15,23,42,0.72)';
        ctx.fillRect(x, y + 22, 92, 10);
        ctx.fillStyle = '#65f7ff';
        for (let i = 0; i < 4; i++) ctx.fillRect(x + 8 + i * 20, y + 18, 8, 4);
      }
    }
  }

  function drawTiles() {
    const tile = images.tiles;
    for (const s of solids) {
      const x = Math.floor(s.x - cameraX);
      const y = Math.floor(s.y + LEVEL_Y);
      if (x > SCREEN_W || x + s.w < 0) continue;
      if (tile) {
        const tw = Math.floor(tile.width / 8);
        for (let tx = 0; tx < s.w; tx += TILE) {
          ctx.drawImage(tile, 0, 0, tw, tile.height, x + tx, y, TILE, TILE);
          ctx.fillStyle = '#4a2d20';
          if (s.h > TILE) ctx.fillRect(x + tx, y + TILE, TILE, s.h - TILE);
        }
      } else {
        ctx.fillStyle = '#5a3924';
        ctx.fillRect(x, y, s.w, s.h);
        ctx.fillStyle = '#6fbe45';
        ctx.fillRect(x, y, s.w, 5);
      }
    }
  }

  function drawGimmicks() {
    for (const orb of dashOrbs) {
      if (orb.used) continue;
      const glow = Math.sin((runTimer + orb.pulse * 20) * 0.12) * 0.5 + 0.5;
      const x = Math.floor(orb.x - cameraX);
      const y = Math.floor(orb.y + LEVEL_Y);
      if (x < -40 || x > SCREEN_W + 40) continue;
      ctx.globalAlpha = 0.28 + glow * 0.22;
      ctx.fillStyle = '#65f7ff';
      ctx.fillRect(x - 6, y - 6, 34, 34);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x, y, 22, 22);
      ctx.fillStyle = '#65f7ff';
      ctx.fillRect(x + 4, y + 4, 14, 14);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 8, y + 8, 6, 6);
    }
    for (const h of hazards) {
      const x = Math.floor(h.x - cameraX);
      const y = Math.floor(h.y + LEVEL_Y);
      if (x < -40 || x > SCREEN_W + 40) continue;
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(x, y + 8, h.w, 5);
      ctx.fillStyle = '#ff5a5a';
      for (let sx = 0; sx < h.w; sx += 12) {
        ctx.beginPath();
        ctx.moveTo(x + sx, y + 10);
        ctx.lineTo(x + sx + 6, y - 4);
        ctx.lineTo(x + sx + 12, y + 10);
        ctx.fill();
      }
    }
    for (const s of springs) {
      const x = Math.floor(s.x - cameraX);
      const squash = s.cooldown > 18 ? 5 : 0;
      const y = Math.floor(s.y + LEVEL_Y + squash);
      if (x < -40 || x > SCREEN_W + 40) continue;
      ctx.fillStyle = '#65f7ff';
      ctx.fillRect(x, y, s.w, 5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 4, y + 5, s.w - 8, 4);
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(x + 3, y + 10, s.w - 6, 5);
    }
  }

  function drawGems() {
    for (const g of gems) {
      if (g.got) continue;
      const bob = Math.sin((runTimer + g.pulse * 20) * 0.08) * 3;
      const x = Math.floor(g.x - cameraX);
      const y = Math.floor(g.y + LEVEL_Y + bob);
      if (x < -30 || x > SCREEN_W + 30) continue;
      ctx.save();
      ctx.translate(x + 7, y + 7);
      ctx.fillStyle = '#65f7ff';
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(10, 0);
      ctx.lineTo(0, 11);
      ctx.lineTo(-10, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 4, y + 2, 4, 4);
      ctx.globalAlpha = 1;
    }
  }

  function drawEnemies() {
    for (const e of enemies) {
      if (!e.alive && e.crush <= 0) continue;
      const x = Math.floor(e.x - cameraX);
      const y = Math.floor(e.y + LEVEL_Y);
      if (x < -80 || x > SCREEN_W + 80) continue;
      const h = e.alive ? 48 : 16;
      const dy = e.alive ? y - 20 : y + 14;
      const wobble = e.alive ? Math.sin(runTimer * 0.09 + e.x) * 2 : 0;
      ctx.save();
      ctx.translate(x + 12 + wobble, dy + h / 2);
      ctx.fillStyle = e.alive ? '#7c3aed' : '#4c1d95';
      ctx.fillRect(-16, -h / 2, 32, h);
      ctx.fillStyle = '#c4b5fd';
      ctx.fillRect(-10, -h / 2 + 8, 8, 8);
      ctx.fillRect(4, -h / 2 + 8, 8, 8);
      ctx.fillStyle = '#1f1235';
      ctx.fillRect(-12, h / 2 - 10, 24, 5);
      ctx.restore();
    }
  }

  function drawCheckpointsAndGoal() {
    for (const c of checkpoints) {
      const x = Math.floor(c.x - cameraX);
      if (x < -40 || x > SCREEN_W + 40) continue;
      ctx.fillStyle = c.active ? '#65f7ff' : '#94a3b8';
      ctx.fillRect(x + 8, c.y + LEVEL_Y, 4, c.h);
      ctx.fillStyle = c.active ? '#ffd85a' : '#cbd5e1';
      ctx.fillRect(x + 12, c.y + LEVEL_Y + 4, 26, 16);
    }
    const gx = Math.floor(3428 - cameraX);
    const gy = 78 + LEVEL_Y;
    const pulse = Math.sin(runTimer * 0.08) * 0.5 + 0.5;
    ctx.globalAlpha = 0.18 + pulse * 0.16;
    ctx.fillStyle = '#ffd85a';
    ctx.fillRect(gx - 36, gy - 38, 116, 116);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(gx - 14, gy - 14, 72, 72);
    ctx.strokeStyle = '#ffd85a';
    ctx.lineWidth = 5;
    ctx.strokeRect(gx - 18, gy - 18, 80, 80);
    ctx.strokeStyle = '#65f7ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(gx - 8, gy - 8, 60, 60);
    ctx.fillStyle = '#ff5a5a';
    ctx.fillRect(gx + 8, gy + 8, 28, 28);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(gx + 16, gy + 16, 12, 12);
    ctx.fillStyle = '#ffd85a';
    for (let i = 0; i < 8; i++) {
      const a = runTimer * 0.04 + i * Math.PI / 4;
      ctx.fillRect(Math.floor(gx + 22 + Math.cos(a) * 58), Math.floor(gy + 22 + Math.sin(a) * 58), 4, 4);
    }
  }

  function drawPlayer() {
    if (player.inv > 0 && Math.floor(player.inv / 4) % 2 === 0) return;
    const dw = player.powered > 0 ? 58 : 50;
    const dh = player.powered > 0 ? 62 : 52;
    const x = Math.floor(player.x + player.w / 2 - dw / 2 - cameraX);
    const y = Math.floor(player.y + player.h - dh + LEVEL_Y);
    ctx.save();
    if (player.dashTimer > 0) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#65f7ff';
      ctx.fillRect(x - player.facing * 20, y + 18, 44, 10);
      ctx.globalAlpha = 1;
    }
    ctx.translate(x + dw / 2, y + dh);
    ctx.scale(player.facing, 1);
    ctx.fillStyle = player.powered > 0 ? '#facc15' : '#ef4444';
    ctx.fillRect(-13, -dh + 12, 26, dh - 18);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-15, -dh + 2, 30, 16);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(3, -dh + 7, 5, 5);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-19, -dh + 26, 8, 16);
    ctx.fillRect(11, -dh + 26, 8, 16);
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(-13, -8, 10, 8);
    ctx.fillRect(3, -8, 10, 8);
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.c;
      ctx.fillRect(Math.floor(p.x - cameraX), Math.floor(p.y + LEVEL_Y), Math.floor(p.size), Math.floor(p.size));
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    ctx.fillStyle = 'rgba(15,23,42,0.72)';
    ctx.fillRect(10, 10, 192, 38);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.strokeRect(10, 10, 192, 38);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(TITLE, 18, 25);
    for (let i = 0; i < player.maxHp; i++) {
      ctx.fillStyle = i < player.hp ? '#ff5a5a' : '#334155';
      ctx.fillRect(18 + i * 18, 33, 13, 8);
    }
    ctx.fillStyle = '#ffd85a';
    ctx.fillText(`x${player.lives}`, 86, 41);
    const progress = Math.min(1, player.x / 3360);
    ctx.fillStyle = 'rgba(15,23,42,0.72)';
    ctx.fillRect(438, 14, 184, 16);
    ctx.fillStyle = '#65f7ff';
    ctx.fillRect(442, 18, Math.floor(176 * progress), 8);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(442, 18, 176, 8);
  }

  function drawOverlay() {
    if (flashTimer > 0) {
      const a = Math.min(1, flashTimer / 30);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(flashText, SCREEN_W / 2, 74);
      ctx.globalAlpha = 1;
    }
    if (mode === 'title') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      ctx.fillStyle = '#ffd85a';
      ctx.font = 'bold 34px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(TITLE, SCREEN_W / 2, 146);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px monospace';
      ctx.fillText('SPACE: START   ARROWS/A-D: MOVE   SHIFT/X: DASH', SCREEN_W / 2, 188);
      if (Math.floor(Date.now() / 450) % 2 === 0) ctx.fillText('PRESS SPACE', SCREEN_W / 2, 224);
    }
    if (mode === 'gameover') {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      ctx.fillStyle = '#ff5a5a';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', SCREEN_W / 2, 166);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px monospace';
      ctx.fillText('PRESS SPACE TO RETRY', SCREEN_W / 2, 202);
    }
    if (mode === 'clear') {
      ctx.fillStyle = `rgba(255,216,90,${Math.max(0, 0.24 - finishTimer * 0.004)})`;
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      ctx.fillStyle = '#ffd85a';
      ctx.font = 'bold 34px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GOAL!', SCREEN_W / 2, 138);
      ctx.fillStyle = '#ffffff';
      ctx.font = '13px monospace';
      const sec = (runTimer / 60).toFixed(1);
      ctx.fillText(`CLEAR TIME  ${sec}s`, SCREEN_W / 2, 180);
      ctx.fillText('PRESS SPACE TO RUN AGAIN', SCREEN_W / 2, 220);
    }
  }

  function render() {
    ctx.save();
    drawBackground();
    drawProps();
    drawCheckpointsAndGoal();
    drawTiles();
    drawGimmicks();
    drawGems();
    drawEnemies();
    drawPlayer();
    drawParticles();
    ctx.restore();
    drawHUD();
    drawOverlay();
  }

  function step() { update(); render(); }
  function loop() { step(); requestAnimationFrame(loop); }

  window.render_game_to_text = () => JSON.stringify({
    mode, title: TITLE, origin: 'top-left, x right, y down',
    player: { x: Math.round(player.x), y: Math.round(player.y), hp: player.hp, lives: player.lives, dashCooldown: player.dashCooldown },
    cameraX: Math.round(cameraX), progress: Math.round((player.x / 3360) * 100),
    enemies: enemies.filter((e) => e.alive && Math.abs(e.x - player.x) < 420).map((e) => ({ x: Math.round(e.x), y: Math.round(e.y) })),
    gemsLeft: gems.filter((g) => !g.got).length,
    dashOrbsLeft: dashOrbs.filter((o) => !o.used).length
  });
  window.advanceTime = (ms) => {
    const frames = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < frames; i++) update();
    render();
  };

  Promise.all(Object.entries(imgNames).map(([name, src]) => loadImage(name, src))).then(() => {
    resetCollectibles();
    render();
    requestAnimationFrame(loop);
  });
})();
