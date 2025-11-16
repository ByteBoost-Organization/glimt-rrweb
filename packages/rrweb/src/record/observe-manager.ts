import {
  EventType,
  IncrementalSource,
  type eventWithoutTime,
  type serializedNodeWithId,
} from '@rrweb/types';
import { debugLog } from './custom-helpers';
import { serializeNodeWithId } from 'rrweb-snapshot';
import type { MutationBufferParam } from '../types';

class ObserveManager {
  static instance: ObserveManager;

  private docsObservers = new WeakSet<Document>();
  private shadowRootsObservers = new WeakSet<ShadowRoot>();

  private mutationOptions: Omit<MutationBufferParam, 'doc'> | null;

  private emitter:
    | ((e: eventWithoutTime, isCheckout?: boolean) => void)
    | null = null;

  constructor() {
    if (ObserveManager.instance) {
      return ObserveManager.instance;
    }

    ObserveManager.instance = this;
  }

  public setEmitter(
    emitter: ((e: eventWithoutTime, isCheckout?: boolean) => void) | null,
  ) {
    this.emitter = emitter;
  }

  public setMutationOptions(options: Omit<MutationBufferParam, 'doc'>) {
    this.mutationOptions = options;
  }

  private get usable() {
    const result = this.emitter != null;

    if (!result) debugLog('observerManager: emitter is null');

    return result;
  }

  private serializeDoc(doc: Document) {
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

  private emitDoc(serialized: serializedNodeWithId | null) {
    if (!this.emitter || !serialized) return;

    this.emitter({
      type: EventType.FullSnapshot,
      data: {
        node: serialized,
        initialOffset: {
          left: 0,
          top: 0,
        },
      },
    });
  }

  private emitShadowRoot(
    serialized: serializedNodeWithId | null,
    shadowRoot: ShadowRoot,
  ) {
    if (!this.emitter || !serialized || !this.mutationOptions?.mirror) return;

    const hostId = this.mutationOptions.mirror.getId(shadowRoot.host);
    const shadowId = this.mutationOptions.mirror.getId(shadowRoot);

    this.emitter({
      type: EventType.IncrementalSnapshot,
      data: {
        source: IncrementalSource.Mutation,
        adds: [
          {
            parentId: hostId,
            nextId: null,
            node: serialized,
          },
        ],
        removes: [
          {
            id: shadowId,
            parentId: hostId,
          },
        ],
        attributes: [],
        texts: [],
      },
    });
  }

  private serializeAndEmitDoc(doc: Document) {
    const serialized = this.serializeDoc(doc);
    this.emitDoc(serialized);
  }

  private serializeAndEmitShadowRoot(shadowRoot: ShadowRoot) {
    const serialized = this.serializeDoc(shadowRoot.ownerDocument);
    this.emitShadowRoot(serialized, shadowRoot);
  }

  onDocObserver(doc: Document) {
    if (!this.usable) return false;
    if (!this.docsObservers.has(doc)) {
      this.docsObservers.add(doc);
      return true;
    }

    debugLog(
      'onDocObserver: doc already observed, emitting full snapshot for doc',
      doc,
    );

    this.serializeAndEmitDoc(doc);

    return false;
  }

  onShadowRootObserver(shadowRoot: ShadowRoot) {
    if (!this.usable) return false;
    if (!this.shadowRootsObservers.has(shadowRoot)) {
      this.shadowRootsObservers.add(shadowRoot);
      return true;
    }

    debugLog(
      'onShadowRootObserver: shadowRoot already observed, emitting full snapshot for shadowRoot',
      shadowRoot,
    );

    this.serializeAndEmitShadowRoot(shadowRoot);

    return false;
  }

  // canObserveDoc(doc: Document) {
  //   if (!this.usable) return false;
  //   const hasObserver = this.docsObservers.has(doc);
  //   if (!hasObserver) return true;

  //   return false;
  // }

  // canObserveShadowRoot(shadowRoot: ShadowRoot) {
  //   if (!this.usable) return false;

  //   return !this.shadowRootsObserved.has(shadowRoot);
  // }

  // observerAttached(doc: Document, onCleanup: VoidFunction) {
  //   if (!this.usable) return;

  //   debugLog('[doc] attaching observer to doc', doc);
  //   if (this.docsObservers.has(doc)) {
  //     debugLog('[doc] detected existing observer, cleaning up old observer');

  //     const cleanupFn = this.docsObservers.get(doc);
  //     cleanupFn?.();
  //   }

  //   this.docsObservers.set(doc, onCleanup);
  // }

  // observerAttachedToShadow(shadowRoot: ShadowRoot, onCleanup: VoidFunction) {
  //   if (!this.usable) return;

  //   debugLog('[shadow] attaching observer to shadowRoot', shadowRoot);
  //   if (this.shadowRootsObserved.has(shadowRoot)) {
  //     debugLog('[shadow] detected existing observer, cleaning up old observer');
  //     const cleanupFn = this.shadowRootsObserved.get(shadowRoot);
  //     cleanupFn?.();
  //   }

  //   this.shadowRootsObserved.set(shadowRoot, onCleanup);
  // }

  destroy() {
    this.docsObservers = new WeakSet();
    this.shadowRootsObservers = new WeakSet();
  }
}

export const observeManager = new ObserveManager();
