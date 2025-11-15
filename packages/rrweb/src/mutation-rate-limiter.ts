import { debugLog } from './record/custom-helpers';

//Note: this will keep track of all mutationbuffers, which means ALL mutations
//even mutations on different doms and whatnot
class MutationRateLimiter {
  private static instance: MutationRateLimiter;

  private mutTracker: {
    muts: number;
    ts: number;
  };

  private exitMutTracker: {
    muts: number;
    requested: number;
  };

  private interval = 50;
  private exitInterval = 100;
  private mutThreshold = 100;

  private inGlobalStorm = false;

  private currentStormStartedAt = -1;
  private stormTimeLimit = 5000;

  constructor() {
    if (MutationRateLimiter.instance) {
      return MutationRateLimiter.instance;
    }

    MutationRateLimiter.instance = this;

    debugLog(`MutationRateLimiter, init`);
    this.reset();
  }

  private resetTracker() {
    this.mutTracker = {
      muts: 0,
      ts: -1,
    };
  }

  private resetExitTracker() {
    this.exitMutTracker = {
      muts: 0,
      requested: -1,
    };
  }

  private reset() {
    this.resetTracker();
    this.resetExitTracker();
    this.currentStormStartedAt = -1;
  }

  private stormStopped() {
    this.inGlobalStorm = false;
    this.reset();
  }

  private handleStormExit(muts: number) {
    const now = Date.now();

    if (this.exitMutTracker.requested === -1) {
      this.exitMutTracker = {
        requested: now,
        muts: muts,
      };
    } else {
      this.exitMutTracker.muts += muts;

      if (now - this.exitMutTracker.requested > this.exitInterval) {
        if (this.exitMutTracker.muts >= this.mutThreshold) {
          //continue to storm, do not exit
          debugLog(
            `MutationRateLimiter, exit cooldown failed, continuing with storm`,
            {
              mutTracker: this.mutTracker,
              exitMutTracker: this.exitMutTracker,
            },
          );

          this.mutTracker.ts = now;
          this.mutTracker.muts += this.exitMutTracker.muts;

          this.resetExitTracker();

          return true;
        } else {
          //storm is over, exit

          debugLog(`MutationRateLimiter, detected global storm exit.`, {
            mutTracker: this.mutTracker,
            exitMutTracker: this.exitMutTracker,
          });

          this.stormStopped();
          return false;
        }
      }
    }

    return true;
  }

  public isStorming(muts: number) {
    const now = Date.now();

    if (this.inGlobalStorm) {
      if (now - this.currentStormStartedAt > this.stormTimeLimit) {
        debugLog(
          `MutationRateLimiter, storm time limit reached, stopping storm`,
        );
        this.stormStopped();
        return false;
      }

      if (now - this.mutTracker.ts > this.interval) {
        return this.handleStormExit(muts);

        // this.inGlobalStorm = false;
        // debugLog(
        //   `MutationRateLimiter, detected global storm over. Total mutations stormed: ${this.mutTracker.muts}`,
        // );
        // this.reset();
        // return false;
      }

      this.mutTracker.muts += muts;
      this.mutTracker.ts = now;
      return true;
    }

    if (this.mutTracker.ts === -1) {
      this.mutTracker.muts = muts;
    } else {
      if (now - this.mutTracker.ts <= this.interval) {
        this.mutTracker.muts += muts;

        if (this.mutTracker.muts >= this.mutThreshold) {
          this.inGlobalStorm = true;
          debugLog(`MutationRateLimiter, detected global rolling storm`);
          this.currentStormStartedAt = now;
          return true;
        }
      }
    }

    this.mutTracker.ts = now;

    return false;
  }
}

export const mutationRateLimiter = new MutationRateLimiter();
