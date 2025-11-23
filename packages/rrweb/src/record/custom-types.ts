import type { eventWithoutTime } from '@rrweb/types';

interface CustomEmitOptions {
  overrideTimestamp?: number;
}

export type WrappedEmit = (
  e: eventWithoutTime,
  isCheckout?: boolean,
  customOpts?: CustomEmitOptions,
) => void;
