import { register } from './mainLoop.js';

var particles = [];
var canvas, ctx;
var gridCols = 0;
var gridRows = 0;
var grid = [];
var CELL_SIZE = 150;
var prevW = 0;
var prevH = 0;

function targetCount(w, h) {
  var area = w * h;
  return Math.round(area / 10000);
}

function createParticle(w, h) {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    r: 0.6 + Math.random() * 1.8,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3 - 0.15,
    alpha: 0.3 + Math.random() * 0.5,
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: 0.005 + Math.random() * 0.02,
  };
}

function resize() {
  var w = window.innerWidth;
  var h = window.innerHeight;
  if (w === prevW && h === prevH) return;

  canvas.width = w;
  canvas.height = h;
  gridCols = Math.ceil(w / CELL_SIZE) + 1;
  gridRows = Math.ceil(h / CELL_SIZE) + 1;

  var count = targetCount(w, h);

  if (count > particles.length) {
    for (var i = particles.length; i < count; i++) {
      particles.push(createParticle(w, h));
    }
  } else if (particles.length > count) {
    particles.length = count;
  }

  for (var i = 0; i < particles.length; i++) {
    var p = particles[i];
    p.x = (p.x / (prevW || w)) * w;
    p.y = (p.y / (prevH || h)) * h;
    if (p.x < 0 || p.x > w) p.x = Math.random() * w;
    if (p.y < 0 || p.y > h) p.y = Math.random() * h;
  }

  prevW = w;
  prevH = h;
}

function buildGrid() {
  grid = [];
  for (var r = 0; r < gridRows; r++) {
    grid[r] = [];
    for (var c = 0; c < gridCols; c++) {
      grid[r][c] = [];
    }
  }
  for (var i = 0; i < particles.length; i++) {
    var p = particles[i];
    var col = Math.floor(p.x / CELL_SIZE);
    var row = Math.floor(p.y / CELL_SIZE);
    if (col >= 0 && col < gridCols && row >= 0 && row < gridRows) {
      grid[row][col].push(i);
    }
  }
}

function drawConnections() {
  for (var r = 0; r < gridRows; r++) {
    for (var c = 0; c < gridCols; c++) {
      var cell = grid[r][c];
      if (cell.length === 0) continue;

      var neighbors = [
        [r, c],
        [r, c + 1],
        [r + 1, c - 1],
        [r + 1, c],
        [r + 1, c + 1],
      ];

      for (var ni = 0; ni < neighbors.length; ni++) {
        var nr = neighbors[ni][0];
        var nc = neighbors[ni][1];
        if (nr < 0 || nr >= gridRows || nc < 0 || nc >= gridCols) continue;

        var otherCell = grid[nr][nc];
        if (otherCell.length === 0) continue;

        for (var a = 0; a < cell.length; a++) {
          var startJ = (nr === r && nc === c) ? a + 1 : 0;
          for (var b = startJ; b < otherCell.length; b++) {
            var pi = particles[cell[a]];
            var pj = particles[otherCell[b]];
            var dx = pi.x - pj.x;
            var dy = pi.y - pj.y;
            var distSq = dx * dx + dy * dy;
            if (distSq < CELL_SIZE * CELL_SIZE) {
              var dist = Math.sqrt(distSq);
              ctx.beginPath();
              ctx.moveTo(pi.x, pi.y);
              ctx.lineTo(pj.x, pj.y);
              ctx.strokeStyle = 'rgba(255,184,0,' + (0.04 * (1 - dist / CELL_SIZE)) + ')';
              ctx.lineWidth = 0.4;
              ctx.stroke();
            }
          }
        }
      }
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (var i = 0; i < particles.length; i++) {
    var p = particles[i];
    p.pulse += p.pulseSpeed;
    var flicker = p.alpha * (0.5 + 0.5 * Math.sin(p.pulse));

    var s = p.r;
    var cx = p.x;
    var cy = p.y;

    var grd = ctx.createRadialGradient(cx, cy, s * 0.2, cx, cy, s * 6);
    grd.addColorStop(0, 'rgba(255,210,120,' + (flicker * 0.25) + ')');
    grd.addColorStop(0.4, 'rgba(255,180,80,' + (flicker * 0.08) + ')');
    grd.addColorStop(1, 'rgba(255,150,40,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(cx - s * 6, cy - s * 6, s * 12, s * 12);

    ctx.fillStyle = 'rgba(255,220,140,' + (flicker * 0.9) + ')';
    ctx.fillRect(cx - s * 0.3, cy - s * 0.5, s * 0.8, s * 0.6);
    ctx.fillRect(cx - s * 0.5, cy + s * 0.1, s * 0.5, s * 0.3);
    ctx.fillRect(cx + s * 0.1, cy - s * 0.2, s * 0.4, s * 0.7);

    p.x += p.vx;
    p.y += p.vy;

    if (p.x < -10) p.x = canvas.width + 10;
    if (p.x > canvas.width + 10) p.x = -10;
    if (p.y < -10) p.y = canvas.height + 10;
    if (p.y > canvas.height + 10) p.y = -10;
  }

  buildGrid();
  drawConnections();
}

export function initParticles(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  prevW = window.innerWidth;
  prevH = window.innerHeight;
  canvas.width = prevW;
  canvas.height = prevH;
  gridCols = Math.ceil(prevW / CELL_SIZE) + 1;
  gridRows = Math.ceil(prevH / CELL_SIZE) + 1;

  var count = targetCount(prevW, prevH);
  for (var i = 0; i < count; i++) {
    particles.push(createParticle(prevW, prevH));
  }

  window.addEventListener('resize', resize);
  register(draw);
}
