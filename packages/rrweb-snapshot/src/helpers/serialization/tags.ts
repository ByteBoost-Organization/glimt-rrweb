import type { attributes, DataURLOptions, mediaAttributes } from '@rrweb/types';
import asyncStylesheetManager from '../../asyncStylesheetManager';
import {
  getInputType,
  is2DCanvasBlank,
  markCssSplits,
  maskInputValue,
  stringifyStylesheet,
} from '../../utils';
import type { MaskInputFn, MaskInputOptions } from '../../types';
import {
  isDebug,
  shouldTryAnonymousFetchingOnCorsError,
} from '../../customHelpers';

export const serializeLinkInline = ({
  attributes,
  doc,
  n,
}: {
  doc: Document;
  attributes: attributes;
  n: HTMLElement;
}) => {
  //TODO: maybe replace this `.styleSheets` with original one
  const styleSheets = Array.from(doc.styleSheets);

  let stylesheet: CSSStyleSheet | null = null;
  for (let i = 0; i < styleSheets.length; i++) {
    if (styleSheets[i].href === (n as HTMLLinkElement).href) {
      stylesheet = styleSheets[i];
      break;
    }
  }

  let cssText: string | null = null;
  if (stylesheet) {
    cssText = stringifyStylesheet(stylesheet);
  }

  if (!cssText) {
    cssText = asyncStylesheetManager.getClonedCssTextIfAvailable(
      (n as HTMLLinkElement).href,
    );
  }

  if (cssText) {
    delete attributes.rel;
    delete attributes.href;
    attributes._cssText = cssText;
  } else {
    //the mutation / full snapshot wants the css, but was unable to get it synchronously
    //which means that this mutation (/full snapshot) will be missing the css.
    //so, we can use this id, later when we process our session data, to grab the css
    //from an custom event which will be dispatched soon (async) with this id
    //and copy it to this mutation (/full snapshot)
    const requestCssId = `css-request-${Math.random().toString(36).slice(2)}`;

    asyncStylesheetManager.requestClone({
      forElement: n as HTMLLinkElement,
      requestCssId,
    });

    attributes._requestCssId = requestCssId;
  }

  return attributes;
};

export const serializeStyleInline = ({
  attributes,
  n,
}: {
  attributes: attributes;
  n: HTMLElement;
}) => {
  let cssText = stringifyStylesheet(
    (n as HTMLStyleElement).sheet as CSSStyleSheet,
  );
  if (cssText) {
    if (n.childNodes.length > 1) {
      cssText = markCssSplits(cssText, n as HTMLStyleElement);
    }
    attributes._cssText = cssText;
  }
  return attributes;
};

export const serializeUserFields = ({
  attributes,
  n,
  tagName,
  maskInputOptions,
  maskInputFn,
}: {
  attributes: attributes;
  n: HTMLElement;
  tagName: string;
  maskInputOptions: MaskInputOptions;
  maskInputFn?: MaskInputFn;
}) => {
  const value = (n as HTMLInputElement | HTMLTextAreaElement).value;
  const checked = (n as HTMLInputElement).checked;
  if (
    attributes.type !== 'radio' &&
    attributes.type !== 'checkbox' &&
    attributes.type !== 'submit' &&
    attributes.type !== 'button' &&
    value
  ) {
    attributes.value = maskInputValue({
      element: n,
      type: getInputType(n),
      tagName,
      value,
      maskInputOptions,
      maskInputFn,
    });
  } else if (checked) {
    attributes.checked = checked;
  }

  return attributes;
};

export const serializeOption = ({
  attributes,
  n,
  maskInputOptions,
}: {
  attributes: attributes;
  n: HTMLElement;
  maskInputOptions: MaskInputOptions;
}) => {
  if ((n as HTMLOptionElement).selected && !maskInputOptions['select']) {
    attributes.selected = true;
  } else {
    // ignore the html attribute (which corresponds to DOM (n as HTMLOptionElement).defaultSelected)
    // if it's already been changed
    delete attributes.selected;
  }
  return attributes;
};

//own helper:
const runIdleCallback = (cb: () => void) => {
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(cb);
  } else {
    setTimeout(cb, 100);
  }
};

export const serializeCanvas = ({
  attributes,
  n,
  dataURLOptions,
  doc,
}: {
  attributes: attributes;
  n: HTMLElement;
  dataURLOptions: DataURLOptions;
  doc: Document;
}) => {
  //new:
  //the old implementation might seem quicker because of these checks "(n as ICanvas).__context === '2d'" & "!('__context' in n)"
  //but they can lead to false positives, resulting in a canvas which supports getContext
  //instead uses multiple ".toDataURL" operations unnecessarily
  //and it's by far the most expensive operation here is ".toDataURL"
  let context: CanvasRenderingContext2D | null =
    'getContext' in n ? (n as HTMLCanvasElement).getContext('2d') : null;

  if (context != null) {
    if (!is2DCanvasBlank(n as HTMLCanvasElement, context)) {
      attributes.rr_dataURL = (n as HTMLCanvasElement).toDataURL(
        dataURLOptions.type,
        dataURLOptions.quality,
      );
    }
  } else if (
    (n as HTMLCanvasElement).width !== 0 &&
    (n as HTMLCanvasElement).height !== 0
  ) {
    const canvasDataURL = (n as HTMLCanvasElement).toDataURL(
      dataURLOptions.type,
      dataURLOptions.quality,
    );

    //we're immediately setting the dataURL (even if blank)
    //this is to prioritize raw performance.
    attributes.rr_dataURL = canvasDataURL;

    //but we will be deleting the dataURL if it's the same as blank canvas
    //so we still save memory by not storing a blank canvas
    runIdleCallback(() => {
      try {
        const blankCanvas = doc.createElement('canvas');
        blankCanvas.width = (n as HTMLCanvasElement).width;
        blankCanvas.height = (n as HTMLCanvasElement).height;
        const blankCanvasDataURL = blankCanvas.toDataURL(
          dataURLOptions.type,
          dataURLOptions.quality,
        );

        if (canvasDataURL === blankCanvasDataURL) {
          delete attributes.rr_dataURL;
        }
      } catch (e) {}
    });
  }

  //org:
  // if ((n as ICanvas).__context === '2d') {
  //   // only record this on 2d canvas
  //   if (!is2DCanvasBlank(n as HTMLCanvasElement)) {
  //     attributes.rr_dataURL = (n as HTMLCanvasElement).toDataURL(
  //       dataURLOptions.type,
  //       dataURLOptions.quality,
  //     );
  //   }
  // } else if (!('__context' in n)) {
  //   // context is unknown, better not call getContext to trigger it
  //   const canvasDataURL = (n as HTMLCanvasElement).toDataURL(
  //     dataURLOptions.type,
  //     dataURLOptions.quality,
  //   );

  //   // create blank canvas of same dimensions
  //   const blankCanvas = doc.createElement('canvas');
  //   blankCanvas.width = (n as HTMLCanvasElement).width;
  //   blankCanvas.height = (n as HTMLCanvasElement).height;
  //   const blankCanvasDataURL = blankCanvas.toDataURL(
  //     dataURLOptions.type,
  //     dataURLOptions.quality,
  //   );

  //   // no need to save dataURL if it's the same as blank canvas
  //   if (canvasDataURL !== blankCanvasDataURL) {
  //     attributes.rr_dataURL = canvasDataURL;
  //   }
  // }

  return attributes;
};

export const serializeImageInline = ({
  attributes,
  n,
  canvasService,
  canvasCtx,
  dataURLOptions,
  doc,
}: {
  attributes: attributes;
  n: HTMLElement;
  canvasService: HTMLCanvasElement | null;
  canvasCtx: CanvasRenderingContext2D | null;
  dataURLOptions: DataURLOptions;
  doc: Document;
}) => {
  if (!canvasService) {
    canvasService = doc.createElement('canvas');
    canvasCtx = canvasService.getContext('2d');
  }

  const image = n as HTMLImageElement;
  let overrideImage: HTMLImageElement | null = null;
  let calls = 0;

  const imageSrc: string =
    (image.currentSrc || image.getAttribute('src') || '<unknown-src>') + '';

  const imageHeight = image.naturalHeight;
  const imageWidth = image.naturalWidth;

  const inlineImageCleanup = () => {
    overrideImage = null;
  };

  const recordInlineImage = () => {
    calls++;
    if (calls > 3) return;

    (overrideImage ?? image).removeEventListener('error', onImageLoadError);

    try {
      canvasService!.width = imageWidth;
      canvasService!.height = imageHeight;

      canvasCtx!.drawImage(image, 0, 0);

      attributes.rr_dataURL = canvasService!.toDataURL(
        dataURLOptions.type,
        dataURLOptions.quality,
      );
    } catch (err) {
      if (image.crossOrigin !== 'anonymous') {
        if (shouldTryAnonymousFetchingOnCorsError()) {
          overrideImage = new Image();

          overrideImage.src = imageSrc;
          overrideImage.crossOrigin = 'anonymous';
          overrideImage.height = imageHeight;
          overrideImage.width = imageWidth;

          if (overrideImage.complete && overrideImage.naturalWidth !== 0) {
            recordInlineImage(); // too early due to image reload
          } else {
            overrideImage.addEventListener('load', recordInlineImage, {
              once: true,
            });
            overrideImage.addEventListener('error', onImageLoadError, {
              once: true,
            });
          }

          return;
        }
      } else {
        if (isDebug())
          console.warn(
            `Cannot inline img src=${imageSrc}! Error: ${err as string}`,
          );
      }
    }

    inlineImageCleanup();
  };

  const onImageLoadError = () => {
    (overrideImage ?? image).removeEventListener('load', recordInlineImage);
    inlineImageCleanup();
  };

  // The image content may not have finished loading yet.
  if (image.complete && image.naturalWidth !== 0) recordInlineImage();
  else {
    image.addEventListener('load', recordInlineImage, { once: true });
    image.addEventListener('error', onImageLoadError, { once: true });
  }

  return attributes;
};

export const serializeMediaElements = ({
  attributes,
  n,
}: {
  attributes: attributes;
  n: HTMLElement;
}) => {
  const mediaAttributes = attributes as mediaAttributes;
  mediaAttributes.rr_mediaState = (n as HTMLMediaElement).paused
    ? 'paused'
    : 'played';
  mediaAttributes.rr_mediaCurrentTime = (n as HTMLMediaElement).currentTime;
  mediaAttributes.rr_mediaPlaybackRate = (n as HTMLMediaElement).playbackRate;
  mediaAttributes.rr_mediaMuted = (n as HTMLMediaElement).muted;
  mediaAttributes.rr_mediaLoop = (n as HTMLMediaElement).loop;
  mediaAttributes.rr_mediaVolume = (n as HTMLMediaElement).volume;
  return attributes;
};
