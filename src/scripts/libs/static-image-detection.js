import { appendErrorStack } from './generic';
import { workerFromCode } from './worker';
const workerCode = function () {
  class SafeOffscreenCanvas {
    constructor(width, height, pixelated) {
      if (typeof OffscreenCanvas !== 'undefined') {
        return new OffscreenCanvas(width, height);
      } else {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        if (pixelated) {
          canvas.style.imageRendering = 'pixelated';
        }
        return canvas;
      }
    }
  }
  let canvas;
  let ctx;
  const getStoryboardPageImageDatas = async (storyboard, page) => {
    const url = storyboard.baseUrl.replace('$M', page);
    const response = await fetch(url);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    if (!canvas) {
      canvas = new SafeOffscreenCanvas(bitmap.width, bitmap.height);
      ctx = canvas.getContext('2d', {
        willReadFrequently: true
      });
    } else if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
    }
    ctx.drawImage(bitmap, 0, 0);
    const imageDatas = [];
    for (let yi = 0; yi < storyboard.y; yi++) {
      for (let xi = 0; xi < storyboard.x; xi++) {
        const i = storyboard.x * storyboard.y * page + storyboard.x * yi + xi;
        if (i >= storyboard.images) break;
        imageDatas.push(ctx.getImageData(xi * storyboard.width, yi * storyboard.height, storyboard.width, storyboard.height));
      }
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return imageDatas;
  };
  const getImageDataDifference = (image1, image2) => {
    const diffs = [];
    for (let i = 0; i < image1.data.length; i += 4) {
      diffs.push(0.2126 * Math.max(0, Math.abs(image1.data[i] / 255 - image2.data[i] / 255) - 0.03) + 0.7152 * Math.max(0, Math.abs(image1.data[i + 1] / 255 - image2.data[i + 1] / 255) - 0.03) + 0.0722 * Math.max(0, Math.abs(image1.data[i + 2] / 255 - image2.data[i + 2] / 255) - 0.03));
    }
    let diffSum = 0;
    for (let diff of diffs) {
      diffSum += diff;
    }
    const diff = diffSum / diffs.length;
    return diff;
  };
  const getStoryboardPageDifferences = imageDatas => {
    const diffs = [];
    for (let i = 1; i < imageDatas.length; i++) {
      diffs.push(getImageDataDifference(imageDatas[i - 1], imageDatas[i]));
    }
    return diffs;
  };
  const getAverageVideoFramesDifference = async storyboard => {
    let pages = (storyboard.images - 1) / (storyboard.x * storyboard.y);
    if (pages > 3) {
      if (pages % Math.floor(pages) >= 0.67) pages -= 1;
      pages = Math.floor(pages);
    } else {
      pages = Math.ceil(pages);
    }
    const secondPage = pages > 3 ? Math.min(1, pages) : 0;
    const middlePage = Math.floor((pages - 1) / 2);
    const secondlastPage = pages > 4 ? pages - 2 : pages - 1;
    const secondPageImageDatasPromise = getStoryboardPageImageDatas(storyboard, secondPage);
    const middlePageImageDatasPromise = middlePage > secondPage && middlePage < secondlastPage ? getStoryboardPageImageDatas(storyboard, middlePage) : [];
    const secondlastPageImageDatasPromise = secondlastPage >= middlePage ? getStoryboardPageImageDatas(storyboard, secondlastPage) : [];
    const secondPageImageDatas = await secondPageImageDatasPromise;
    const middlePageImageDatas = await middlePageImageDatasPromise;
    const secondlastPageImageDatas = await secondlastPageImageDatasPromise;
    const imageDatas = [...secondPageImageDatas, ...middlePageImageDatas, ...secondlastPageImageDatas];
    const differences = getStoryboardPageDifferences(imageDatas);
    const averageDifference = differences.reduce((diffs, diff) => diffs + diff, 0) / differences.length;
    return averageDifference;
  };
  this.onmessage = async e => {
    if (e.data === false) {
      this.postMessage(false);
      return;
    }
    const id = e.data.id;
    const baseUrl = e.data.storyboard.baseUrl;
    try {
      const difference = await getAverageVideoFramesDifference(e.data.storyboard);
      this.postMessage({
        id,
        baseUrl,
        difference
      });
    } catch (ex) {
      this.postMessage({
        id,
        baseUrl,
        error: ex
      });
    }
  };
};
const getStoryboard = format => {
  const [baseUrl, , , sb] = format.split('|').map(i => i?.split('#'));
  if (!baseUrl?.length || !(sb?.length > 7)) return;
  const decodedBaseUrl = `${baseUrl[0].replace('$L', '2').replace('$N', sb[6])}&sigh=${decodeURIComponent(sb[7])}`;
  const width = Math.round(parseInt(sb[0], 10) / 10) * 10;
  const height = Math.round(parseInt(sb[1], 10) / 10) * 10;
  return {
    baseUrl: decodedBaseUrl,
    width,
    height,
    images: parseInt(sb[2], 10),
    x: parseInt(sb[3], 10),
    y: parseInt(sb[4], 10)
  };
};
let worker;
let workerMessageId = 0;
let lastDifference = {
  baseUrl: undefined,
  value: 1
};
let onMessagePromise;
let nextGetIsWaiting = false;
export const getAverageVideoFramesDifference = async format => {
  if (onMessagePromise) {
    nextGetIsWaiting = true;
    while (onMessagePromise) {
      await onMessagePromise;
    }
    nextGetIsWaiting = false;
  }
  const storyboard = await getStoryboard(format);
  if (!storyboard) return;
  const alreadyCalculated = lastDifference.baseUrl === storyboard.baseUrl;
  if (alreadyCalculated) return lastDifference.value;
  if (!worker) {
    worker = await workerFromCode(workerCode);
  }
  workerMessageId++;
  const id = workerMessageId;
  const stack = new Error().stack;
  onMessagePromise = new Promise(function onMessagePromise(resolve, reject) {
    worker.onerror = err => {
      if (!(err instanceof Error)) {
        const details = err;
        err = new Error(`static-image-detection-worker.js: ${err.message ?? 'Unknown error'}`);
        err.details = details;
      }
      reject(err);
    };
    worker.onmessage = function onMessage(e) {
      try {
        if (e.data.id !== workerMessageId) return;
        if (e.data.error) {
          if (e.data.error.stack?.replace) {
            e.data.error.stack = e.data.error.stack?.replace(/blob:.+?:\/.+?:/g, 'extension://scripts/static-image-detection-worker.js:');
          }
          appendErrorStack(stack, e.data.error);
          throw e.data.error;
        }
        lastDifference = {
          baseUrl: e.data.baseUrl,
          value: e.data.difference
        };
        resolve(e.data.difference);
      } catch (ex) {
        reject(ex);
      }
    }.bind(this);
  }.bind(this));
  worker.postMessage({
    id,
    storyboard
  });
  const difference = await onMessagePromise;
  onMessagePromise = undefined;
  return nextGetIsWaiting ? undefined : difference;
};
export const cancelGetAverageVideoFramesDifference = () => {
  workerMessageId++;
};
