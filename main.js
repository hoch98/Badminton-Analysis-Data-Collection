import * as THREE from 'three';
import GUI from 'https://cdn.jsdelivr.net/npm/lil-gui@0.21/+esm';

const gui = new GUI({ title: 'Court Tracker' });

// --- 3D Scene Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.order = "YXZ";

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

// --- Video Overlay Setup ---
const video = document.createElement('video');
video.style.position = 'absolute';
video.style.top = '0';
video.style.left = '0';
video.style.width = '100vw';
video.style.height = '100vh';
video.style.opacity = '0.6';
video.style.pointerEvents = 'none';
video.style.objectFit = 'contain';
video.style.zIndex = '10';
video.loop = true;
video.muted = true;
document.body.appendChild(video);

const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = 'video/*';
fileInput.style.display = 'none';
document.body.appendChild(fileInput);

fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    video.src = URL.createObjectURL(file);
    video.play();
  }
});

// --- Flexible Court Setup ---
const courtGeo = new THREE.BufferGeometry();
const courtMat = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
const court = new THREE.LineSegments(courtGeo, courtMat);
scene.add(court);

const court3DCorners = [ new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3() ];
let currentCourtWidth = 6.1;  // Official 6.1m width
let currentCourtLength = 13.4; // Official 13.4m length

const properties = {
  overlayVideo: true,
  uploadVideo: () => fileInput.click(),
  playing: true,
  currentTime: 0,
  
  // Camera State
  camX: 0, camY: 6, camZ: 14,
  camPitch: -0.35, camYaw: 0, camRoll: 0,
  fov: 45, 
  
  // App & Court Settings
  showPins: true,
  courtType: 'Doubles (Outer Lines)',
  stretchTop: 1.0,     
  stretchBottom: 1.0,  
  stretchLength: 1.0,
  resetPins: () => resetAlignment()
};

function updateCourtGeometry() {
    const wTop = currentCourtWidth * properties.stretchTop;
    const wBottom = currentCourtWidth * properties.stretchBottom;
    const l = currentCourtLength * properties.stretchLength;

    court3DCorners[0].set(-wTop / 2, 0, -l / 2); // TL
    court3DCorners[1].set(wTop / 2, 0, -l / 2);  // TR
    court3DCorners[2].set(wBottom / 2, 0, l / 2);   // BR
    court3DCorners[3].set(-wBottom / 2, 0, l / 2);  // BL

    const points = [
        court3DCorners[0], court3DCorners[1], 
        court3DCorners[1], court3DCorners[2], 
        court3DCorners[2], court3DCorners[3], 
        court3DCorners[3], court3DCorners[0], 
    ];
    court.geometry.setFromPoints(points);
}
updateCourtGeometry();

// --- Footstep Tracker State & UI ---
let recordedFootsteps = [];
let footStepState = 'IDLE'; // 'IDLE', 'WAITING_LEFT', 'WAITING_RIGHT', 'READY_CONFIRM'
let pendingLeft = null;
let pendingRight = null;

const footDialog = document.createElement('div');
footDialog.id = 'foot-dialog';
footDialog.style.position = 'absolute';
footDialog.style.top = '20px';
footDialog.style.left = '20px'; // Positioned on the left side
footDialog.style.width = '260px';
footDialog.style.background = 'rgba(15, 15, 25, 0.9)';
footDialog.style.border = '2px solid #1e90ff';
footDialog.style.borderRadius = '8px';
footDialog.style.zIndex = '40';
footDialog.style.padding = '10px';
footDialog.style.color = '#fff';
footDialog.style.fontFamily = 'sans-serif';
footDialog.style.fontSize = '12px';
document.body.appendChild(footDialog);

footDialog.innerHTML = `
    <div style="display: flex; gap: 6px; margin-bottom: 8px;">
        <button id="start-record-btn" style="flex: 1; background: rgb(30, 144, 255); border: none; color: #fff; padding: 6px 8px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 11px;">Record New</button>
        <button id="export-csv-btn" style="background: #2ed573; border: none; color: #fff; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 11px;">Export CSV</button>
    </div>
    <div style="margin-bottom: 8px; font-size: 11px; background: rgba(0,0,0,0.4); padding: 6px; border-radius: 4px;">
        <div><b>L:</b> <span id="preview-left" style="color: #ff4757;">Not set</span></div>
        <div><b>R:</b> <span id="preview-right" style="color: #1e90ff;">Not set</span></div>
    </div>
    <div id="confirm-container" style="display: none; margin-bottom: 8px; gap: 6px;">
        <button id="confirm-btn" style="flex: 1; background: #2ed573; border: none; color: #fff; padding: 6px; border-radius: 4px; cursor: pointer; font-weight: bold;">Confirm</button>
        <button id="cancel-btn" style="background: #ff4757; border: none; color: #fff; padding: 6px 10px; border-radius: 4px; cursor: pointer;">Cancel</button>
    </div>
    <div style="font-weight: bold; margin-bottom: 4px; border-top: 1px solid #333; padding-top: 6px;">List (<span id="list-count">0</span>):</div>
    <div id="recorded-list" style="max-height: 140px; overflow-y: auto; background: rgba(0,0,0,0.5); border-radius: 4px; padding: 4px; font-size: 11px;"></div>
`;

const startRecordBtn = document.getElementById('start-record-btn');
const exportCsvBtn = document.getElementById('export-csv-btn');
const previewLeft = document.getElementById('preview-left');
const previewRight = document.getElementById('preview-right');
const confirmContainer = document.getElementById('confirm-container');
const confirmBtn = document.getElementById('confirm-btn');
const cancelBtn = document.getElementById('cancel-btn');
const recordedListDiv = document.getElementById('recorded-list');
const listCountSpan = document.getElementById('list-count');

function updateFootDialogUI() {
    if (footStepState === 'IDLE') {
        startRecordBtn.style.display = 'block';
        confirmContainer.style.display = 'none';
        previewLeft.innerText = 'Not set';
        previewRight.innerText = 'Not set';
    } else if (footStepState === 'WAITING_LEFT') {
        startRecordBtn.style.display = 'none';
        confirmContainer.style.display = 'none';
        previewLeft.innerText = pendingLeft ? `(${pendingLeft.x.toFixed(2)}, ${pendingLeft.z.toFixed(2)})` : 'Waiting...';
        previewRight.innerText = 'Not set';
    } else if (footStepState === 'WAITING_RIGHT') {
        startRecordBtn.style.display = 'none';
        confirmContainer.style.display = 'none';
        previewLeft.innerText = `(${pendingLeft.x.toFixed(2)}, ${pendingLeft.z.toFixed(2)})`;
        previewRight.innerText = pendingRight ? `(${pendingRight.x.toFixed(2)}, ${pendingRight.z.toFixed(2)})` : 'Waiting...';
    } else if (footStepState === 'READY_CONFIRM') {
        startRecordBtn.style.display = 'none';
        confirmContainer.style.display = 'flex';
        previewLeft.innerText = `(${pendingLeft.x.toFixed(2)}, ${pendingLeft.z.toFixed(2)})`;
        previewRight.innerText = `(${pendingRight.x.toFixed(2)}, ${pendingRight.z.toFixed(2)})`;
    }
}

startRecordBtn.addEventListener('click', () => {
    pendingLeft = null;
    pendingRight = null;
    footStepState = 'WAITING_LEFT';
    updateFootDialogUI();
});

cancelBtn.addEventListener('click', () => {
    pendingLeft = null;
    pendingRight = null;
    footStepState = 'IDLE';
    updateFootDialogUI();
    drawMinimap();
});

confirmBtn.addEventListener('click', () => {
    if (pendingLeft && pendingRight) {
        recordedFootsteps.push({
            time: video.currentTime,
            left: { ...pendingLeft },
            right: { ...pendingRight }
        });
        updateRecordedListUI();
        drawMinimap();
    }
    pendingLeft = null;
    pendingRight = null;
    footStepState = 'IDLE';
    updateFootDialogUI();
    drawMinimap();
});

exportCsvBtn.addEventListener('click', () => {
    if (recordedFootsteps.length === 0) {
        alert('No recorded footsteps to export.');
        return;
    }
    let csvContent = "time,leftfootx,leftfooty,rightfootx,rightfooty\n";
    recordedFootsteps.forEach(step => {
        // Multiply by -1 to invert the sign of the y/z coordinate
        const leftY = -step.left.z;
        const rightY = -step.right.z;

        csvContent += `${step.time.toFixed(3)},${step.left.x.toFixed(3)},${leftY.toFixed(3)},${step.right.x.toFixed(3)},${rightY.toFixed(3)}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `badminton_footsteps_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
});
function updateRecordedListUI() {
    listCountSpan.innerText = recordedFootsteps.length;
    recordedListDiv.innerHTML = '';
    recordedFootsteps.forEach((step, idx) => {
        const item = document.createElement('div');
        item.style.padding = '4px';
        item.style.borderBottom = '1px solid #333';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.innerHTML = `
            <span>#${idx+1} (t:${step.time.toFixed(1)}s)</span>
            <button data-index="${idx}" class="del-step-btn" style="background:#ff4757; border:none; color:#fff; padding:2px 4px; border-radius:2px; cursor:pointer;">X</button>
        `;
        recordedListDiv.appendChild(item);
    });

    document.querySelectorAll('.del-step-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            recordedFootsteps.splice(index, 1);
            updateRecordedListUI();
            drawMinimap();
        });
    });
}

// --- Minimap Setup ---
const minimapWidth = 140;
const minimapHeight = Math.round(minimapWidth * (currentCourtLength / currentCourtWidth)); 

const minimapContainer = document.createElement('div');
minimapContainer.id = 'minimap-container';
minimapContainer.style.position = 'absolute';
minimapContainer.style.bottom = '20px';
minimapContainer.style.right = '20px';
minimapContainer.style.width = `${minimapWidth}px`;
minimapContainer.style.height = `${minimapHeight}px`;
minimapContainer.style.background = 'rgba(0, 0, 0, 0.85)';
minimapContainer.style.border = '2px solid #00ff00';
minimapContainer.style.borderRadius = '8px';
minimapContainer.style.zIndex = '30';
minimapContainer.style.pointerEvents = 'none';
minimapContainer.style.overflow = 'hidden';
document.body.appendChild(minimapContainer);

const miniCanvas = document.createElement('canvas');
miniCanvas.width = minimapWidth;
miniCanvas.height = minimapHeight;
miniCanvas.style.width = '100%';
miniCanvas.style.height = '100%';
miniCanvas.style.display = 'block';
minimapContainer.appendChild(miniCanvas);
const miniCtx = miniCanvas.getContext('2d');

const courtImage = new Image();
courtImage.src = 'court.jpg';
let imageLoaded = false;
courtImage.onload = () => {
    imageLoaded = true;
    drawMinimap();
};

function drawMinimap(cursorX = null, cursorZ = null) {
    miniCtx.clearRect(0, 0, miniCanvas.width, miniCanvas.height);
    
    if (imageLoaded) {
        miniCtx.drawImage(courtImage, 0, 0, miniCanvas.width, miniCanvas.height);
    } else {
        miniCtx.fillStyle = '#111';
        miniCtx.fillRect(0, 0, miniCanvas.width, miniCanvas.height);
        miniCtx.fillStyle = '#00ff00';
        miniCtx.font = '10px monospace';
        miniCtx.textAlign = 'center';
        miniCtx.fillText('Loading court.jpg...', miniCanvas.width / 2, miniCanvas.height / 2);
    }

    const halfW = currentCourtWidth / 2;
    const halfL = currentCourtLength / 2;

    recordedFootsteps.forEach(step => {
        const lx = ((step.left.x + halfW) / (halfW * 2)) * miniCanvas.width;
        const lz = ((step.left.z + halfL) / (halfL * 2)) * miniCanvas.height;
        miniCtx.fillStyle = '#ff4757';
        miniCtx.beginPath();
        miniCtx.arc(lx, lz, 3.5, 0, Math.PI * 2);
        miniCtx.fill();

        const rx = ((step.right.x + halfW) / (halfW * 2)) * miniCanvas.width;
        const rz = ((step.right.z + halfL) / (halfL * 2)) * miniCanvas.height;
        miniCtx.fillStyle = '#1e90ff';
        miniCtx.beginPath();
        miniCtx.arc(rx, rz, 3.5, 0, Math.PI * 2);
        miniCtx.fill();
    });

    if (pendingLeft) {
        const plx = ((pendingLeft.x + halfW) / (halfW * 2)) * miniCanvas.width;
        const plz = ((pendingLeft.z + halfL) / (halfL * 2)) * miniCanvas.height;
        miniCtx.fillStyle = '#ff4757';
        miniCtx.beginPath();
        miniCtx.arc(plx, plz, 5, 0, Math.PI * 2);
        miniCtx.fill();
        miniCtx.strokeStyle = '#fff';
        miniCtx.lineWidth = 1;
        miniCtx.stroke();
    }
    if (pendingRight) {
        const prx = ((pendingRight.x + halfW) / (halfW * 2)) * miniCanvas.width;
        const prz = ((pendingRight.z + halfL) / (halfL * 2)) * miniCanvas.height;
        miniCtx.fillStyle = '#1e90ff';
        miniCtx.beginPath();
        miniCtx.arc(prx, prz, 5, 0, Math.PI * 2);
        miniCtx.fill();
        miniCtx.strokeStyle = '#fff';
        miniCtx.lineWidth = 1;
        miniCtx.stroke();
    }

    if (cursorX !== null && cursorZ !== null) {
        const px = ((cursorX + halfW) / (halfW * 2)) * miniCanvas.width;
        // Shift pz upward by the radius (4px) so the bottom edge/tip of the circle marks the exact point
        const pz = ((cursorZ + halfL) / (halfL * 2)) * miniCanvas.height - 4;

        if (px >= 0 && px <= miniCanvas.width && pz >= -4 && pz <= miniCanvas.height) {
            miniCtx.fillStyle = '#ffffff';
            miniCtx.beginPath();
            miniCtx.arc(px, pz, 4, 0, Math.PI * 2);
            miniCtx.fill();
            miniCtx.strokeStyle = '#000000';
            miniCtx.lineWidth = 1;
            miniCtx.stroke();
        }
    }
}
drawMinimap();

// --- Raycasting & Click Handling ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const courtPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

window.addEventListener('pointermove', (e) => {
    // Offset Y by 12px upwards so the tip of the pointer/cursor matches the raycast hit
    const adjustedY = e.clientY - 2;

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(adjustedY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const target = new THREE.Vector3();
    const intersect = raycaster.ray.intersectPlane(courtPlane, target);

    if (intersect) {
        drawMinimap(intersect.x, intersect.z);
    } else {
        drawMinimap();
    }
});

window.addEventListener('click', (e) => {
    if (footStepState === 'WAITING_LEFT' || footStepState === 'WAITING_RIGHT') {
        if (
            e.target.closest('#foot-dialog') || 
            e.target.closest('#minimap-container') || 
            e.target.closest('.lil-gui') || 
            e.target.tagName === 'INPUT' ||
            handles.includes(e.target)
        ) return;

        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const target = new THREE.Vector3();
        const intersect = raycaster.ray.intersectPlane(courtPlane, target);

        if (intersect) {
            if (footStepState === 'WAITING_LEFT') {
                pendingLeft = { x: intersect.x, z: intersect.z };
                footStepState = 'WAITING_RIGHT';
            } else if (footStepState === 'WAITING_RIGHT') {
                pendingRight = { x: intersect.x, z: intersect.z };
                footStepState = 'READY_CONFIRM';
            }
            updateFootDialogUI();
            drawMinimap();
        }
    }
});

// --- Target Visualizer & Alignment Handles ---
const svgNS = "http://www.w3.org/2000/svg";
const svg = document.createElementNS(svgNS, "svg");
svg.style.position = 'absolute';
svg.style.top = '0';
svg.style.left = '0';
svg.style.width = '100vw';
svg.style.height = '100vh';
svg.style.pointerEvents = 'none';
svg.style.zIndex = '15';
document.body.appendChild(svg);

const polygon = document.createElementNS(svgNS, "polygon");
polygon.setAttribute("fill", "none");
polygon.setAttribute("stroke", "yellow");
polygon.setAttribute("stroke-width", "2");
polygon.setAttribute("stroke-dasharray", "5,5");
svg.appendChild(polygon);

const trackerDots = [];
const trackerContainer = document.createElement('div');
trackerContainer.style.position = 'absolute';
trackerContainer.style.top = '0';
trackerContainer.style.left = '0';
trackerContainer.style.width = '100vw';
trackerContainer.style.height = '100vh';
trackerContainer.style.pointerEvents = 'none';
trackerContainer.style.zIndex = '12';
document.body.appendChild(trackerContainer);

for (let i = 0; i < 4; i++) {
    const dot = document.createElement('div');
    dot.style.position = 'absolute';
    dot.style.width = '10px';
    dot.style.height = '10px';
    dot.style.backgroundColor = '#00ff00';
    dot.style.borderRadius = '50%';
    dot.style.transform = 'translate(-50%, -50%)';
    trackerContainer.appendChild(dot);
    trackerDots.push(dot);
}

const handleColors = ['#ff4757', '#2ed573', '#1e90ff', '#ffa502'];
const handleLabels = ['TL', 'TR', 'BR', 'BL'];
const handles = [];
const handlesContainer = document.createElement('div');
handlesContainer.style.position = 'absolute';
handlesContainer.style.top = '0';
handlesContainer.style.left = '0';
handlesContainer.style.width = '100vw';
handlesContainer.style.height = '100vh';
handlesContainer.style.zIndex = '20';
document.body.appendChild(handlesContainer);

function updatePolygon() {
    const points = handles.map(pin => `${parseFloat(pin.style.left)},${parseFloat(pin.style.top)}`).join(' ');
    polygon.setAttribute("points", points);
}

const defaultScreenPos = [
  { x: 0.35, y: 0.35 }, { x: 0.65, y: 0.35 },
  { x: 0.75, y: 0.75 }, { x: 0.25, y: 0.75 } 
];

defaultScreenPos.forEach((pos, i) => {
  const pin = document.createElement('div');
  pin.innerText = handleLabels[i];
  pin.style.position = 'absolute';
  pin.style.width = '24px';
  pin.style.height = '24px';
  pin.style.borderRadius = '50%';
  pin.style.backgroundColor = handleColors[i];
  pin.style.color = '#fff';
  pin.style.fontWeight = 'bold';
  pin.style.fontSize = '11px';
  pin.style.display = 'flex';
  pin.style.alignItems = 'center';
  pin.style.justifyContent = 'center';
  pin.style.cursor = 'grab';
  pin.style.transform = 'translate(-50%, -50%)';
  pin.style.border = '2px solid white';
  pin.style.boxShadow = '0 0 6px rgba(0,0,0,0.8)';

  handlesContainer.appendChild(pin);
  handles.push(pin);

  let isDragging = false;
  pin.addEventListener('pointerdown', (e) => {
    isDragging = true;
    pin.style.cursor = 'grabbing';
    pin.setPointerCapture(e.pointerId);
  });

  pin.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    pin.style.left = `${e.clientX}px`;
    pin.style.top = `${e.clientY}px`;
    updatePolygon();
    solveCameraFromPins(); 
  });

  pin.addEventListener('pointerup', (e) => {
    isDragging = false;
    pin.style.cursor = 'grab';
    pin.releasePointerCapture(e.pointerId);
  });
});

function resetAlignment() {
    handles.forEach((pin, i) => {
        pin.style.left = `${defaultScreenPos[i].x * window.innerWidth}px`;
        pin.style.top = `${defaultScreenPos[i].y * window.innerHeight}px`;
    });
    updatePolygon();
    
    properties.camX = 0; properties.camY = 6; properties.camZ = 14;
    properties.camPitch = -0.35; properties.camYaw = 0; properties.camRoll = 0;
    properties.fov = 45;
    properties.stretchTop = 1.0; properties.stretchBottom = 1.0; properties.stretchLength = 1.0;
    
    updateTransform();
    updateCourtGeometry();
    solveCameraFromPins();
}

// --- Solver & GUI ---
function solveCameraFromPins() {
  const rect = renderer.domElement.getBoundingClientRect();
  const targetNDCs = handles.map(pin => {
    const x = (parseFloat(pin.style.left) / rect.width) * 2 - 1;
    const y = -((parseFloat(pin.style.top) / rect.height) * 2 - 1);
    return new THREE.Vector2(x, y);
  });

  let p = [ properties.camX, properties.camY, properties.camZ, properties.camPitch, properties.camYaw, properties.camRoll, properties.fov ];
  let steps = [3.0, 3.0, 3.0, 0.15, 0.15, 0.1, 5.0]; 

  function computeError(params) {
    if (params[6] < 5 || params[6] > 140) return Infinity; 
    if (params[1] < 0.1) return Infinity; 
    
    const tempCam = camera.clone();
    tempCam.position.set(params[0], params[1], params[2]); 
    tempCam.rotation.order = "YXZ";
    tempCam.rotation.set(params[3], params[4], params[5]);
    tempCam.fov = params[6]; 
    
    tempCam.updateProjectionMatrix();
    tempCam.updateMatrixWorld(true); 

    let totalError = 0;
    for (let i = 0; i < 4; i++) {
      const viewPos = court3DCorners[i].clone().applyMatrix4(tempCam.matrixWorldInverse);
      if (viewPos.z > 0) totalError += 10000; 

      const proj = court3DCorners[i].clone().project(tempCam);
      const weight = (i < 2) ? 2.5 : 1.0;
      totalError += weight * (Math.pow(proj.x - targetNDCs[i].x, 2) + Math.pow(proj.y - targetNDCs[i].y, 2));
    }
    totalError += Math.pow(params[5], 2) * 0.1; 
    return totalError;
  }

  let bestError = computeError(p);

  for (let iter = 0; iter < 200; iter++) {
    let improved = false;
    for (let i = 0; i < p.length; i++) {
      p[i] += steps[i];
      let errPlus = computeError(p);
      if (errPlus < bestError) { bestError = errPlus; improved = true; continue; }

      p[i] -= 2 * steps[i];
      let errMinus = computeError(p);
      if (errMinus < bestError) {
        bestError = errMinus; improved = true;
        continue;
      }

      p[i] += steps[i]; 
    }
    
    let zStep = steps[2] * 2.0;
    let fovStep = steps[6] * 2.0;
    
    p[2] += zStep; p[6] -= fovStep; 
    let errD1 = computeError(p);
    if (errD1 < bestError) {
        bestError = errD1; improved = true;
    } else {
        p[2] -= 2 * zStep; p[6] += 2 * fovStep; 
        let errD2 = computeError(p);
        if (errD2 < bestError) {
            bestError = errD2; improved = true;
        } else {
            p[2] += zStep; p[6] -= fovStep; 
        }
    }

    if (!improved) {
      for (let i = 0; i < steps.length; i++) steps[i] *= 0.65; 
    }
  }

  properties.camX = p[0]; properties.camY = p[1]; properties.camZ = p[2];
  properties.camPitch = p[3]; properties.camYaw = p[4]; properties.camRoll = p[5];
  properties.fov = p[6];

  updateTransform();
}

const videoFolder = gui.addFolder('1. Video Settings');
videoFolder.add(properties, 'uploadVideo').name('Upload Video');
videoFolder.add(properties, 'overlayVideo').name('Show Overlay').onChange(v => video.style.display = v ? 'block' : 'none');
videoFolder.add(properties, 'playing').name('Play').listen().onChange(v => v ? video.play() : video.pause());

let isScrubbing = false;
const timeController = videoFolder.add(properties, 'currentTime', 0, 1, 0.01).name('Time').listen()
  .onChange(v => { isScrubbing = true; video.currentTime = v; })
  .onFinishChange(() => { isScrubbing = false; });

video.addEventListener('loadedmetadata', () => timeController.max(video.duration));
video.addEventListener('timeupdate', () => { if (!isScrubbing) properties.currentTime = video.currentTime; });
video.addEventListener('play', () => properties.playing = true);
video.addEventListener('pause', () => properties.playing = false);

const alignFolder = gui.addFolder('2. Automatic Court Alignment');
alignFolder.add(properties, 'showPins').name('Show Targeting Pins').onChange(v => {
    handlesContainer.style.display = v ? 'block' : 'none';
    svg.style.display = v ? 'block' : 'none';
    trackerContainer.style.display = v ? 'block' : 'none';
    minimapContainer.style.display = v ? 'block' : 'none';
    footDialog.style.display = v ? 'block' : 'none';
});
alignFolder.add(properties, 'resetPins').name('Reset Pins');
alignFolder.add(properties, 'fov', 5, 140, 1).name('Camera FOV').listen().onChange(() => solveCameraFromPins());

const courtFolder = gui.addFolder('3. Physical Court Deformation');
courtFolder.add(properties, 'courtType', ['Doubles (Outer Lines)', 'Singles (Inner Lines)']).name('Court Type').onChange(v => {
    currentCourtWidth = v.includes('Doubles') ? 6.1 : 5.18;
    updateCourtGeometry();
    solveCameraFromPins();
});
courtFolder.add(properties, 'stretchTop', 0.5, 2.0, 0.01).name('Cheat: Top Width').listen().onChange(() => {
    updateCourtGeometry();
    solveCameraFromPins();
});
courtFolder.add(properties, 'stretchBottom', 0.5, 2.0, 0.01).name('Cheat: Bottom Width').listen().onChange(() => {
    updateCourtGeometry();
    solveCameraFromPins();
});
courtFolder.add(properties, 'stretchLength', 0.5, 2.0, 0.01).name('Cheat: Length').listen().onChange(() => {
    updateCourtGeometry();
    solveCameraFromPins();
});

const camFolder = gui.addFolder('4. Raw Camera Data');
camFolder.add(properties, 'camX', -30, 30).listen().onChange(updateTransform).name('X');
camFolder.add(properties, 'camY', 0, 30).listen().onChange(updateTransform).name('Y');
camFolder.add(properties, 'camZ', -20, 100).listen().onChange(updateTransform).name('Z');
camFolder.add(properties, 'camPitch', -Math.PI, Math.PI).listen().onChange(updateTransform).name('Pitch');
camFolder.add(properties, 'camYaw', -Math.PI, Math.PI).listen().onChange(updateTransform).name('Yaw');
camFolder.add(properties, 'camRoll', -Math.PI, Math.PI).listen().onChange(updateTransform).name('Roll');
camFolder.close();

function updateTransform() {
  camera.position.set(properties.camX, properties.camY, properties.camZ);
  camera.rotation.set(properties.camPitch, properties.camYaw, properties.camRoll);
  camera.fov = properties.fov;
  camera.updateProjectionMatrix();
}

resetAlignment();

function animate() {
  court3DCorners.forEach((corner, i) => {
      const proj = corner.clone().project(camera);
      const x = (proj.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-(proj.y * 0.5) + 0.5) * window.innerHeight;
      trackerDots[i].style.left = `${x}px`;
      trackerDots[i].style.top = `${y}px`;
  });
  
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  solveCameraFromPins();
});