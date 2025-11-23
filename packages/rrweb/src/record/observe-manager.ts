import { serializeNodeWithId } from 'rrweb-snapshot';
import type { MutationBufferParam } from '../types';
import { debugLog, makeid } from './custom-helpers';

class ObserveManager {
  static instance: ObserveManager;

  private docsObservers = new WeakSet<Document>();
  private shadowRootsObservers = new WeakSet<ShadowRoot>();

  private docObservers = new WeakMap<Document, VoidFunction>();

  private mutationOptions: Omit<MutationBufferParam, 'doc'> | null;

  constructor() {
    if (ObserveManager.instance) {
      return ObserveManager.instance;
    }

    ObserveManager.instance = this;
  }
  public setMutationOptions(options: Omit<MutationBufferParam, 'doc'>) {
    this.mutationOptions = options;
  }

  public serializeDoc(doc: Document) {
    if (!this.mutationOptions?.mirror) return null;

    const serialized = serializeNodeWithId(doc, {
      ...this.mutationOptions,
      doc,
      skipChild: false,
      maskTextFn: this.mutationOptions?.maskTextFn,
      maskInputFn: this.mutationOptions?.maskInputFn,
    });

    if (!serialized) {
      debugLog('snapshotDoc: no serialized node');
      return null;
    }

    return serialized;
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
