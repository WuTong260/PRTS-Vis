import { register } from './mainLoop.js';

var sphere;
var mouseX = 0;
var mouseY = 0;
var targetMX = 0;
var targetMY = 0;
var spinAngle = 0;
var paused = false;

function calcSphereSize() {
  var vw = window.innerWidth;
  var vh = window.innerHeight;
  var min = vw < vh ? vw : vh;
  var base = Math.round(min * 0.45);
  var grown = Math.round(min * 0.72);
  sphere.style.setProperty('--sphere-size', base + 'px');
  sphere.style.setProperty('--sphere-size-grown', grown + 'px');
}

function onResize() {
  calcSphereSize();
}

function update() {
  if (!paused) {
    spinAngle += 0.12;
    mouseX += (targetMX - mouseX) * 0.04;
    mouseY += (targetMY - mouseY) * 0.04;
  }
  sphere.style.setProperty('--rotate-y', spinAngle + mouseX);
  sphere.style.setProperty('--rotate-x', 15 + mouseY);
}

function onMouseMove(e) {
  targetMX = (e.clientX / window.innerWidth - 0.5) * 30;
  targetMY = (e.clientY / window.innerHeight - 0.5) * 24;
}

export function initParallax(sphereEl) {
  sphere = sphereEl;
  calcSphereSize();
  window.addEventListener('resize', onResize);
  document.addEventListener('mousemove', onMouseMove);
  register(update);
}

export function pauseParallax() {
  paused = true;
}

export function isPaused() {
  return paused;
}
