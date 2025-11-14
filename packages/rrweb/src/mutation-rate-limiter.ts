//Note: this will keep track of all mutationbuffers, which means ALL mutations

import { debugLog } from './record/custom-helpers';

//even mutations on different doms and whatnot
class MutationRateLimiter {
  static instance: MutationRateLimiter;

  mutTracker: {
    muts: number;
    ts: number;
  };

  interval = 50;
  limit = 100;
  inGlobalStorm = false;

  constructor() {
    if (MutationRateLimiter.instance) {
      return MutationRateLimiter.instance;
    }

    MutationRateLimiter.instance = this;

    debugLog(`MutationRateLimiter, init`);
    this.reset();
  }

  reset() {
    this.mutTracker = {
      muts: 0,
      ts: -1,
    };
  }

  public isStorming(muts: number) {
    const now = Date.now();

    if (this.inGlobalStorm) {
      if (now - this.mutTracker.ts > this.interval) {
        this.inGlobalStorm = false;
        debugLog(`MutationRateLimiter, detected global storm over`);
        return false;
      }
      return true;
    }

    if (this.mutTracker.ts === -1) {
      this.mutTracker.muts = muts;
    } else {
      if (now - this.mutTracker.ts <= this.interval) {
        this.mutTracker.muts += muts;

        if (this.mutTracker.muts >= this.limit) {
          this.inGlobalStorm = true;
          this.reset();
          debugLog(`MutationRateLimiter, detected global rolling storm`);
          return true;
        }
      }
    }

    this.mutTracker.ts = now;

    return false;
  }
}

export const mutationRateLimiter = new MutationRateLimiter();
