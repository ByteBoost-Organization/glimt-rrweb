class ObserveManager {
  static instance: ObserveManager;

  private docsObserved = new WeakSet<Document>();
  private shadowRootsObserved = new WeakSet<ShadowRoot>();

  constructor() {
    if (ObserveManager.instance) {
      return ObserveManager.instance;
    }

    ObserveManager.instance = this;
  }

  canObserveDoc(doc: Document) {
    if (this.docsObserved.has(doc)) return false;
    this.docsObserved.add(doc);
    return true;
  }

  canObserveShadow(shadowRoot: ShadowRoot) {
    if (this.shadowRootsObserved.has(shadowRoot)) return false;
    this.shadowRootsObserved.add(shadowRoot);
    return true;
  }

  destroy() {
    this.docsObserved = new WeakSet();
    this.shadowRootsObserved = new WeakSet();
  }
}

export const observeManager = new ObserveManager();
