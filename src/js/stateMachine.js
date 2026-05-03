const VALID_TRANSITIONS = {
  IDLE: ['BOOTING'],
  BOOTING: ['LOADING'],
  LOADING: ['READY'],
  READY: ['TRANSITIONING'],
  TRANSITIONING: ['SYSTEM_ONLINE'],
  SYSTEM_ONLINE: [],
};

let currentState = 'IDLE';
const listeners = {};

export const STATES = {
  IDLE: 'IDLE',
  BOOTING: 'BOOTING',
  LOADING: 'LOADING',
  READY: 'READY',
  TRANSITIONING: 'TRANSITIONING',
  SYSTEM_ONLINE: 'SYSTEM_ONLINE',
};

export function getState() {
  return currentState;
}

export function is(state) {
  return currentState === state;
}

export function canTransition(to) {
  var allowed = VALID_TRANSITIONS[currentState];
  return allowed && allowed.indexOf(to) !== -1;
}

export function transition(to) {
  if (!canTransition(to)) {
    console.warn(
      '[FSM] Invalid transition: ' + currentState + ' -> ' + to +
      ' (allowed: ' + (VALID_TRANSITIONS[currentState] || []).join(', ') + ')'
    );
    return false;
  }

  var prev = currentState;
  currentState = to;

  // Fire exit listeners
  fire(prev + ':exit');
  // Fire enter listeners
  fire(to + ':enter');
  // Fire generic change
  fire('change', { from: prev, to: to });

  return true;
}

export function onEnter(state, fn) {
  on(state + ':enter', fn);
}

export function onExit(state, fn) {
  on(state + ':exit', fn);
}

export function onChange(fn) {
  on('change', fn);
}

function on(event, fn) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(fn);
}

function fire(event, payload) {
  var fns = listeners[event];
  if (fns) {
    for (var i = 0; i < fns.length; i++) {
      fns[i](payload);
    }
  }
}
