// Headless smoke test: stub DOM/canvas in a vm context, run the game loop.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeCtxStub() {
  return new Proxy({}, {
    get(t, prop) {
      if (prop === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient')
        return () => ({ addColorStop() {} });
      if (prop === 'measureText') return () => ({ width: 0 });
      if (typeof prop === 'string' && !(prop in t)) t[prop] = () => {};
      return t[prop];
    },
    set(t, prop, v) { t[prop] = v; return true; },
  });
}
function makeCanvasStub() {
  return { width: 0, height: 0, style: {}, getContext: () => makeCtxStub() };
}

const listeners = {};
const sandbox = {
  console,
  performance,
  window: null, // patched below
  _AC: class {
    constructor() { this.currentTime = 0; this.sampleRate = 8000; this.destination = {}; }
    resume() {}
    _param() { return { setValueAtTime() {}, exponentialRampToValueAtTime() {} }; }
    createOscillator() { return { connect() { return this; }, start() {}, stop() {}, frequency: this._param(), type: '' }; }
    createGain() { return { connect() { return this; }, gain: this._param() }; }
    createBiquadFilter() { return { connect() { return this; }, frequency: this._param(), type: '' }; }
    createBufferSource() { return { connect() { return this; }, start() {}, stop() {}, buffer: null }; }
    createBuffer(c, len) { return { getChannelData: () => new Float32Array(len) }; }
  },
  innerWidth: 1280,
  innerHeight: 800,
  addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
  document: {
    getElementById(id) {
      if (id === 'game') return makeCanvasStub();
      return { style: {}, textContent: '' };
    },
    createElement() { return makeCanvasStub(); },
  },
  requestAnimationFrame(cb) { sandbox.__raf = cb; },
};
sandbox.window = { AudioContext: sandbox._AC };
vm.createContext(sandbox);

for (const f of ['terrain.js', 'particles.js', 'player.js', 'game.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), sandbox, { filename: f });
}

const R = code => vm.runInContext(code, sandbox);

let t = 0;
const step = ms => { t += ms; sandbox.__raf(t); };

// 1) Terrain sanity
console.log('terrain size:', R('terrain.w'), 'x', R('terrain.h'));
console.log('center solid?', R('terrain.isSolid(terrain.w/2, terrain.h/2)'), '(want false)');
console.log('corner solid?', R('terrain.isSolid(5, 5)'), '(want true)');

// 2) Idle frames before start
for (let i = 0; i < 120; i++) step(16);

// 3) "Press a key", drive + fire for 5s
listeners.keydown.forEach(fn => fn({ key: 'w', preventDefault() {} }));
listeners.keydown.forEach(fn => fn({ key: 'd', preventDefault() {} }));
listeners.mousemove.forEach(fn => fn({ clientX: 900, clientY: 200 }));
listeners.mousedown.forEach(fn => fn({ button: 0 }));
for (let i = 0; i < 300; i++) step(16);
listeners.keyup.forEach(fn => fn({ key: 'w', preventDefault() {} }));
listeners.keyup.forEach(fn => fn({ key: 'd', preventDefault() {} }));
listeners.mouseup.forEach(fn => fn({ button: 0 }));

const you = R('({x: players[0].x, y: players[0].y})');
console.log('you at:', you.x.toFixed(0), you.y.toFixed(0));
console.log('alive players:', R('players.filter(p=>p.alive).length'));
console.log('kills:', R('players.map(p=>p.name+":"+p.kills).join(" ")'));
console.log('deaths:', R('players.map(p=>p.name+":"+p.deaths).join(" ")'));
console.log('particles:', R('particles.length'));

// 4) Direct blast in solid rock
const tx = R('({s: terrain.isSolid(15, terrain.h/2)})');
R('explode(15, terrain.h/2, 40, 20, null)');
console.log('carve in solid rock? before:', tx.s, 'after:', R('terrain.isSolid(15, terrain.h/2)'), '(want true -> false)');

// 5) Frames after the blast
for (let i = 0; i < 60; i++) step(16);
console.log('post-blast frames OK, alive:', R('players.filter(p=>p.alive).length'));

// 6) Long battle: ~60s of passive simulation, bots should kill each other
for (let i = 0; i < 3600; i++) step(16);
const battle = R('players.map(p=>p.name+":"+p.kills+"/"+p.deaths).join(" ")');
console.log('after 60s (kills/deaths):', battle);
const totalKills = R('players.reduce((s,p)=>s+p.kills,0)');
if (totalKills === 0) throw new Error('no kills in 60s of simulation — bots too dumb/weak?');
console.log('SMOKE TEST PASSED');
