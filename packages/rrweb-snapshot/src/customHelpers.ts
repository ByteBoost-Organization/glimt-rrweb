export const shouldTryAnonymousFetchingOnCorsError = () => {
  try {
    console.log(
      'window._rrweb_skip_re_fetching_to_suppress_cors_errors',
      //@ts-expect-error
      window._rrweb_skip_re_fetching_to_suppress_cors_errors,
    );
  } catch (err) {}

  return !(
    '_rrweb_skip_re_fetching_to_suppress_cors_errors' in window &&
    window._rrweb_skip_re_fetching_to_suppress_cors_errors === true
  );
};
