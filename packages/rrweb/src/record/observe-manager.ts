import { debugLog, makeid } from './custom-helpers';

class ObserveManager {
  static instance: ObserveManager;

  private docsObservers = new WeakSet<Document>();
  private shadowRootsObservers = new WeakSet<ShadowRoot>();

  private docObservers = new WeakMap<Document, VoidFunction>();

  constructor() {
    if (ObserveManager.instance) {
      return ObserveManager.instance;
    }

    ObserveManager.instance = this;
  }

  public observeIframe(
    doc: Document,
    init: (id: string) => void,
    cleanup: (id: string) => void,
  ) {
    const current = this.docObservers.get(doc);
    if (current) {
      debugLog(
        doc,
        'iframe is already observed, cleaning up and registering again',
      );
      current();
    }

    const id = makeid();

    init(id);

    this.docObservers.set(doc, () => {
      cleanup(id);
    });
  }

  canRegisterDocObserver(doc: Document) {
    if (!this.docsObservers.has(doc)) {
      this.docsObservers.add(doc);
      return true;
    }
    return false;
  }

  canRegisterShadowRootObserver(shadowRoot: ShadowRoot) {
    if (!this.shadowRootsObservers.has(shadowRoot)) {
      this.shadowRootsObservers.add(shadowRoot);
      return true;
    }
    return false;
  }

  destroy() {
    this.docsObservers = new WeakSet();
    this.shadowRootsObservers = new WeakSet();
    this.docObservers = new WeakMap();
  }
}

export const observeManager = new ObserveManager();
