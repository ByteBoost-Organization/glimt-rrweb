export const shouldTryAnonymousFetchingOnCorsError = () => {
  return !(
    '_rrweb_skip_re_fetching_to_suppress_cors_errors' in window &&
    window._rrweb_skip_re_fetching_to_suppress_cors_errors === true
  );
};

export const isDebug = () => {
  return '_rrweb_is_debug' in window && window._rrweb_is_debug
    ? window._rrweb_is_debug
    : false;
};
