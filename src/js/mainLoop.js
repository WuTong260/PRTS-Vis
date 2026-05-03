var callbacks = [];
var running = false;
var frameId = null;

export function register(fn) {
  callbacks.push(fn);
}

export function unregister(fn) {
  var idx = callbacks.indexOf(fn);
  if (idx !== -1) callbacks.splice(idx, 1);
}

export function start() {
  if (running) return;
  running = true;
  tick(performance.now());
}

export function stop() {
  running = false;
  if (frameId) {
    cancelAnimationFrame(frameId);
    frameId = null;
  }
}

function tick(timestamp) {
  if (!running) return;
  for (var i = 0; i < callbacks.length; i++) {
    callbacks[i](timestamp);
  }
  frameId = requestAnimationFrame(tick);
}
