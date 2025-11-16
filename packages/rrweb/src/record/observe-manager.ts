import { debugLog } from './custom-helpers';

class ObserveManager {
  static instance: ObserveManager;

  private docsObservers = new WeakMap<Document, VoidFunction>();
  private shadowRootsObserved = new WeakMap<ShadowRoot, VoidFunction>();

  constructor() {
    if (ObserveManager.instance) {
      return ObserveManager.instance;
    }

    ObserveManager.instance = this;
  }

  canObserveDoc(doc: Document) {
    return !this.docsObservers.has(doc);
  }

  canObserveShadowRoot(shadowRoot: ShadowRoot) {
    return !this.shadowRootsObserved.has(shadowRoot);
  }

  observerAttached(doc: Document, onCleanup: VoidFunction) {
    debugLog('[doc] attaching observer to doc', doc);
    if (this.docsObservers.has(doc)) {
      debugLog('[doc] detected existing observer, cleaning up old observer');

      const cleanupFn = this.docsObservers.get(doc);
      cleanupFn?.();
    }

    this.docsObservers.set(doc, onCleanup);
  }

  observerAttachedToShadow(shadowRoot: ShadowRoot, onCleanup: VoidFunction) {
    debugLog('[shadow] attaching observer to shadowRoot', shadowRoot);
    if (this.shadowRootsObserved.has(shadowRoot)) {
      debugLog('[shadow] detected existing observer, cleaning up old observer');
      const cleanupFn = this.shadowRootsObserved.get(shadowRoot);
      cleanupFn?.();
    }

    this.shadowRootsObserved.set(shadowRoot, onCleanup);
  }

  destroy() {
    this.docsObservers = new WeakMap();
    this.shadowRootsObserved = new WeakMap();
  }
}

export const observeManager = new ObserveManager();
