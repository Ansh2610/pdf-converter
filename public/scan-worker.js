/* public/scan-worker.js
   Image-only scanner worker (OpenCV.js)
   - Perspective fix prefers big, document-like quads
   - Runs in a Web Worker so the UI stays responsive
*/
const CV_URL = "https://docs.opencv.org/4.x/opencv.js";
self.importScripts(CV_URL);

async function waitForCV() {
  if (self.cv && cv.Mat) return;
  await new Promise((resolve) => {
    const t = setInterval(() => {
      if (self.cv && cv.Mat) {
        clearInterval(t);
        resolve();
      }
    }, 10);
  });
}

function toImageData(buffer, w, h) {
  return new ImageData(new Uint8ClampedArray(buffer), w, h);
}

function orderQuad(points) {
  const sum = points.map((p) => p.x + p.y);
  const diff = points.map((p) => p.y - p.x);
  const tl = points[sum.indexOf(Math.min(...sum))];
  const br = points[sum.indexOf(Math.max(...sum))];
  const tr = points[diff.indexOf(Math.min(...diff))];
  const bl = points[diff.indexOf(Math.max(...diff))];
  return { tl, tr, br, bl };
}

function warpDocument(src, opts = {}) {
  const {
    minAreaRatio = 0.20,  // ≥20% of image
    aspectMin = 0.5,
    aspectMax = 2.2,
  } = opts;

  let gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  let blur = new cv.Mat();
  cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
  let edges = new cv.Mat();
  cv.Canny(blur, edges, 60, 180);

  let contours = new cv.MatVector();
  let hierarchy = new cv.Mat();
  cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

  const imgArea = src.rows * src.cols;
  let best = null;
  let bestScore = -1;

  for (let i = 0; i < contours.size(); i++) {
    const c = contours.get(i);
    const peri = cv.arcLength(c, true);
    const approx = new cv.Mat();
    cv.approxPolyDP(c, approx, 0.02 * peri, true);

    if (approx.rows === 4) {
      const area = cv.contourArea(approx);
      const areaRatio = area / imgArea;
      if (areaRatio >= minAreaRatio) {
        const pts = [];
        for (let k = 0; k < 4; k++) {
          const p = approx.intPtr(k, 0);
          pts.push({ x: p[0], y: p[1] });
        }
        const { tl, tr, br, bl } = orderQuad(pts);
        const wA = Math.hypot(tr.x - tl.x, tr.y - tl.y);
        const wB = Math.hypot(br.x - bl.x, br.y - bl.y);
        const hA = Math.hypot(bl.x - tl.x, bl.y - tl.y);
        const hB = Math.hypot(br.x - tr.x, br.y - tr.y);

        let maxW = Math.max(wA, wB);
        let maxH = Math.max(hA, hB);
        const aspect = maxW / maxH;

        if (
          Number.isFinite(maxW) && Number.isFinite(maxH) &&
          maxW >= 1 && maxH >= 1 &&
          aspect >= aspectMin && aspect <= aspectMax
        ) {
          const score = areaRatio;
          if (score > bestScore) {
            if (best) best.delete();
            best = approx;
            bestScore = score;
          } else {
            approx.delete();
          }
        } else {
          approx.delete();
        }
      } else {
        approx.delete();
      }
    }
    c.delete();
  }

  let dst = new cv.Mat();
  let fallback = false;

  if (best) {
    const pts = [];
    for (let i = 0; i < 4; i++) {
      const p = best.intPtr(i, 0);
      pts.push({ x: p[0], y: p[1] });
    }
    const { tl, tr, br, bl } = orderQuad(pts);
    const wA = Math.hypot(tr.x - tl.x, tr.y - tl.y);
    const wB = Math.hypot(br.x - bl.x, br.y - bl.y);
    const hA = Math.hypot(bl.x - tl.x, bl.y - tl.y);
    const hB = Math.hypot(br.x - tr.x, br.y - tr.y);
    let maxW = Math.max(1, Math.round(Math.max(wA, wB)));
    let maxH = Math.max(1, Math.round(Math.max(hA, hB)));

    const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
    const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, maxW - 1, 0, maxW - 1, maxH - 1, 0, maxH - 1]);
    const M = cv.getPerspectiveTransform(srcTri, dstTri);
    cv.warpPerspective(src, dst, M, new cv.Size(maxW, maxH), cv.INTER_LINEAR, cv.BORDER_REPLICATE);
    srcTri.delete(); dstTri.delete(); M.delete(); best.delete();
  } else {
    src.copyTo(dst);
    fallback = true;
  }

  gray.delete(); blur.delete(); edges.delete(); contours.delete(); hierarchy.delete();
  return { mat: dst, fallback };
}

self.onmessage = async (e) => {
  const { id, width, height, buffer, mode, doCrop } = e.data || {};
  try {
    await waitForCV();
    if (!width || !height || !buffer) throw new Error("Bad payload: width/height/buffer missing");

    const rgba = toImageData(buffer, width, height);
    const src = cv.matFromImageData(rgba);

    let warped, fallback = false;
    if (doCrop) {
      const res = warpDocument(src, { minAreaRatio: 0.20, aspectMin: 0.5, aspectMax: 2.2 });
      warped = res.mat; fallback = res.fallback;
      src.delete();
    } else {
      warped = new cv.Mat();
      src.copyTo(warped);
      src.delete();
    }

    let out = new cv.Mat();

    switch (mode) {
      case "gray":
        cv.cvtColor(warped, out, cv.COLOR_RGBA2GRAY);
        cv.cvtColor(out, out, cv.COLOR_GRAY2RGBA);
        warped.delete();
        break;
      case "bw": {
        const g = new cv.Mat();
        cv.cvtColor(warped, g, cv.COLOR_RGBA2GRAY);
        cv.adaptiveThreshold(g, g, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 25, 15);
        cv.cvtColor(g, out, cv.COLOR_GRAY2RGBA);
        g.delete(); warped.delete();
        break;
      }
      case "auto": {
        const g = new cv.Mat();
        cv.cvtColor(warped, g, cv.COLOR_RGBA2GRAY);
        const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
        clahe.apply(g, g); clahe.delete();
        cv.cvtColor(g, out, cv.COLOR_GRAY2RGBA);
        g.delete(); warped.delete();
        break;
      }
      case "original":
      default:
        warped.copyTo(out);
        warped.delete();
    }

    const u8 = new Uint8ClampedArray(out.data);
    const result = new Uint8ClampedArray(u8.length);
    result.set(u8);
    const w = out.cols, h = out.rows;
    out.delete();

    postMessage({ id, width: w, height: h, buffer: result.buffer, fallback }, [result.buffer]);
  } catch (err) {
    postMessage({ id, error: err?.message || String(err) });
  }
};
