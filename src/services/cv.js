export function cvReady(){
  return new Promise((resolve,reject)=>{
    const start = Date.now();
    (function check(){
      if (window.cv && window.cv.Mat) return resolve(window.cv);
      if (Date.now()-start > 15000) return reject(new Error("OpenCV not loaded"));
      setTimeout(check, 50);
    })();
  });
}

function orderQuadPts(pts){ // [{x,y} x4] -> [tl,tr,br,bl]
  const sum = pts.map(p=>p.x+p.y), diff = pts.map(p=>p.y-p.x);
  const tl = pts[sum.indexOf(Math.min(...sum))];
  const br = pts[sum.indexOf(Math.max(...sum))];
  const tr = pts[diff.indexOf(Math.min(...diff))];
  const bl = pts[diff.indexOf(Math.max(...diff))];
  return [tl,tr,br,bl];
}

export function matFromImage(imgCanvas){
  const cv = window.cv;
  return cv.imread(imgCanvas); // imgCanvas = <canvas> or <img>
}

export function detectQuad(src){
  const cv = window.cv;
  const gray = new cv.Mat(), blur = new cv.Mat(), edges = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
  cv.GaussianBlur(gray, blur, new cv.Size(5,5), 0);
  cv.Canny(blur, edges, 50, 150);

  const contours = new cv.MatVector(), hierarchy = new cv.Mat();
  // Use external contours only for big speedup
  cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  let best=null, bestArea=0;
  for(let i=0;i<contours.size();i++){
    const c = contours.get(i);
    const peri = cv.arcLength(c, true);
    const approx = new cv.Mat();
    cv.approxPolyDP(c, approx, 0.02 * peri, true);
    if(approx.rows === 4){
      const area = cv.contourArea(approx);
      if(area > bestArea){
        bestArea = area;
        const arr=[]; for(let j=0;j<approx.data32S.length;j+=2) arr.push({x:approx.data32S[j], y:approx.data32S[j+1]});
        best = arr;
      }
    }
    approx.delete(); c.delete();
  }
  hierarchy.delete(); contours.delete(); gray.delete(); blur.delete(); edges.delete();

  if(!best){
    best = [{x:0,y:0},{x:src.cols,y:0},{x:src.cols,y:src.rows},{x:0,y:src.rows}];
  }
  // order tl,tr,br,bl
  const sum = best.map(p=>p.x+p.y), diff = best.map(p=>p.y-p.x);
  const tl = best[sum.indexOf(Math.min(...sum))];
  const br = best[sum.indexOf(Math.max(...sum))];
  const tr = best[diff.indexOf(Math.min(...diff))];
  const bl = best[diff.indexOf(Math.max(...diff))];
  return [tl,tr,br,bl];
}


export function warpByQuad(src, quad){
  const cv = window.cv;
  const [tl,tr,br,bl] = quad;
  const widthTop = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const widthBottom = Math.hypot(br.x - bl.x, br.y - bl.y);
  const heightLeft = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const heightRight = Math.hypot(br.x - tr.x, br.y - tr.y);
  const W = Math.max(widthTop, widthBottom) | 0;
  const H = Math.max(heightLeft, heightRight) | 0;

  const srcTri = cv.matFromArray(4,1,cv.CV_32FC2,[tl.x,tl.y, tr.x,tr.y, br.x,br.y, bl.x,bl.y]);
  const dstTri = cv.matFromArray(4,1,cv.CV_32FC2,[0,0, W,0, W,H, 0,H]);
  const M = cv.getPerspectiveTransform(srcTri, dstTri);
  const warped = new cv.Mat();
  cv.warpPerspective(src, warped, M, new cv.Size(W,H), cv.INTER_LINEAR, cv.BORDER_REPLICATE);

  // enhance: adaptive threshold for crisp “scan” look
  const gray = new cv.Mat(); cv.cvtColor(warped, gray, cv.COLOR_RGBA2GRAY);
  const enhanced = new cv.Mat(); 
  cv.adaptiveThreshold(gray, enhanced, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY, 21, 10);

  srcTri.delete(); dstTri.delete(); M.delete(); gray.delete();
  return { warped, enhanced };
}

export function matToCanvas(mat){
  const cv = window.cv;
  const canvas = document.createElement("canvas");
  cv.imshow(canvas, mat); 
  return canvas;
}
