import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const loaded = require("opencv-wasm") as { cv: CvRuntime; cvTranslateError: (cv: CvRuntime, err: unknown) => unknown };

export type CvMat = {
  cols: number;
  rows: number;
  data: Uint8Array;
  data32F: Float32Array;
  data32S: Int32Array;
  data64F: Float64Array;
  delete: () => void;
  clone: () => CvMat;
};

export type CvPoint = { x: number; y: number };
export type CvSize = { width: number; height: number };

type CvRuntime = {
  CV_8UC1: number;
  CV_8UC3: number;
  CV_8UC4: number;
  CV_32FC2: number;
  COLOR_RGBA2GRAY: number;
  COLOR_RGBA2RGB: number;
  COLOR_RGB2HSV: number;
  INTER_LINEAR: number;
  BORDER_CONSTANT: number;
  HOUGH_GRADIENT: number;
  ADAPTIVE_THRESH_GAUSSIAN_C: number;
  THRESH_BINARY: number;
  THRESH_BINARY_INV: number;
  RETR_EXTERNAL: number;
  RETR_LIST: number;
  CHAIN_APPROX_SIMPLE: number;
  Mat: new () => CvMat;
  MatVector: new () => { size: () => number; get: (i: number) => CvMat; delete: () => void };
  Size: new (w: number, h: number) => CvSize;
  Point: new (x: number, y: number) => CvPoint;
  Scalar: new (a: number, b: number, c: number, d?: number) => unknown;
  RotatedRect: { points: (rect: unknown) => CvPoint[] };
  matFromImageData: (image: { data: Uint8ClampedArray; width: number; height: number }) => CvMat;
  matFromArray: (rows: number, cols: number, type: number, data: number[]) => CvMat;
  cvtColor: (src: CvMat, dst: CvMat, code: number) => void;
  GaussianBlur: (src: CvMat, dst: CvMat, ksize: CvSize, sigma: number) => void;
  medianBlur: (src: CvMat, dst: CvMat, ksize: number) => void;
  adaptiveThreshold: (src: CvMat, dst: CvMat, max: number, method: number, type: number, block: number, c: number) => void;
  threshold: (src: CvMat, dst: CvMat, thresh: number, max: number, type: number) => void;
  HoughCircles: (
    src: CvMat,
    dst: CvMat,
    method: number,
    dp: number,
    minDist: number,
    p1: number,
    p2: number,
    minR: number,
    maxR: number,
  ) => void;
  findContours: (src: CvMat, contours: { delete: () => void }, hierarchy: CvMat, mode: number, method: number) => void;
  contourArea: (contour: CvMat) => number;
  arcLength: (contour: CvMat, closed: boolean) => number;
  approxPolyDP: (contour: CvMat, approx: CvMat, epsilon: number, closed: boolean) => void;
  minAreaRect: (contour: CvMat) => unknown;
  boundingRect: (contour: CvMat) => { x: number; y: number; width: number; height: number };
  getPerspectiveTransform: (src: CvMat, dst: CvMat) => CvMat;
  warpPerspective: (src: CvMat, dst: CvMat, m: CvMat, size: CvSize) => void;
  resize: (src: CvMat, dst: CvMat, size: CvSize, fx?: number, fy?: number, interp?: number) => void;
  inRange: (src: CvMat, low: unknown, high: unknown, dst: CvMat) => void;
  bitwise_or: (a: CvMat, b: CvMat, dst: CvMat) => void;
  morphologyEx: (src: CvMat, dst: CvMat, op: number, kernel: CvMat) => void;
  getStructuringElement: (shape: number, ksize: CvSize) => CvMat;
  connectedComponentsWithStats: (src: CvMat, labels: CvMat, stats: CvMat, centroids: CvMat) => number;
  MORPH_RECT: number;
  MORPH_CLOSE: number;
  circle: (img: CvMat, center: CvPoint, r: number, color: unknown, thickness: number) => void;
};

export const cv = loaded.cv;

export function cvError(err: unknown) {
  return loaded.cvTranslateError(cv, err) ?? err;
}

export function matFromRgba(data: Buffer, width: number, height: number) {
  return cv.matFromImageData({
    data: Uint8ClampedArray.from(data),
    width,
    height,
  });
}
