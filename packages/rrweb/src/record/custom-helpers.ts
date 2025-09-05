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
