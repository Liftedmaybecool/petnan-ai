/**
 * PetnanAI Procedural Media Synthesis Core
 * Generates highly realistic, prompt-adhering downloadable Images, Videos, and Audio.
 * Communicates with the Express backend to get customized Gemini AI vector and synth structures,
 * falling back to detailed local procedural generators if offline.
 */

// Helper to convert an AudioBuffer to a valid downloadable 16-bit PCM WAV Blob
export function bufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // 1 = Raw PCM (uncompressed)
  const bitDepth = 16;
  
  const resultLength = buffer.length * numOfChan * 2 + 44;
  const bufferArr = new ArrayBuffer(resultLength);
  const view = new DataView(bufferArr);
  
  let pos = 0;
  
  const setUint16 = (data: number) => {
    view.setUint16(pos, data, true);
    pos += 2;
  };
  
  const setUint32 = (data: number) => {
    view.setUint32(pos, data, true);
    pos += 4;
  };
  
  // RIFF Header
  setUint32(0x46464952);                         // "RIFF"
  setUint32(resultLength - 8);                   // file size - 8
  setUint32(0x45564157);                         // "WAVE"
  
  // Format chunk
  setUint32(0x20746d66);                         // "fmt "
  setUint32(16);                                 // chunk size = 16
  setUint16(format);                             // PCM
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * numOfChan * (bitDepth / 8)); // byte rate
  setUint16(numOfChan * (bitDepth / 8));         // block align
  setUint16(bitDepth);                           // 16-bit
  
  // Data chunk
  setUint32(0x61746164);                         // "data"
  setUint32(buffer.length * numOfChan * 2);      // chunk size
  
  // Interleave and write audio samples (scaled to 16-bit signed integer PCM)
  const channels: Float32Array[] = [];
  for (let i = 0; i < numOfChan; i++) {
    channels.push(buffer.getChannelData(i));
  }
  
  let offset = 0;
  while (pos < resultLength) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = channels[i][offset];
      // Clamp sample to [-1, 1]
      sample = Math.max(-1, Math.min(1, sample));
      // Scale to 16-bit signed PCM
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(pos, intSample, true);
      pos += 2;
    }
    offset++;
  }
  
  return new Blob([bufferArr], { type: "audio/wav" });
}

// Prompt analyzer to extract offline fallback theme/style
export interface PromptStyle {
  theme: "cosmic" | "cyberpunk" | "math" | "default";
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bpm: number;
}

export function analyzePrompt(prompt: string): PromptStyle {
  const p = prompt.toLowerCase();
  
  if (p.includes("space") || p.includes("cosmic") || p.includes("galaxy") || p.includes("stars") || p.includes("astronomy") || p.includes("planet") || p.includes("nebula")) {
    return {
      theme: "cosmic",
      primaryColor: "#a855f7", // purple
      secondaryColor: "#38bdf8", // sky-400
      accentColor: "#facc15", // yellow-400
      bpm: 72
    };
  }
  
  if (p.includes("cyberpunk") || p.includes("tech") || p.includes("grid") || p.includes("matrix") || p.includes("digital") || p.includes("computer") || p.includes("neon") || p.includes("futuristic")) {
    return {
      theme: "cyberpunk",
      primaryColor: "#34d399", // emerald-400
      secondaryColor: "#a855f7", // purple-500
      accentColor: "#38bdf8", // sky-400
      bpm: 125
    };
  }
  
  if (p.includes("fractal") || p.includes("math") || p.includes("fibonacci") || p.includes("geometry") || p.includes("chaos") || p.includes("symmetry") || p.includes("mandala")) {
    return {
      theme: "math",
      primaryColor: "#facc15", // yellow-400
      secondaryColor: "#34d399", // emerald-400
      accentColor: "#a855f7", // purple-500
      bpm: 95
    };
  }
  
  return {
    theme: "default",
    primaryColor: "#38bdf8", // sky-400
    secondaryColor: "#34d399", // emerald-400
    accentColor: "#a855f7", // purple-500
    bpm: 85
  };
}

// Draw shape operation on Canvas Context
function drawShape(ctx: CanvasRenderingContext2D, shape: any) {
  ctx.save();
  
  if (shape.alpha !== undefined) {
    ctx.globalAlpha = shape.alpha;
  } else {
    ctx.globalAlpha = 1.0;
  }
  
  if (shape.shadowColor) {
    ctx.shadowColor = shape.shadowColor;
    ctx.shadowBlur = shape.shadowBlur !== undefined ? shape.shadowBlur : 10;
  } else {
    ctx.shadowBlur = 0;
  }
  
  const x = shape.x ?? 500;
  const y = shape.y ?? 500;
  ctx.translate(x, y);
  
  if (shape.rotation) {
    ctx.rotate((shape.rotation * Math.PI) / 180);
  }
  
  ctx.fillStyle = shape.color || "rgba(255,255,255,0.5)";
  ctx.strokeStyle = shape.strokeColor || "transparent";
  ctx.lineWidth = shape.strokeWidth !== undefined ? shape.strokeWidth : 1;
  
  const type = shape.type;
  if (type === "circle") {
    const size = shape.size ?? 50;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();
    if (shape.strokeColor && shape.strokeColor !== "transparent") ctx.stroke();
  } else if (type === "ellipse") {
    const w = shape.width ?? 100;
    const h = shape.height ?? 50;
    ctx.beginPath();
    ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
    if (shape.strokeColor && shape.strokeColor !== "transparent") ctx.stroke();
  } else if (type === "rect") {
    const w = shape.width ?? 100;
    const h = shape.height ?? 100;
    ctx.beginPath();
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.fill();
    if (shape.strokeColor && shape.strokeColor !== "transparent") ctx.stroke();
  } else if (type === "line") {
    const points = shape.points || [{ x: -50, y: 0 }, { x: 50, y: 0 }];
    if (points.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
    }
  } else if (type === "path") {
    const points = shape.points || [];
    if (points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.closePath();
      ctx.fill();
      if (shape.strokeColor && shape.strokeColor !== "transparent") ctx.stroke();
    }
  } else if (type === "text") {
    ctx.font = shape.font || "bold 24px Inter";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(shape.text || "", 0, 0);
  } else if (type === "star") {
    const sides = shape.sides ?? 5;
    const outerRadius = shape.size ?? 50;
    const innerRadius = outerRadius * 0.4;
    ctx.beginPath();
    for (let i = 0; i < 2 * sides; i++) {
      const angle = (i * Math.PI) / sides;
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.fill();
    if (shape.strokeColor && shape.strokeColor !== "transparent") ctx.stroke();
  } else if (type === "glowing_orb") {
    const size = shape.size ?? 100;
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.2, shape.color || "rgba(255, 255, 255, 0.8)");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "wave") {
    const w = shape.width ?? 1000;
    const amp = shape.amplitude ?? 30;
    const freq = shape.frequency ?? 0.01;
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    for (let px = -w / 2; px <= w / 2; px += 10) {
      const py = Math.sin(px * freq) * amp;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  } else if (type === "grid") {
    const w = shape.width ?? 500;
    const h = shape.height ?? 500;
    const spacing = shape.size ?? 50;
    ctx.beginPath();
    for (let cx = -w / 2; cx <= w / 2; cx += spacing) {
      ctx.moveTo(cx, -h / 2);
      ctx.lineTo(cx, h / 2);
    }
    for (let cy = -h / 2; cy <= h / 2; cy += spacing) {
      ctx.moveTo(-w / 2, cy);
      ctx.lineTo(w / 2, cy);
    }
    ctx.stroke();
  }
  
  ctx.restore();
}

/**
 * 1. PROCEDURAL IMAGE GENERATION
 * Connects with server-side Gemini to construct customized vector designs,
 * rendering on temporary canvas.
 */
export async function generateProceduralImage(prompt: string): Promise<string> {
  let config: any = null;
  try {
    const res = await fetch("/api/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "image", prompt })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.config) {
        config = data.config;
      }
    }
  } catch (err) {
    console.warn("Using offline fallback for image synthesis", err);
  }

  if (!config) {
    return generateOfflineImageFallback(prompt);
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 1000;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Draw Background
  const bg = config.background || { type: "solid", colors: ["#020617"] };
  if (bg.type === "linear" && bg.colors && bg.colors.length >= 2) {
    const angleRad = ((bg.angle || 45) * Math.PI) / 180;
    const x1 = 500 - Math.cos(angleRad) * 500;
    const y1 = 500 - Math.sin(angleRad) * 500;
    const x2 = 500 + Math.cos(angleRad) * 500;
    const y2 = 500 + Math.sin(angleRad) * 500;
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    bg.colors.forEach((c: string, idx: number) => {
      grad.addColorStop(idx / (bg.colors.length - 1), c);
    });
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1000, 1000);
  } else if (bg.type === "radial" && bg.colors && bg.colors.length >= 2) {
    const grad = ctx.createRadialGradient(500, 500, 50, 500, 500, 707);
    bg.colors.forEach((c: string, idx: number) => {
      grad.addColorStop(idx / (bg.colors.length - 1), c);
    });
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1000, 1000);
  } else {
    ctx.fillStyle = (bg.colors && bg.colors[0]) || "#020617";
    ctx.fillRect(0, 0, 1000, 1000);
  }

  // Draw vector elements
  const shapes = config.shapes || [];
  shapes.forEach((shape: any) => {
    drawShape(ctx, shape);
  });

  // Stamp Petnan details
  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.font = "bold 13px 'Fira Code', 'JetBrains Mono', monospace";
  ctx.fillText("PETNAN_AI // NEURAL_MEDIA_SYNTHESIS", 50, 910);
  ctx.font = "11px 'Fira Code', 'JetBrains Mono', monospace";
  ctx.fillText(`PROMPT_HASH: "${prompt.slice(0, 50)}${prompt.length > 50 ? "..." : ""}"`, 50, 930);
  ctx.fillText(`SYSTEM: GEMINI-3.5-FLASH // CUSTOM VECTOR LAYERS`, 50, 950);

  return canvas.toDataURL("image/png");
}

function generateOfflineImageFallback(prompt: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 1000;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  
  const style = analyzePrompt(prompt);
  
  // Background
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, 1000, 1000);
  
  const radialGlow = ctx.createRadialGradient(500, 500, 50, 500, 500, 600);
  radialGlow.addColorStop(0, style.primaryColor + "15");
  radialGlow.addColorStop(0.5, style.secondaryColor + "0a");
  radialGlow.addColorStop(1, "#02061700");
  ctx.fillStyle = radialGlow;
  ctx.fillRect(0, 0, 1000, 1000);
  
  if (style.theme === "cosmic") {
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * 1000;
      const y = Math.random() * 1000;
      const size = Math.random() * 2 + 0.5;
      const alpha = Math.random() * 0.8 + 0.2;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fillRect(x, y, size, size);
    }
    
    ctx.lineWidth = 1.5;
    for (let j = 0; j < 8; j++) {
      ctx.beginPath();
      ctx.strokeStyle = j % 2 === 0 ? style.primaryColor + "33" : style.secondaryColor + "33";
      ctx.shadowColor = j % 2 === 0 ? style.primaryColor : style.secondaryColor;
      ctx.shadowBlur = 15;
      ctx.moveTo(0, 300 + j * 60);
      ctx.bezierCurveTo(250, 100 + j * 120, 750, 900 - j * 120, 1000, 700 - j * 60);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    
    ctx.strokeStyle = style.accentColor + "44";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.ellipse(500, 500, 320, 120, Math.PI / 6, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.ellipse(500, 500, 420, 160, -Math.PI / 8, 0, Math.PI * 2);
    ctx.stroke();
    
    const centerGlow = ctx.createRadialGradient(500, 500, 0, 500, 500, 180);
    centerGlow.addColorStop(0, "#ffffff");
    centerGlow.addColorStop(0.15, style.accentColor + "aa");
    centerGlow.addColorStop(0.5, style.primaryColor + "44");
    centerGlow.addColorStop(1, "transparent");
    ctx.fillStyle = centerGlow;
    ctx.beginPath();
    ctx.arc(500, 500, 180, 0, Math.PI * 2);
    ctx.fill();
    
  } else if (style.theme === "cyberpunk") {
    ctx.strokeStyle = style.primaryColor + "22";
    ctx.lineWidth = 1;
    const gridCols = 30;
    for (let i = 0; i <= gridCols; i++) {
      const xRatio = i / gridCols;
      ctx.beginPath();
      ctx.moveTo(xRatio * 1000, 600);
      ctx.lineTo((xRatio - 0.5) * 2000 + 500, 1000);
      ctx.stroke();
    }
    for (let h = 600; h <= 1000; h += 25) {
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(1000, h);
      ctx.stroke();
    }
    
    ctx.strokeStyle = style.secondaryColor + "66";
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = style.secondaryColor;
    
    const nodes = [
      {x: 200, y: 200}, {x: 400, y: 150}, {x: 500, y: 350},
      {x: 800, y: 250}, {x: 750, y: 500}, {x: 300, y: 450}
    ];
    
    ctx.beginPath();
    ctx.moveTo(nodes[0].x, nodes[0].y);
    ctx.lineTo(nodes[1].x, nodes[1].y);
    ctx.lineTo(nodes[2].x, nodes[2].y);
    ctx.lineTo(nodes[4].x, nodes[4].y);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(nodes[3].x, nodes[3].y);
    ctx.lineTo(nodes[2].x, nodes[2].y);
    ctx.lineTo(nodes[5].x, nodes[5].y);
    ctx.stroke();
    
    nodes.forEach(node => {
      ctx.fillStyle = style.accentColor;
      ctx.beginPath();
      ctx.arc(node.x, node.y, 6, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(node.x, node.y, 12, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.shadowBlur = 0;
    
    ctx.fillStyle = style.primaryColor + "77";
    ctx.font = "bold 13px Courier New";
    for (let col = 0; col < 40; col++) {
      const charX = col * 25;
      const startY = Math.random() * 500;
      for (let row = 0; row < 12; row++) {
        const charY = startY + row * 18;
        if (charY < 600) {
          const randChar = String.fromCharCode(33 + Math.floor(Math.random() * 90));
          ctx.fillStyle = row === 11 ? "#ffffff" : style.primaryColor + Math.floor((row / 12) * 255).toString(16).padStart(2, 'f');
          ctx.fillText(randChar, charX, charY);
        }
      }
    }
    
  } else if (style.theme === "math") {
    ctx.strokeStyle = style.primaryColor + "44";
    ctx.shadowBlur = 8;
    ctx.shadowColor = style.primaryColor;
    ctx.lineWidth = 1.5;
    
    const numRays = 24;
    for (let r = 0; r < numRays; r++) {
      const angle = (r * Math.PI * 2) / numRays;
      ctx.save();
      ctx.translate(500, 500);
      ctx.rotate(angle);
      
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(150, 50);
      ctx.lineTo(300, 0);
      ctx.lineTo(150, -50);
      ctx.closePath();
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(150, 0, 75, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.strokeStyle = style.secondaryColor + "33";
      ctx.beginPath();
      ctx.arc(300, 0, 45, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.restore();
    }
    
    ctx.shadowBlur = 0;
    ctx.strokeStyle = style.accentColor + "aa";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let radius = 1;
    for (let theta = 0; theta < Math.PI * 12; theta += 0.1) {
      radius = Math.pow(1.15, theta);
      const x = 500 + radius * Math.cos(theta);
      const y = 500 + radius * Math.sin(theta);
      if (theta === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
  } else {
    ctx.strokeStyle = style.primaryColor + "55";
    ctx.lineWidth = 2;
    for (let wave = 0; wave < 15; wave++) {
      ctx.beginPath();
      ctx.strokeStyle = wave % 3 === 0 ? style.primaryColor + "44" : wave % 3 === 1 ? style.secondaryColor + "44" : style.accentColor + "44";
      ctx.moveTo(0, 500);
      for (let x = 0; x <= 1000; x += 10) {
        const sineVal = Math.sin(x * 0.005 + wave * 0.3) * 150;
        const cosineVal = Math.cos(x * 0.002 + wave * 0.1) * 80;
        ctx.lineTo(x, 500 + sineVal + cosineVal);
      }
      ctx.stroke();
    }
    
    ctx.strokeStyle = style.accentColor + "aa";
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 12;
    ctx.shadowColor = style.accentColor;
    
    const sides = 8;
    const size = 180;
    ctx.beginPath();
    for (let s = 0; s <= sides; s++) {
      const angle = (s * Math.PI * 2) / sides;
      const x = 500 + size * Math.cos(angle);
      const y = 500 + size * Math.sin(angle);
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  
  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.font = "bold 13px 'Fira Code', 'JetBrains Mono', monospace";
  ctx.fillText("PETNAN_AI // MULTI_MEDIA_SYNTHESIS", 50, 910);
  ctx.font = "11px 'Fira Code', 'JetBrains Mono', monospace";
  ctx.fillText(`PROMPT_HASH: "${prompt.slice(0, 50)}${prompt.length > 50 ? "..." : ""}"`, 50, 930);
  ctx.fillText(`THEME: ${style.theme.toUpperCase()} // RESOLUTION: 1000X1000px`, 50, 950);
  
  return canvas.toDataURL("image/png");
}

/**
 * 2. PROCEDURAL MUSIC SYNTHESIS
 * Communicates with Gemini to receive beautiful musical compositions, 
 * synthesising them inside Web Audio OfflineAudioContext.
 */
export async function generateProceduralMusic(prompt: string, onProgress: (p: number) => void): Promise<string> {
  let config: any = null;
  try {
    const res = await fetch("/api/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "music", prompt })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.config) {
        config = data.config;
      }
    }
  } catch (err) {
    console.warn("Using offline fallback for music synthesis", err);
  }

  if (!config) {
    return generateOfflineMusicFallback(prompt, onProgress);
  }

  return new Promise((resolve, reject) => {
    try {
      const duration = 10; // seconds
      const sampleRate = 44100;
      onProgress(15);

      const ctx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);
      
      const tempoBPM = config.tempoBPM || 90;
      const basePitch = config.basePitch || 48;
      const scale = config.scale || [0, 2, 4, 5, 7, 9, 11];
      const chordProgression = config.chordProgression || [0, 3, 7, 5];
      const leadSynthType = config.leadSynthType || "triangle";
      const padSynthType = config.padSynthType || "sine";
      const bassSynthType = config.bassSynthType || "sine";
      const filterFreq = config.filterFreq || 1200;

      const midiToFreq = (midi: number) => Math.pow(2, (midi - 69) / 12) * 440;
      const getNoteFreq = (index: number, chordOffset: number = 0) => {
        const len = scale.length;
        const octaves = Math.floor(index / len);
        let noteIndex = index % len;
        if (noteIndex < 0) {
          noteIndex += len;
        }
        const scaleOffset = scale[noteIndex];
        return midiToFreq(basePitch + chordOffset + scaleOffset + octaves * 12);
      };

      const leadVolume = ctx.createGain();
      leadVolume.gain.setValueAtTime(0.2, 0);

      const bassVolume = ctx.createGain();
      bassVolume.gain.setValueAtTime(0.35, 0);

      const padVolume = ctx.createGain();
      padVolume.gain.setValueAtTime(0.18, 0);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(filterFreq, 0);

      onProgress(40);

      const melody = config.melody || [];
      const chordDurationBeats = 4;
      const beatDuration = 60 / tempoBPM;

      melody.forEach((note: any, idx: number) => {
        const beatTime = note.time ?? (idx * 0.5);
        const startTime = beatTime * beatDuration;
        const noteDuration = (note.duration ?? 0.5) * beatDuration;
        const chordIndex = Math.floor(beatTime / chordDurationBeats) % 4;
        const currentChordOffset = chordProgression[chordIndex] || 0;

        if (startTime >= duration) return;

        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        noteGain.gain.setValueAtTime(0, startTime);
        
        const freq = getNoteFreq(note.noteIndex, currentChordOffset);
        osc.frequency.setValueAtTime(freq, startTime);

        if (note.type === "bass") {
          osc.type = bassSynthType;
          noteGain.gain.linearRampToValueAtTime((note.volume ?? 1) * 0.35, startTime + 0.05);
          noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration - 0.02);
          osc.connect(noteGain);
          noteGain.connect(bassVolume);
        } else if (note.type === "pad") {
          osc.type = padSynthType;
          noteGain.gain.linearRampToValueAtTime((note.volume ?? 1) * 0.25, startTime + noteDuration * 0.4);
          noteGain.gain.linearRampToValueAtTime((note.volume ?? 1) * 0.1, startTime + noteDuration * 0.8);
          noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration - 0.05);
          osc.connect(noteGain);
          noteGain.connect(padVolume);
        } else {
          osc.type = leadSynthType;
          noteGain.gain.linearRampToValueAtTime((note.volume ?? 1) * 0.22, startTime + 0.02);
          noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration - 0.01);
          osc.connect(noteGain);
          noteGain.connect(leadVolume);
        }

        osc.start(startTime);
        osc.stop(Math.min(duration, startTime + noteDuration));
      });

      leadVolume.connect(filter);
      padVolume.connect(filter);
      
      const delay = ctx.createDelay();
      const delayFeedback = ctx.createGain();
      delay.delayTime.setValueAtTime(beatDuration * 0.5, 0);
      delayFeedback.gain.setValueAtTime(0.35, 0);

      filter.connect(ctx.destination);
      filter.connect(delay);
      delay.connect(delayFeedback);
      delayFeedback.connect(delay);
      delay.connect(ctx.destination);

      bassVolume.connect(ctx.destination);

      onProgress(75);

      ctx.startRendering().then((renderedBuffer) => {
        onProgress(95);
        const wavBlob = bufferToWav(renderedBuffer);
        const objectUrl = URL.createObjectURL(wavBlob);
        onProgress(100);
        resolve(objectUrl);
      }).catch(reject);

    } catch (err) {
      reject(err);
    }
  });
}

function generateOfflineMusicFallback(prompt: string, onProgress: (p: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const duration = 10;
      const sampleRate = 44100;
      const style = analyzePrompt(prompt);
      
      onProgress(10);
      
      const ctx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);
      
      let scale = [0, 2, 3, 5, 7, 8, 10];
      if (style.theme === "cyberpunk") scale = [0, 2, 3, 5, 7, 8, 11];
      else if (style.theme === "math") scale = [0, 2, 4, 7, 9];
      else if (style.theme === "default") scale = [0, 2, 4, 5, 7, 9, 11];
      
      const baseMidi = style.theme === "cosmic" ? 48 : style.theme === "cyberpunk" ? 52 : 60;
      
      const midiToFreq = (midi: number) => Math.pow(2, (midi - 69) / 12) * 440;
      
      // Bass
      const bassOsc = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bassOsc.type = "sine";
      bassGain.gain.setValueAtTime(0.3, 0);
      
      const rootPitches = [0, 3, 7, 5];
      const chordDuration = 2.5;
      for (let i = 0; i < 4; i++) {
        const time = i * chordDuration;
        const midiNote = baseMidi - 12 + rootPitches[i];
        bassOsc.frequency.setValueAtTime(midiToFreq(midiNote), time);
        
        bassGain.gain.setValueAtTime(0.01, time);
        bassGain.gain.linearRampToValueAtTime(0.28, time + 0.5);
        bassGain.gain.linearRampToValueAtTime(0.18, time + 2.0);
        bassGain.gain.linearRampToValueAtTime(0.01, time + chordDuration);
      }
      bassOsc.connect(bassGain);
      bassGain.connect(ctx.destination);
      bassOsc.start(0);
      bassOsc.stop(duration);
      
      onProgress(35);
      
      // Arp
      const arpOsc = ctx.createOscillator();
      const arpGain = ctx.createGain();
      const arpFilter = ctx.createBiquadFilter();
      arpOsc.type = style.theme === "cyberpunk" ? "sawtooth" : "triangle";
      arpFilter.type = "lowpass";
      arpFilter.Q.setValueAtTime(4, 0);
      
      const tempoBPM = style.bpm;
      const noteLength = 60 / tempoBPM / 2;
      const numArpNotes = Math.floor(duration / noteLength);
      
      arpGain.gain.setValueAtTime(0, 0);
      
      for (let n = 0; n < numArpNotes; n++) {
        const time = n * noteLength;
        const chordIndex = Math.floor(time / chordDuration) % 4;
        const scaleIndex = (n * 3 + (n % 4)) % scale.length;
        const midiNote = baseMidi + rootPitches[chordIndex] + scale[scaleIndex];
        
        arpOsc.frequency.setValueAtTime(midiToFreq(midiNote), time);
        
        arpFilter.frequency.setValueAtTime(400, time);
        arpFilter.frequency.exponentialRampToValueAtTime(2200, time + 0.05);
        arpFilter.frequency.exponentialRampToValueAtTime(300, time + noteLength - 0.02);
        
        arpGain.gain.setValueAtTime(0, time);
        arpGain.gain.linearRampToValueAtTime(style.theme === "cyberpunk" ? 0.09 : 0.16, time + 0.02);
        arpGain.gain.exponentialRampToValueAtTime(0.001, time + noteLength - 0.01);
      }
      
      arpOsc.connect(arpFilter);
      arpFilter.connect(arpGain);
      
      const delayNode = ctx.createDelay();
      const delayFeedback = ctx.createGain();
      delayNode.delayTime.setValueAtTime(0.25, 0);
      delayFeedback.gain.setValueAtTime(0.4, 0);
      
      arpGain.connect(ctx.destination);
      arpGain.connect(delayNode);
      delayNode.connect(delayFeedback);
      delayFeedback.connect(delayNode);
      delayNode.connect(ctx.destination);
      
      arpOsc.start(0);
      arpOsc.stop(duration);
      
      onProgress(60);
      
      // Pads
      const padOsc1 = ctx.createOscillator();
      const padOsc2 = ctx.createOscillator();
      const padGain = ctx.createGain();
      
      padOsc1.type = "sine";
      padOsc2.type = "triangle";
      
      padOsc1.detune.setValueAtTime(-15, 0);
      padOsc2.detune.setValueAtTime(15, 0);
      
      padGain.gain.setValueAtTime(0.01, 0);
      
      for (let j = 0; j < 4; j++) {
        const time = j * chordDuration;
        const root = rootPitches[j];
        
        const note1 = baseMidi + 12 + root;
        const note2 = baseMidi + 12 + root + scale[2 % scale.length];
        
        padOsc1.frequency.setValueAtTime(midiToFreq(note1), time);
        padOsc2.frequency.setValueAtTime(midiToFreq(note2), time);
        
        padGain.gain.linearRampToValueAtTime(0.2, time + chordDuration / 2);
        padGain.gain.linearRampToValueAtTime(0.05, time + chordDuration - 0.1);
      }
      
      padOsc1.connect(padGain);
      padOsc2.connect(padGain);
      padGain.connect(ctx.destination);
      
      padOsc1.start(0);
      padOsc2.start(0);
      padOsc1.stop(duration);
      padOsc2.stop(duration);
      
      onProgress(85);
      
      ctx.startRendering().then((renderedBuffer) => {
        onProgress(95);
        const wavBlob = bufferToWav(renderedBuffer);
        const objectUrl = URL.createObjectURL(wavBlob);
        onProgress(100);
        resolve(objectUrl);
      }).catch(reject);
      
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 3. PROCEDURAL VIDEO GENERATION
 * Connects with Gemini to get dynamic frame animations, compiling them 
 * sequentially into a 30fps recorded download.
 */
export async function generateProceduralVideo(
  prompt: string,
  canvas: HTMLCanvasElement,
  onProgress: (p: number) => void
): Promise<string> {
  let config: any = null;
  try {
    const res = await fetch("/api/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "video", prompt })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.config) {
        config = data.config;
      }
    }
  } catch (err) {
    console.warn("Using offline fallback for video synthesis", err);
  }

  if (!config) {
    return generateOfflineVideoFallback(prompt, canvas, onProgress);
  }

  return new Promise((resolve, reject) => {
    try {
      const durationSec = 5;
      const fps = 30;
      const totalFrames = durationSec * fps;
      const ctx = canvas.getContext("2d")!;
      
      const bgStyle = config.canvasBackground || "#020617";
      const pType = config.particleType || "stars";
      const pColor = config.particleColor || "#ffffff";
      const pCount = config.particleCount ?? 50;
      const pSpeed = config.particleSpeed ?? 1.5;
      const animElements = config.animatedElements || [];

      // Initialize particles
      const particles: Array<{ x: number; y: number; speed: number; size: number; angle?: number }> = [];
      for (let i = 0; i < pCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          speed: Math.random() * pSpeed + 0.5,
          size: Math.random() * 3 + 1,
          angle: Math.random() * Math.PI * 2
        });
      }

      // Stream capturing setup
      const stream = canvas.captureStream(fps);
      let options = { mimeType: "video/webm;codecs=vp9" };
      if (typeof MediaRecorder !== "undefined") {
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { mimeType: "video/webm;codecs=vp8" };
        }
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { mimeType: "video/webm" };
        }
      } else {
        reject(new Error("MediaRecorder not supported"));
        return;
      }

      const chunks: Blob[] = [];
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        const videoBlob = new Blob(chunks, { type: "video/webm" });
        const videoUrl = URL.createObjectURL(videoBlob);
        onProgress(100);
        resolve(videoUrl);
      };
      
      mediaRecorder.start();
      
      let currentFrame = 0;
      
      const renderNextFrame = () => {
        if (currentFrame >= totalFrames) {
          mediaRecorder.stop();
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        const progressRatio = currentFrame / totalFrames;

        // Render Background
        ctx.fillStyle = bgStyle;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Render Particles
        ctx.fillStyle = pColor;
        particles.forEach(p => {
          if (pType === "stars" || pType === "snow") {
            p.y += p.speed;
            if (p.y > canvas.height) p.y = 0;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          } else if (pType === "matrix" || pType === "digital_rain") {
            p.y += p.speed * 2;
            if (p.y > canvas.height) p.y = 0;
            ctx.fillStyle = pColor + "aa";
            ctx.font = `${Math.floor(p.size * 3 + 8)}px monospace`;
            ctx.fillText(String.fromCharCode(33 + Math.floor(Math.random() * 90)), p.x, p.y);
          } else if (pType === "bubbles" || pType === "fireflies") {
            p.y -= p.speed * 0.5;
            p.x += Math.sin(currentFrame * 0.05 + p.speed) * 0.5;
            if (p.y < 0) p.y = canvas.height;
            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 1.5, 0, Math.PI * 2);
            ctx.fill();
          } else if (pType === "waves") {
            p.x += p.speed;
            if (p.x > canvas.width) p.x = 0;
            ctx.beginPath();
            ctx.arc(p.x, p.y + Math.sin(p.x * 0.01 + progressRatio * Math.PI * 2) * 10, p.size, 0, Math.PI * 2);
            ctx.fill();
          }
        });

        // Render animated structures
        animElements.forEach((elem: any) => {
          ctx.save();
          
          const ex = elem.x ?? (canvas.width / 2);
          const ey = elem.y ?? (canvas.height / 2);
          const espeed = elem.speed ?? 1.0;
          const ecolor = elem.color ?? "#ffffff";
          const esize = elem.size ?? 50;

          ctx.translate(ex, ey);
          ctx.fillStyle = ecolor;
          ctx.strokeStyle = elem.secondaryColor || "transparent";
          ctx.lineWidth = 2;

          const etype = elem.type;

          if (etype === "pulse_orb") {
            const sizeMod = esize + Math.sin(progressRatio * Math.PI * 6 * espeed) * (esize * 0.4);
            const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, sizeMod);
            grad.addColorStop(0, "#ffffff");
            grad.addColorStop(0.3, ecolor);
            grad.addColorStop(1, "transparent");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, sizeMod, 0, Math.PI * 2);
            ctx.fill();
          } else if (etype === "rotate_polygon") {
            ctx.rotate(progressRatio * Math.PI * 4 * espeed);
            const sides = elem.sides ?? 5;
            ctx.beginPath();
            for (let s = 0; s <= sides; s++) {
              const angle = (s * Math.PI * 2) / sides;
              const rx = Math.cos(angle) * esize;
              const ry = Math.sin(angle) * esize;
              if (s === 0) ctx.moveTo(rx, ry);
              else ctx.lineTo(rx, ry);
            }
            ctx.closePath();
            ctx.stroke();
            if (elem.secondaryColor) {
              ctx.fillStyle = elem.secondaryColor + "33";
              ctx.fill();
            }
          } else if (etype === "sine_wave") {
            const amp = elem.amplitude ?? 40;
            const freq = elem.frequency ?? 0.02;
            const count = elem.count ?? 3;
            ctx.beginPath();
            for (let c = 0; c < count; c++) {
              ctx.moveTo(-canvas.width / 2, 0);
              for (let px = -canvas.width / 2; px <= canvas.width / 2; px += 10) {
                const py = Math.sin(px * freq + progressRatio * Math.PI * 4 * espeed + c * 0.5) * amp;
                ctx.lineTo(px, py);
              }
            }
            ctx.stroke();
          } else if (etype === "expanding_ripple") {
            const count = elem.count ?? 4;
            ctx.strokeStyle = ecolor;
            for (let c = 0; c < count; c++) {
              const ringProg = (progressRatio * espeed + c / count) % 1.0;
              const rSize = ringProg * esize * 2;
              ctx.lineWidth = 3 * (1 - ringProg);
              ctx.beginPath();
              ctx.arc(0, 0, rSize, 0, Math.PI * 2);
              ctx.stroke();
            }
          } else if (etype === "lissajous") {
            ctx.beginPath();
            for (let theta = 0; theta < Math.PI * 2; theta += 0.05) {
              const freqX = 3 + Math.sin(progressRatio * Math.PI * espeed) * 1.5;
              const freqY = 4 + Math.cos(progressRatio * Math.PI * espeed) * 1.5;
              const rx = Math.sin(theta * freqX) * esize;
              const ry = Math.cos(theta * freqY) * esize;
              if (theta === 0) ctx.moveTo(rx, ry);
              else ctx.lineTo(rx, ry);
            }
            ctx.stroke();
          } else if (etype === "floating_grid") {
            const spacing = esize;
            const driftY = (progressRatio * spacing * espeed) % spacing;
            ctx.strokeStyle = ecolor + "44";
            ctx.beginPath();
            for (let gx = -spacing * 4; gx <= spacing * 4; gx += spacing) {
              ctx.moveTo(gx, -spacing * 4);
              ctx.lineTo(gx, spacing * 4);
            }
            for (let gy = -spacing * 4; gy <= spacing * 4; gy += spacing) {
              ctx.moveTo(-spacing * 4, gy + driftY);
              ctx.lineTo(spacing * 4, gy + driftY);
            }
            ctx.stroke();
          } else if (etype === "glowing_tunnel") {
            const count = elem.count ?? 5;
            for (let t = 0; t < count; t++) {
              const tunnelProg = (progressRatio * espeed + t / count) % 1.0;
              const tRadius = tunnelProg * esize * 2.5;
              ctx.strokeStyle = ecolor;
              ctx.lineWidth = 1 + (1 - tunnelProg) * 4;
              ctx.save();
              ctx.rotate(progressRatio * Math.PI * espeed * 0.5);
              ctx.beginPath();
              ctx.rect(-tRadius, -tRadius, tRadius * 2, tRadius * 2);
              ctx.stroke();
              ctx.restore();
            }
          }

          ctx.restore();
        });

        // Watermark overlay
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.font = "bold 9px 'Fira Code', 'JetBrains Mono', monospace";
        ctx.fillText("PETNAN_AI SYNTHESIS STREAM", 15, 25);
        ctx.fillText(`PROMPT: ${prompt.toUpperCase().slice(0, 32)}${prompt.length > 32 ? "..." : ""}`, 15, 40);
        ctx.fillText(`TIME: ${(currentFrame / fps).toFixed(2)}s / 5.00s // 30 FPS WEB_ART`, 15, 55);

        currentFrame++;
        onProgress(Math.floor((currentFrame / totalFrames) * 90));
        setTimeout(renderNextFrame, 1000 / fps);
      };

      renderNextFrame();
    } catch (err) {
      reject(err);
    }
  });
}

function generateOfflineVideoFallback(
  prompt: string,
  canvas: HTMLCanvasElement,
  onProgress: (p: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const durationSec = 5;
      const fps = 30;
      const totalFrames = durationSec * fps;
      const style = analyzePrompt(prompt);
      
      const ctx = canvas.getContext("2d")!;
      const stream = canvas.captureStream(fps);
      
      let options = { mimeType: "video/webm;codecs=vp9" };
      if (typeof MediaRecorder !== "undefined") {
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { mimeType: "video/webm;codecs=vp8" };
        }
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { mimeType: "video/webm" };
        }
      } else {
        reject(new Error("MediaRecorder not supported"));
        return;
      }
      
      const chunks: Blob[] = [];
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        const videoBlob = new Blob(chunks, { type: "video/webm" });
        const videoUrl = URL.createObjectURL(videoBlob);
        onProgress(100);
        resolve(videoUrl);
      };
      
      mediaRecorder.start();
      
      let currentFrame = 0;
      
      const renderNextFrame = () => {
        if (currentFrame >= totalFrames) {
          mediaRecorder.stop();
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        ctx.fillStyle = "#020617";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const centerRefX = canvas.width / 2;
        const centerRefY = canvas.height / 2;
        const progressRatio = currentFrame / totalFrames;
        
        ctx.save();
        if (style.theme === "cosmic") {
          ctx.translate(centerRefX, centerRefY);
          ctx.rotate(progressRatio * Math.PI * 4);
          
          const numParticles = 120;
          for (let p = 0; p < numParticles; p++) {
            const angle = (p * Math.PI * 8) / numParticles;
            const distance = (p / numParticles) * 220 + 20;
            const px = Math.cos(angle) * distance;
            const py = Math.sin(angle) * distance;
            
            ctx.fillStyle = p % 2 === 0 ? style.primaryColor : style.secondaryColor;
            ctx.shadowBlur = 8;
            ctx.shadowColor = ctx.fillStyle;
            
            ctx.beginPath();
            ctx.arc(px, py, Math.max(1.5, Math.sin(progressRatio * Math.PI + p) * 3 + 2), 0, Math.PI * 2);
            ctx.fill();
          }
          
          const nebula = ctx.createRadialGradient(0, 0, 5, 0, 0, 90);
          nebula.addColorStop(0, "#ffffff");
          nebula.addColorStop(0.3, style.accentColor + "aa");
          nebula.addColorStop(0.7, style.primaryColor + "33");
          nebula.addColorStop(1, "transparent");
          ctx.fillStyle = nebula;
          ctx.beginPath();
          ctx.arc(0, 0, 90, 0, Math.PI * 2);
          ctx.fill();
          
        } else if (style.theme === "cyberpunk") {
          ctx.strokeStyle = style.primaryColor + "22";
          ctx.lineWidth = 1;
          const gridLines = 20;
          const deltaY = (progressRatio * 40) % 40;
          
          for (let g = 0; g <= gridLines; g++) {
            const xVal = (g / gridLines) * canvas.width;
            ctx.beginPath();
            ctx.moveTo(xVal, canvas.height * 0.5);
            ctx.lineTo((g / gridLines - 0.5) * canvas.width * 2 + centerRefX, canvas.height);
            ctx.stroke();
          }
          for (let h = canvas.height * 0.5; h <= canvas.height; h += 30) {
            ctx.beginPath();
            ctx.moveTo(0, h + deltaY);
            ctx.lineTo(canvas.width, h + deltaY);
            ctx.stroke();
          }
          
          ctx.translate(centerRefX, centerRefY - 50);
          ctx.rotate(-progressRatio * Math.PI * 2);
          ctx.strokeStyle = style.secondaryColor;
          ctx.shadowBlur = 12;
          ctx.shadowColor = style.secondaryColor;
          ctx.lineWidth = 2;
          
          ctx.beginPath();
          const sides = 6;
          const pulseRadius = 70 + Math.sin(progressRatio * Math.PI * 4) * 15;
          for (let s = 0; s <= sides; s++) {
            const angle = (s * Math.PI * 2) / sides;
            const px = Math.cos(angle) * pulseRadius;
            const py = Math.sin(angle) * pulseRadius;
            if (s === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
          
          ctx.fillStyle = style.accentColor;
          ctx.beginPath();
          ctx.arc(Math.cos(progressRatio * Math.PI * 4) * pulseRadius, Math.sin(progressRatio * Math.PI * 4) * pulseRadius, 8, 0, Math.PI * 2);
          ctx.fill();
          
        } else if (style.theme === "math") {
          ctx.translate(centerRefX, centerRefY);
          ctx.strokeStyle = style.primaryColor;
          ctx.shadowBlur = 10;
          ctx.shadowColor = style.primaryColor;
          ctx.lineWidth = 2;
          
          ctx.beginPath();
          for (let theta = 0; theta < Math.PI * 2; theta += 0.05) {
            const freqX = 3 + Math.sin(progressRatio * Math.PI * 2) * 1.5;
            const freqY = 4 + Math.cos(progressRatio * Math.PI * 2) * 1.5;
            const x = Math.sin(theta * freqX) * 150;
            const y = Math.cos(theta * freqY) * 150;
            if (theta === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          
          ctx.strokeStyle = style.secondaryColor + "77";
          ctx.lineWidth = 1;
          for (let ring = 0; ring < 4; ring++) {
            const rSize = ((progressRatio + ring * 0.25) % 1.0) * 200;
            ctx.beginPath();
            ctx.arc(0, 0, rSize, 0, Math.PI * 2);
            ctx.stroke();
          }
          
        } else {
          ctx.translate(centerRefX, centerRefY);
          const numRings = 5;
          for (let ring = 0; ring < numRings; ring++) {
            const ringProg = (progressRatio + ring / numRings) % 1.0;
            const rSize = ringProg * 250;
            ctx.strokeStyle = ring % 2 === 0 ? style.primaryColor : style.secondaryColor;
            ctx.lineWidth = 3 * (1 - ringProg);
            ctx.shadowBlur = 8;
            ctx.shadowColor = ctx.strokeStyle;
            ctx.beginPath();
            ctx.arc(0, 0, rSize, 0, Math.PI * 2);
            ctx.stroke();
          }
          
          ctx.fillStyle = style.accentColor;
          ctx.shadowBlur = 20;
          ctx.shadowColor = style.accentColor;
          ctx.beginPath();
          ctx.arc(0, 0, 30 + Math.sin(progressRatio * Math.PI * 8) * 8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.font = "bold 9px 'Fira Code', 'JetBrains Mono', monospace";
        ctx.fillText("PETNAN_AI SYNTHESIS STREAM", 15, 25);
        ctx.fillText(`PROMPT: ${prompt.toUpperCase().slice(0, 32)}${prompt.length > 32 ? "..." : ""}`, 15, 40);
        ctx.fillText(`TIME: ${(currentFrame / fps).toFixed(2)}s / 5.00s // 30 FPS WebM`, 15, 55);
        
        currentFrame++;
        onProgress(Math.floor((currentFrame / totalFrames) * 90));
        setTimeout(renderNextFrame, 1000 / fps);
      };
      
      renderNextFrame();
      
    } catch (err) {
      reject(err);
    }
  });
}
