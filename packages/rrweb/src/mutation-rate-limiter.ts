import { debugLog } from './record/custom-helpers';
import type MutationBuffer from './record/mutation';

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

  private debounceTimeout: ReturnType<typeof setTimeout> | null = null;
  private debounceTimeoutMs = 250;

  private handleStormFinishMethods: Record<string, VoidFunction> = {};

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

  private stormStopped(stoppedByBuffer?: string) {
    if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
    this.inGlobalStorm = false;
    this.reset();

    for (const [bufId, method] of Object.entries(
      this.handleStormFinishMethods,
    )) {
      //the buffer which called this method, which in turn stopped the storm,
      //will handle its storm finish automatically. we dont want it to run handleStormFinish twice
      if (bufId === stoppedByBuffer) continue;
      method();
    }

    this.handleStormFinishMethods = {};
  }

  private handleStormExit(muts: number, bufId: string) {
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

          this.stormStopped(bufId);
          return false;
        }
      }
    }

    return true;
  }

  public isInGlobalStorm() {
    return this.inGlobalStorm;
  }

  private doDebounce() {
    if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
    if (!this.inGlobalStorm) return;
    this.debounceTimeout = setTimeout(() => {
      this.debounceTimeout = null;
      debugLog(`MutationRateLimiter, stopping storm because of debounce`);
      this.stormStopped();
    }, this.debounceTimeoutMs);
  }

  public isStorming(muts: number, buffer: MutationBuffer) {
    if (!(buffer.bufId in this.handleStormFinishMethods)) {
      this.handleStormFinishMethods[buffer.bufId] =
        buffer.handleStormFinish.bind(buffer);
    }

    const now = Date.now();

    if (this.inGlobalStorm) {
      this.doDebounce();

      if (now - this.currentStormStartedAt > this.stormTimeLimit) {
        debugLog(
          `MutationRateLimiter, storm time limit reached, stopping storm`,
        );
        this.stormStopped(buffer.bufId);
        return false;
      }

      if (now - this.mutTracker.ts > this.interval)
        return this.handleStormExit(muts, buffer.bufId);

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
          this.doDebounce();
          return true;
        }
      }
    }

    this.mutTracker.ts = now;

    return false;
  }
}

export const mutationRateLimiter = new MutationRateLimiter();
