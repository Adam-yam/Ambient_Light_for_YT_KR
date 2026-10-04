import { appendErrorStack, requestIdleCallback, SafeOffscreenCanvas, wrapErrorHandler } from './generic';
import SentryReporter from './errors/sentry-reporter';
import { workerFromCode } from './worker';
const workerCode = function () {
  class ImageHelper {
    imageData;
    channels = 4;
    get width() {
      return this.imageData?.width ?? 0;
    }
    get height() {
      return this.imageData?.height ?? 0;
    }
    getDataOffset(x, y) {
      return (y * this.width + x) * this.channels;
    }
    getPixel(x, y, data, dataOffset, alpha = true) {
      let returnValue = !data;
      if (returnValue) data = new Uint8Array(4);
      if (!dataOffset) dataOffset = 0;
      const offset = this.getDataOffset(x, y);
      if (offset < 0 || offset > (this.imageData?.data?.length ?? 0)) {
        data[dataOffset + 0] = 0;
        data[dataOffset + 1] = 0;
        data[dataOffset + 2] = 0;
        if (alpha) data[dataOffset + 3] = 0;
      } else {
        data[dataOffset + 0] = this.imageData?.data?.[offset];
        data[dataOffset + 1] = this.imageData?.data?.[offset + 1];
        data[dataOffset + 2] = this.imageData?.data?.[offset + 2];
        if (alpha) data[dataOffset + 3] = this.imageData?.data?.[offset + 3];
      }
      if (returnValue) return data;
    }
  }
  let catchedWorkerCreationError = false;
  let canvas;
  let canvasIsCreatedInWorker = false;
  let ctx;
  let globalRunId = 0;
  let globalXOffsetIndex = 0;
  let image = new ImageHelper();
  const scanlinesAmount = 5;
  const postError = ex => {
    if (!catchedWorkerCreationError) {
      catchedWorkerCreationError = true;
      this.postMessage({
        id: -1,
        error: ex
      });
    }
  };
  const sortSizes = averageSize => (a, b) => {
    const aGap = Math.abs(averageSize - a.yIndex);
    const bGap = Math.abs(averageSize - b.yIndex);
    return aGap === bGap ? 0 : aGap > bGap ? 1 : -1;
  };
  const colorChannels = image.channels - 1;
  const colorsLength = 116;
  const averageColorColorsData = new Uint8Array(colorsLength * colorChannels);
  const averageColorsIndexes = new Uint8Array(colorsLength);
  const averageColorsIndexesDiffs = new Uint16Array(colorsLength);
  const averageColorsLength = Math.floor(colorsLength * 0.25);
  const averageColor = new Uint32Array(colorChannels);
  function sortAverageColors(ai, bi) {
    return averageColorsIndexesDiffs[ai] - averageColorsIndexesDiffs[bi];
  }
  function getAverageColor(yAxis) {
    const colors = averageColorColorsData;
    const colorsIndexes = averageColorsIndexes;
    const colorsIndexesDiffs = averageColorsIndexesDiffs;
    for (let i = 0, yMax = image[yAxis], linesY = [2, 4, yMax - 4, yMax - 2], xStep = 16, offset = xStep * 2, xMax = image[yAxis === 'height' ? 'width' : 'height'], colorsOffset = 0; i < linesY.length; i++) {
      for (let x = offset, y = linesY[i]; x <= xMax - offset; x += xStep) {
        if (yAxis === 'height') {
          image.getPixel(x, y, colors, colorsOffset, false);
        } else {
          image.getPixel(y, x, colors, colorsOffset, false);
        }
        colorsOffset += colorChannels;
      }
    }
    for (let i = 0; i < colorsIndexes.length; i++) {
      colorsIndexes[i] = i;
    }
    const shrinkBy = Math.floor(averageColorsLength / 2);
    for (let includedColorsLength = colorsLength; includedColorsLength >= averageColorsLength; includedColorsLength -= shrinkBy) {
      for (let iRGB = 0; iRGB < colorChannels; iRGB++) {
        averageColor[iRGB] = 0;
        for (let i = 0; i < includedColorsLength; i++) {
          const colorsIndex = colorsIndexes[i];
          const colorOffset = colorsIndex * colorChannels + iRGB;
          averageColor[iRGB] += colors[colorOffset];
        }
        averageColor[iRGB] = Math.round(averageColor[iRGB] / includedColorsLength);
      }
      if (includedColorsLength - shrinkBy < averageColorsLength) break;
      for (let i = 0; i < colorsIndexesDiffs.length; i++) {
        const colorsIndex = colorsIndexes[i];
        if (i < includedColorsLength) {
          const pixelOffset = colorsIndex * colorChannels;
          const diff = Math.abs(averageColor[0] - colors[pixelOffset]) + Math.abs(averageColor[1] - colors[pixelOffset + 1]) + Math.abs(averageColor[2] - colors[pixelOffset + 2]);
          colorsIndexesDiffs[colorsIndex] = diff;
        } else {
          colorsIndexesDiffs[colorsIndex] += 1000;
        }
      }
      colorsIndexes.sort(sortAverageColors);
    }
    return Array.from(averageColor);
  }
  function getHueDeviation(a, b) {
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  }
  function getBrightnessDeviation(a, b) {
    return Math.abs(a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  }
  const maxBlackDeviation = {
    hue: 16,
    brightness: 8,
    sum: 20,
    score: 155 * 3 + 155 * 3
  };
  const maxDarkDeviation = {
    hue: 22,
    brightness: 22,
    sum: 36,
    score: 155 * 3 + 155 * 3
  };
  const maxLightDeviation = {
    hue: 32,
    brightness: 64,
    sum: 86,
    score: 255 * 3 + 255 * 3
  };
  function getMaxDeviationLimits(color) {
    const brightness = color[0] + color[1] + color[2];
    return brightness > 500 ? maxLightDeviation : brightness > 20 ? maxDarkDeviation : maxBlackDeviation;
  }
  function isColorWithinMaxDeviation(currentColor, referenceColor) {
    const hueDeviation = getHueDeviation(currentColor, referenceColor);
    const brightnessDeviation = getBrightnessDeviation(currentColor, referenceColor);
    const maxDeviation = getMaxDeviationLimits(referenceColor);
    return hueDeviation <= maxDeviation.hue && brightnessDeviation <= maxDeviation.brightness && hueDeviation + brightnessDeviation <= maxDeviation.sum;
  }
  const enhancedCertainty = true;
  const minDeviationScore = enhancedCertainty ? 0.25 : 0.4;
  const edgePointXRange = globalThis.BARDETECTION_EDGE_RANGE;
  const edgePointYRange = enhancedCertainty ? 8 : 16;
  const edgePointYCenter = 2 / edgePointYRange;
  const easeInOutQuad = x => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  const getCertaintyColorData = new Uint8Array(4);
  const getCertainty = (pointX, pointY, yAxis, yDirection, color) => {
    const x = pointX - (enhancedCertainty ? edgePointXRange : 1);
    const y = pointY - edgePointYRange * 2 * (yDirection === 1 ? edgePointYCenter : 1 - edgePointYCenter);
    const xLength = 1 + (enhancedCertainty ? edgePointXRange * 2 : 0);
    const yLength = 1 + edgePointYRange * 2;
    let score = 0;
    for (let dx = 0; dx < xLength; dx += 2) {
      for (let dy = 0; dy < yLength; dy += 2) {
        const dy2 = yDirection === 1 ? dy : yLength - 1 - dy;
        let iColor = getCertaintyColorData;
        if (yAxis === 'height') {
          image.getPixel(x + dx, y + dy2, iColor);
        } else {
          image.getPixel(y + dy2, x + dx, iColor);
        }
        if (iColor[3] === 0) iColor = color;
        const expectWithinDeviation = dy < Math.floor(1 + edgePointYRange * 2 * edgePointYCenter);
        if (!expectWithinDeviation) {
          const maxDeviation = getMaxDeviationLimits(color);
          const hueDeviation = getHueDeviation(iColor, color);
          const brightnessDeviation = getBrightnessDeviation(iColor, color);
          const deviationScore = Math.max(0, Math.min(1 - minDeviationScore, (hueDeviation + brightnessDeviation) / maxDeviation.score / 0.05));
          score += minDeviationScore + deviationScore;
        } else {
          const within = isColorWithinMaxDeviation(iColor, color);
          if (within) score += 1;
        }
      }
    }
    const length = (1 + (xLength - 1) / 2) * (1 + (yLength - 1) / 2);
    const certainty = (score - length / 2) / (length / 2);
    return easeInOutQuad(certainty);
  };
  const largeStep = 4;
  const ignoreEdge = 2;
  const middleYOffset = 10;
  const minCertainty = 0.65;
  const maxCertaintyChecks = enhancedCertainty ? 3 : 5;
  const sureCertainty = enhancedCertainty ? 0.65 : 0.65;
  const getAverageLineColorRange = 9;
  const getAverageLineColorRangeOffset = (getAverageLineColorRange - 1) / 2;
  const getAverageLineColorData = new Uint8Array(4 * getAverageLineColorRange);
  function getAverageLineColor(x, y, yAxis, iColor) {
    const iColors = getAverageLineColorData;
    const range = getAverageLineColorRange;
    const rangeOffset = getAverageLineColorRangeOffset;
    for (let i = 0; i < range; i++) {
      const x2 = x + (i - rangeOffset) * 2;
      const iColorsOffset = i * 4;
      if (yAxis === 'height') {
        image.getPixel(x2, y, iColors, iColorsOffset);
      } else {
        image.getPixel(y, x2, iColors, iColorsOffset);
      }
    }
    for (let i = 0; i < 4; i++) {
      let sum = 0;
      for (let j = 0; j < range; j++) {
        sum += iColors[j * 4 + i];
      }
      iColor[i] = Math.round(sum / range);
    }
  }
  const detectEdgesColorData = new Uint8Array(4);
  function detectEdges(linesX, color, yAxis) {
    const maxY = image[yAxis];
    const middleY = maxY / 2;
    const topEdges = [];
    const bottomEdges = [];
    const iColor = detectEdgesColorData;
    for (const x of linesX) {
      let step = largeStep;
      let wasDeviating = false;
      let wasUncertain = false;
      let mostCertainEdge;
      let detectedEdges = 0;
      for (let y = ignoreEdge; y < maxY; y += step) {
        if (wasUncertain) {
          wasUncertain = false;
          step = 1;
        }
        getAverageLineColor(x, y, yAxis, iColor);
        const limitNotReached = y < middleY - middleYOffset - 1;
        if (!limitNotReached || detectedEdges > maxCertaintyChecks) {
          if (mostCertainEdge?.certainty > minCertainty) {
            topEdges.find(edge => x === edge.xIndex && mostCertainEdge.yIndex === edge.yIndex).deviates = false;
          } else {
            topEdges.push({
              xIndex: x,
              yIndex: 0,
              certainty: 0,
              deviates: true
            });
          }
          break;
        }
        const isDeviating = !isColorWithinMaxDeviation(iColor, color);
        if (limitNotReached && wasDeviating && !isDeviating) {
          wasDeviating = false;
          continue;
        }
        if (limitNotReached && wasDeviating === isDeviating) continue;
        if (y !== 0 && step === largeStep) {
          y = Math.max(-1, y - 1 * step);
          step = Math.ceil(1, Math.floor(step / 2));
          continue;
        }
        const certainty = getCertainty(x, y / 1, yAxis, 1, color, linesX);
        detectedEdges++;
        if (limitNotReached && certainty < sureCertainty) {
          wasUncertain = true;
          wasDeviating = true;
          if (!(mostCertainEdge?.certainty >= certainty)) {
            mostCertainEdge = {
              yIndex: y,
              certainty
            };
          }
          topEdges.push({
            xIndex: x,
            yIndex: y,
            certainty: certainty,
            deviates: true
          });
          continue;
        }
        topEdges.push({
          xIndex: x,
          yIndex: y,
          certainty
        });
        break;
      }
      step = largeStep;
      wasDeviating = false;
      wasUncertain = false;
      mostCertainEdge = undefined;
      detectedEdges = 0;
      for (let y = maxY - 1 + ignoreEdge; y >= 0; y -= step) {
        if (wasUncertain) {
          wasUncertain = false;
          step = 1;
        }
        getAverageLineColor(x, y, yAxis, iColor);
        const limitNotReached = y > middleY + middleYOffset;
        if (!limitNotReached || detectedEdges > maxCertaintyChecks) {
          if (mostCertainEdge?.certainty > minCertainty) {
            bottomEdges.find(edge => x === edge.xIndex && mostCertainEdge.yIndex === edge.yIndex).deviates = false;
          } else {
            bottomEdges.push({
              xIndex: x,
              yIndex: 0,
              certainty: 0,
              deviates: true
            });
          }
          break;
        }
        const isDeviating = !isColorWithinMaxDeviation(iColor, color);
        if (limitNotReached && wasDeviating && !isDeviating) {
          wasDeviating = false;
          continue;
        }
        if (limitNotReached && wasDeviating === isDeviating) continue;
        if (y !== maxY - 1 && step === largeStep) {
          y = Math.min(maxY - 1, y + step);
          step = Math.ceil(1, Math.floor(step / 2));
          continue;
        }
        const certainty = getCertainty(x, y, yAxis, -1, color, linesX);
        detectedEdges++;
        if (limitNotReached && certainty < sureCertainty) {
          wasUncertain = true;
          wasDeviating = true;
          if (!(mostCertainEdge?.certainty >= certainty)) {
            mostCertainEdge = {
              yIndex: maxY - y,
              certainty
            };
          }
          bottomEdges.push({
            xIndex: x,
            yIndex: maxY - y,
            certainty: certainty,
            deviates: true
          });
          continue;
        }
        bottomEdges.push({
          xIndex: x,
          yIndex: maxY - y,
          certainty
        });
        break;
      }
    }
    return {
      topEdges,
      bottomEdges
    };
  }
  const reduceAverageSize = edges => edges.reduce((sum, edge) => sum + edge.yIndex, 0) / edges.length;
  function getExceedsDeviationLimit(edges, topEdges, bottomEdges, linesX, maxSize, scale, allowedAnomaliesPercentage, allowedUnevenBarsPercentage) {
    if (!topEdges.filter(e => !e.deviates).length || !bottomEdges.filter(e => !e.deviates).length) {
      return true;
    }
    const threshold = linesX.length * 2 * (1 - (allowedAnomaliesPercentage - 10) / 100);
    if (edges.filter(e => !e.deviates).length < threshold) {
      return true;
    }
    while (edges.filter(e => !e.deviates).length > threshold) {
      const nonDeviatingEdges = edges.filter(e => !e.deviates);
      const averageSize = reduceAverageSize(nonDeviatingEdges);
      nonDeviatingEdges.sort(sortSizes(averageSize));
      const deviatingEdge = nonDeviatingEdges[nonDeviatingEdges.length - 1];
      deviatingEdge.deviates = true;
    }
    const maxAllowedSideDeviation = maxSize * (0.008 * scale);
    const nonDeviatingTopEdges = topEdges.filter(e => !e.deviates && !e.deviatesTop);
    const maxTopDeviation = Math.abs(Math.max(...nonDeviatingTopEdges.map(e => e.yIndex)) - Math.min(...nonDeviatingTopEdges.map(e => e.yIndex)));
    const topDeviationIsAllowed = maxTopDeviation <= maxAllowedSideDeviation;
    const nonDeviatingBottomEdges = bottomEdges.filter(e => !e.deviates && !e.deviatesBottom);
    const maxBottomDeviation = Math.abs(Math.max(...nonDeviatingBottomEdges.map(e => e.yIndex)) - Math.min(...nonDeviatingBottomEdges.map(e => e.yIndex)));
    const bottomDeviationIsAllowed = maxBottomDeviation <= maxAllowedSideDeviation;
    if (!topDeviationIsAllowed && !bottomDeviationIsAllowed) {
      return true;
    }
    const averageTopSize = reduceAverageSize(nonDeviatingTopEdges);
    const averageBottomSize = reduceAverageSize(nonDeviatingBottomEdges);
    const sidesDeviation = Math.abs(averageTopSize - averageBottomSize);
    const maxAllowedDeviation = maxSize * (0.003 + allowedUnevenBarsPercentage * 0.0008) * scale;
    const minMaxAllowedSideDeviation = maxSize * (0.016 * scale);
    let maxAllowedSidesDeviation = maxAllowedDeviation;
    if (averageTopSize < minMaxAllowedSideDeviation || averageBottomSize < minMaxAllowedSideDeviation) {
      maxAllowedSidesDeviation = 2;
    } else {}
    if (sidesDeviation > maxAllowedSidesDeviation) {
      return true;
    }
    const nonDeviatingEdgeSizes = edges.filter(e => !e.deviates).map(e => e.yIndex);
    const maxDeviation = Math.abs(Math.max(...nonDeviatingEdgeSizes) - Math.min(...nonDeviatingEdgeSizes));
    if (maxDeviation > maxAllowedDeviation) {
      return true;
    }
  }
  function getPercentage(exceedsDeviationLimit, maxSize, scale, edges, linesX, currentPercentage = 0, offsetPercentage = 0) {
    const lowerSizeThreshold = maxSize * ((currentPercentage - 2) / 100);
    const baseOffsetPercentage = 0.3 * ((1 + scale) / 2);
    let certainty = 1;
    let size;
    if (exceedsDeviationLimit) {
      const uncertainLowerEdges = edges.filter(e => e.certainty > 0.02 && e.yIndex < lowerSizeThreshold);
      if (uncertainLowerEdges.length / (linesX.length * 2) < 0.3) return {
        percentage: undefined,
        certainty: 0
      };
      certainty = uncertainLowerEdges.reduce((sum, edge) => sum + edge.certainty, 0) / uncertainLowerEdges.length;
      const lowestEdge = uncertainLowerEdges.sort((a, b) => a.yIndex - b.yIndex)[0];
      size = lowestEdge.yIndex;
      if (size < 0) {
        size = 0;
      } else {
        size += maxSize * (offsetPercentage / 100);
      }
    } else {
      const sortedEdges = edges.filter(e => !e.deviates).sort(sortSizes(0));
      size = reduceAverageSize(sortedEdges.slice(Math.floor(sortedEdges.length / 2)));
      if (size < 0) {
        size = 0;
      } else {
        size += maxSize * ((baseOffsetPercentage + offsetPercentage) / 100);
      }
    }
    let percentage = Math.round(size / maxSize * 10000) / 100;
    const maxPercentage = 38;
    percentage = Math.min(percentage, maxPercentage);
    return {
      percentage,
      certainty
    };
  }
  const workerDetectBarSizeLinesX = new Uint16Array(5);
  try {
    const workerDetectBarSize = (id, xLength, yAxis, scale, detectColored, offsetPercentage, currentPercentage, allowedAnomaliesPercentage, allowedUnevenBarsPercentage, xOffset) => {
      const partSizeBorderMultiplier = -0.1 + 2 * allowedAnomaliesPercentage / 100;
      const partSize = Math.floor(canvas[xLength] / (scanlinesAmount + partSizeBorderMultiplier * 2));
      const linesX = workerDetectBarSizeLinesX;
      let linesXIndex = 0;
      for (let index = Math.ceil(partSize / 2) - 1 + partSizeBorderMultiplier * partSize; index < canvas[xLength] - partSizeBorderMultiplier * partSize; index += partSize) {
        const xIndex = Math.min(Math.max(0, Math.round(index + Math.round(xOffset * (partSize / 2) - partSize / 4))), canvas[xLength] - 1);
        linesX[linesXIndex] = xIndex;
        linesXIndex++;
      }
      const color = getAverageColor(yAxis);
      if (!detectColored && (color[0] + color[1] + color[2] > 16 || Math.abs(color[0] - color[1]) > 3 || Math.abs(color[1] - color[2]) > 3 || Math.abs(color[2] - color[0]) > 3)) {
        const topEdges = linesX.map(x => ({
          xIndex: x,
          yIndex: 0,
          deviates: true
        }));
        const bottomEdges = linesX.map(x => ({
          xIndex: x,
          yIndex: 0,
          deviates: true
        }));
        return {
          percentage: 0,
          topEdges,
          bottomEdges,
          color
        };
      }
      const {
        topEdges,
        bottomEdges
      } = detectEdges(linesX, color, yAxis);
      const maxSize = image[yAxis];
      const edges = topEdges.concat(bottomEdges);
      const exceedsDeviationLimit = getExceedsDeviationLimit(edges, topEdges, bottomEdges, linesX, maxSize, scale, allowedAnomaliesPercentage, allowedUnevenBarsPercentage);
      const {
        percentage,
        certainty
      } = getPercentage(exceedsDeviationLimit, maxSize, scale, edges, linesX, currentPercentage, offsetPercentage);
      if (!(percentage < currentPercentage) && edges.filter(edge => !edge.deviates).length / (linesX.length * 2) < (100 - allowedAnomaliesPercentage) / 100) {
        for (const edge of topEdges) {
          edge.deviates = true;
        }
        for (const edge of bottomEdges) {
          edge.deviates = true;
        }
        return {
          topEdges,
          bottomEdges,
          color
        };
      }
      return {
        percentage,
        certainty,
        topEdges,
        bottomEdges,
        color
      };
    };
    const createContext = () => {
      ctx = canvas.getContext('2d', {
        desynchronized: true,
        willReadFrequently: true
      });
      ctx.imageSmoothingEnabled = false;
    };
    const createCanvas = (width, height) => {
      canvas = new OffscreenCanvas(width, height);
      canvas.addEventListener('contextlost', () => {
        try {
          canvas.width = 1;
          canvas.height = 1;
        } catch (ex) {
          postError(ex);
        }
      });
      canvas.addEventListener('contextrestored', () => {
        try {
          canvas.width = 1;
          canvas.height = 1;
        } catch (ex) {
          postError(ex);
        }
      });
      canvasIsCreatedInWorker = true;
      createContext();
    };
    this.onmessage = async e => {
      if (e.data === false) {
        this.postMessage(false);
        return;
      }
      const id = e.data.id;
      globalRunId = id;
      try {
        if (e.data.type === 'cancellation') {
          globalXOffsetIndex = 0;
          return;
        }
        if (e.data.type === 'clear') {
          globalXOffsetIndex = 0;
          if (canvas && canvasIsCreatedInWorker && canvas.width !== 1 && canvas.height !== 1) createCanvas(1, 1);
          return;
        }
        const {
          detectColored,
          detectHorizontal,
          detectVertical,
          offsetPercentage,
          currentHorizontalPercentage,
          currentVerticalPercentage,
          allowedAnomaliesPercentage,
          allowedUnevenBarsPercentage,
          canvasInfo,
          xOffsetSize
        } = e.data;
        if (canvasInfo.bitmap) {
          const bitmap = canvasInfo.bitmap;
          if (!canvas) {
            createCanvas(512, 512);
          } else if (canvas.width !== 512 || canvas.height !== 512) {
            canvas.width = 512;
            canvas.height = 512;
            createContext();
          }
          ctx.drawImage(bitmap, 0, 0, 512, 512);
          bitmap.close();
        } else {
          canvas = canvasInfo.canvas;
          canvasIsCreatedInWorker = false;
          ctx = canvasInfo.ctx;
        }
        image.imageData = ctx.getImageData(0, 0, 512, 512);
        globalXOffsetIndex++;
        if (globalXOffsetIndex >= xOffsetSize) globalXOffsetIndex = 0;
        const xOffset = xOffsetSize === 1 ? 0.5 : xOffsetSize === 2 ? globalXOffsetIndex : (Math.ceil(globalXOffsetIndex / 2) + globalXOffsetIndex % 2) / (xOffsetSize - 1);
        let horizontalBarSizeInfo = detectHorizontal ? await workerDetectBarSize(id, 'width', 'height', 1, detectColored, offsetPercentage, currentHorizontalPercentage, allowedAnomaliesPercentage, allowedUnevenBarsPercentage, xOffset) : undefined;
        let verticalBarSizeInfo = detectVertical ? await workerDetectBarSize(id, 'height', 'width', 1, detectColored, offsetPercentage, currentVerticalPercentage, allowedAnomaliesPercentage, allowedUnevenBarsPercentage, xOffset) : undefined;
        if (id !== globalRunId) {
          return;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.postMessage({
          id,
          horizontalBarSizeInfo,
          verticalBarSizeInfo
        });
      } catch (ex) {
        if (id === globalRunId) {
          ctx?.clearRect?.(0, 0, canvas?.width ?? 0, canvas?.height ?? 0);
        }
        this.postMessage({
          id,
          error: ex
        });
      }
    };
  } catch (ex) {
    postError(ex);
  }
};
export default class BarDetection {
  worker;
  runId = 0;
  canvas;
  ctx;
  catchedDetectBarSizeError = false;
  changes = [];
  history = {
    horizontal: [],
    vertical: []
  };
  current = {
    horizontal: undefined,
    vertical: undefined
  };
  constructor(ambientlight) {
    this.ambientlight = ambientlight;
  }
  reset = () => {
    this.clear();
    this.history = {
      horizontal: [],
      vertical: []
    };
    this.current = {
      horizontal: undefined,
      vertical: undefined
    };
    this.changes = [];
  };
  clear = () => {
    this.runId++;
    if (this.worker) {
      this.worker.postMessage({
        id: this.runId,
        type: 'clear'
      });
    }
    this.running = false;
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
  };
  cancel = () => {
    this.runId++;
    if (this.worker) {
      this.worker.postMessage({
        id: this.runId,
        type: 'cancellation'
      });
    }
    this.running = false;
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
  };
  detect = async (buffer, detectColored, offsetPercentage, detectHorizontal, currentHorizontalPercentage, detectVertical, currentVerticalPercentage, ratio, allowedToTransfer, averageHistorySize, allowedAnomaliesPercentage, allowedUnevenBarsPercentage, callback) => {
    if (this.running) {
      return;
    }
    this.runId++;
    const runId = this.runId;
    this.running = true;
    if (!this.worker) {
      this.worker = await workerFromCode(workerCode);
      const stack = new Error().stack;
      this.worker.onmessage = e => {
        if (this.onWorkerMessageListener) {
          return this.onWorkerMessageListener(e);
        }
        if (e.data.id !== -1) {
          return;
        }
        if (e.data.error) {
          appendErrorStack(stack, e.data.error);
          SentryReporter.captureException(e.data.error);
        }
      };
      this.worker.onerror = err => {
        if (!(err instanceof Error)) {
          const details = err;
          err = new Error(`bar-detection-worker.js: ${err.message ?? 'Unknown error'}`);
          err.details = details;
        }
        if (this.onWorkerRejectListener) {
          return this.onWorkerRejectListener(err);
        }
        SentryReporter.captureException(err);
      };
    }
    if (this.history.horizontal.length === 0) currentHorizontalPercentage = undefined;
    if (this.history.vertical.length === 0) currentVerticalPercentage = undefined;
    requestIdleCallback(async function detectIdleCallback() {
      await this.idleHandler(runId, buffer, detectColored, offsetPercentage, detectHorizontal, currentHorizontalPercentage, detectVertical, currentVerticalPercentage, ratio, allowedToTransfer, averageHistorySize, allowedAnomaliesPercentage, allowedUnevenBarsPercentage, callback);
    }.bind(this), {
      timeout: 1
    }, true);
  };
  maxDivergencePercentage = 0.75;
  groupByPercentage = 0.5;
  averagePercentage(barSizeInfo = {}, currentInfo = {}, minPercentage, history, averageHistorySize) {
    let {
      percentage,
      color,
      certainty
    } = barSizeInfo;
    let {
      percentage: currentPercentage,
      color: currentColor
    } = currentInfo;
    let colorChanged = false;
    if (currentColor && color) {
      if (Math.abs(currentColor[0] - color[0]) + Math.abs(currentColor[1] - color[1]) + Math.abs(currentColor[2] - color[2]) > 50) {
        if (percentage === undefined || certainty < 0.8) percentage = 0;
        certainty = 1;
        colorChanged = true;
      }
    }
    if (percentage === undefined) {
      if (!history.length && !currentPercentage) {
        history.push({
          percentage: 0,
          certainty: 1,
          color
        });
        return 0;
      }
      return;
    }
    const detectedPercentage = percentage;
    let percentages = [...history, {
      percentage: detectedPercentage,
      certainty,
      color
    }];
    for (const info of percentages) {
      info.occurrences = percentages.filter(({
        percentage
      }) => Math.abs(info.percentage - percentage) < this.groupByPercentage).length;
    }
    if (!colorChanged) {
      percentage = parseFloat(percentages.reduce((a, b) => a.occurrences > b.occurrences ? a : b).percentage);
      if (percentage !== currentPercentage && (percentages.find(info => info.percentage === percentage)?.occurrences ?? 0) - (percentages.find(info => info.percentage === currentPercentage)?.occurrences ?? 0) <= history.length / 2) {
        percentage = currentPercentage;
      }
    }
    let adjustment = percentage - currentPercentage;
    if (percentage !== 0 && adjustment > -this.maxDivergencePercentage && adjustment <= 0) {
      adjustment = detectedPercentage - currentPercentage;
      if (adjustment > -this.maxDivergencePercentage && adjustment <= 0) {
        percentage = undefined;
      } else {
        percentage = currentPercentage;
      }
    }
    const ignoreRecurringLowerPercentage = percentage < currentPercentage && history.some(({
      percentage: previousPercentage
    }) => Math.abs(currentPercentage - previousPercentage) < this.groupByPercentage) && history.some(({
      percentage: previousPercentage
    }) => Math.abs(detectedPercentage - previousPercentage) < this.groupByPercentage);
    if (colorChanged && percentage !== currentPercentage) {
      const nonDeviatingPercentages = history.filter(info => Math.abs(info.percentage - percentage) < this.maxDivergencePercentage);
      if (history.length !== nonDeviatingPercentages.length) {
        history.splice(0, history.length);
        history.push(...nonDeviatingPercentages);
      }
    }
    history.push({
      percentage: detectedPercentage,
      certainty,
      color
    });
    if (history.length > averageHistorySize) history.splice(0, history.length - averageHistorySize);
    if (ignoreRecurringLowerPercentage) {
      return;
    }
    return percentage < minPercentage ? 0 : percentage;
  }
  idleHandler = async (runId, buffer, detectColored, offsetPercentage, detectHorizontal, currentHorizontalPercentage, detectVertical, currentVerticalPercentage, ratio, allowedToTransfer, averageHistorySize, allowedAnomaliesPercentage, allowedUnevenBarsPercentage, callback) => {
    if (this.runId !== runId) return;
    let canvasInfo;
    let bufferCtx;
    try {
      const start = performance.now();
      if (this.worker.isFallbackWorker || !allowedToTransfer || !buffer.transferToImageBitmap || !buffer.getContext) {
        if (!this.canvas) {
          this.canvas = new SafeOffscreenCanvas(512, 512);
          this.ctx = undefined;
        }
        if (!this.ctx || this.ctx?.isContextLost && this.ctx.isContextLost()) {
          this.ctx = this.canvas.getContext('2d', {
            desynchronized: true
          });
          this.ctx.imageSmoothingEnabled = true;
        }
        this.ctx.drawImage(buffer, 0, 0, this.canvas.width, this.canvas.height);
        canvasInfo = this.worker.isFallbackWorker || !this.canvas.transferToImageBitmap ? {
          canvas: this.canvas,
          ctx: this.ctx
        } : {
          bitmap: this.canvas.transferToImageBitmap()
        };
      } else {
        bufferCtx = buffer.getContext('2d');
        if (bufferCtx instanceof Promise) bufferCtx = await bufferCtx;
        if (bufferCtx && (!bufferCtx.isContextLost || !bufferCtx.isContextLost())) {
          canvasInfo = {
            bitmap: buffer.transferToImageBitmap()
          };
        }
      }
      if (this.runId !== runId) {
        if (canvasInfo?.bitmap) {
          canvasInfo.bitmap.close();
        }
        return;
      }
      if (!canvasInfo) {
        this.running = false;
        return;
      }
      this.ambientlight.stats.updateBarDetectionImage(canvasInfo.bitmap ?? canvasInfo.canvas);
      const stack = new Error().stack;
      const onMessagePromise = new Promise(function onMessagePromise(resolve, reject) {
        this.onWorkerRejectListener = err => reject(err);
        this.onWorkerMessageListener = async e => {
          try {
            if (e.data.id !== this.runId) {
              resolve();
              return;
            }
            if (e.data.error) {
              const error = e.data.error;
              error.stack = error.stack?.replace(/blob:.+?:\/.+?:/g, 'extension://scripts/bar-detection-worker.js:');
              appendErrorStack(stack, error);
              throw error;
            }
            const minPercentage = 1.25 + offsetPercentage;
            const {
              horizontalBarSizeInfo = {},
              verticalBarSizeInfo = {}
            } = e.data;
            const firstDetection = this.history.horizontal.length === 0 && this.history.vertical.length === 0;
            let horizontalPercentage = this.averagePercentage(horizontalBarSizeInfo, this.current.horizontal, minPercentage, this.history.horizontal, averageHistorySize);
            let verticalPercentage = this.averagePercentage(verticalBarSizeInfo, this.current.vertical, minPercentage, this.history.vertical, averageHistorySize);
            let barsFound = horizontalPercentage !== undefined || verticalPercentage !== undefined;
            await this.ambientlight.stats.updateBarDetectionResult(barsFound, horizontalBarSizeInfo, verticalBarSizeInfo, horizontalPercentage ?? currentHorizontalPercentage ?? 0, verticalPercentage ?? currentVerticalPercentage ?? 0);
            if (e.data.id !== this.runId) {
              resolve();
              return;
            }
            if (firstDetection) {
              if (horizontalPercentage === undefined) horizontalPercentage = 0;
              if (verticalPercentage === undefined) verticalPercentage = 0;
              barsFound = true;
            }
            const barsChanged = barsFound && horizontalPercentage !== undefined && horizontalPercentage !== currentHorizontalPercentage || verticalPercentage !== undefined && verticalPercentage !== currentVerticalPercentage;
            const detectedLargeChange = horizontalBarSizeInfo.percentage > minPercentage && Math.abs(horizontalBarSizeInfo.percentage - (currentHorizontalPercentage || 0)) > 0.5 || verticalBarSizeInfo.percentage > minPercentage && Math.abs(verticalBarSizeInfo.percentage - (currentVerticalPercentage || 0)) > 0.5;
            if (barsChanged || detectedLargeChange) {
              const now = performance.now();
              if (barsChanged || this.changes[this.changes.length - 1] < now - 3000) {
                this.changes.push(now);
              }
            }
            if (horizontalPercentage !== undefined) {
              this.current.horizontal = {
                percentage: horizontalPercentage,
                color: horizontalBarSizeInfo.color
              };
            }
            if (verticalPercentage !== undefined) {
              this.current.vertical = {
                percentage: verticalPercentage,
                color: verticalBarSizeInfo.color
              };
            }
            if (barsChanged) {
              callback(horizontalPercentage, verticalPercentage);
            }
            resolve();
          } catch (ex) {
            reject(ex);
          }
        };
      }.bind(this));
      this.worker.postMessage({
        id: runId,
        canvasInfo,
        detectColored,
        offsetPercentage,
        detectHorizontal,
        currentHorizontalPercentage,
        detectVertical,
        currentVerticalPercentage,
        ratio,
        allowedAnomaliesPercentage,
        allowedUnevenBarsPercentage,
        xOffsetSize: averageHistorySize
      }, canvasInfo.bitmap ? [canvasInfo.bitmap] : undefined);
      await onMessagePromise;
      if (this.runId !== runId) return;
      const now = performance.now();
      const duration = now - start;
      this.ambientlight.stats.addBarDetectionDuration(duration);
      if (this.changes.length > 1) {
        const minuteAgo = performance.now() - 60000;
        this.changes = this.changes.filter(change => change > minuteAgo);
      } else if (!this.changes.length) {
        this.changes.push(now - 3001);
      }
      let minThrottle;
      const lastChange = this.changes[this.changes.length - 1];
      if (this.changes.length >= 5) {
        minThrottle = lastChange + 60000 < now ? 1000 : lastChange + 8000 < now ? 500 : 0;
      } else {
        minThrottle = lastChange + 15000 < now ? 1000 : lastChange + 3000 < now ? 500 : 0;
      }
      const throttle = Math.max(minThrottle, Math.min(5000, Math.pow(duration, 1.2) - 250));
      this.ambientlight.stats.updateBarDetectionInfo(throttle, this.changes[this.changes.length - 1]);
      this.timeout = setTimeout(wrapErrorHandler(() => {
        this.timeout = undefined;
        if (this.runId !== runId) return;
        this.running = false;
      }), throttle);
    } catch (ex) {
      const isKnownError = ex.message?.includes('ImageBitmap construction failed') || ex.name === 'DataCloneError';
      if (!isKnownError) {
        ex.details = {
          ...(ex.details ? {
            details: ex.details
          } : {}),
          detectColored,
          offsetPercentage,
          detectHorizontal,
          currentHorizontalPercentage,
          detectVertical,
          currentVerticalPercentage,
          ratio,
          allowedToTransfer,
          buffer: buffer ? {
            width: buffer.width,
            height: buffer.height,
            ctx: buffer.ctx?.constructor?.name,
            type: buffer.constructor?.name
          } : undefined,
          bufferCtx: bufferCtx?.constructor?.name,
          canvasInfo: canvasInfo ? {
            canvas: canvasInfo?.canvas ? {
              width: canvasInfo.canvas.width,
              height: canvasInfo.canvas.height,
              type: canvasInfo.canvas.constructor?.name
            } : undefined,
            ctx: canvasInfo.ctx?.constructor?.name,
            bitmap: canvasInfo?.bitmap ? {
              width: canvasInfo.bitmap.width,
              height: canvasInfo.bitmap.height,
              type: canvasInfo.bitmap.constructor?.name
            } : undefined
          } : undefined
        };
      }
      if (this.runId === runId) {
        if (canvasInfo?.bitmap) {
          canvasInfo.bitmap.close();
        }
        this.running = false;
      }
      if (this.catchedDetectBarSizeError || isKnownError) return;
      this.catchedDetectBarSizeError = true;
      throw ex;
    }
  };
}
