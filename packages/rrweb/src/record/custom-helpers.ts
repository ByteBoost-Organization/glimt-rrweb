declare global {
  interface Window {
    _rrweb_is_debug: boolean;
  }
}

export const isDebug = () => {
  return '_rrweb_is_debug' in window && window._rrweb_is_debug
    ? window._rrweb_is_debug
    : false;
};

export const debugLog = (...args: any[]) => {
  if (!isDebug()) return;
  console.log('[recapt:rrweb]', ...args);
};

const characters =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function makeid(length = 8) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}
