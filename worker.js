// Atlas Web model worker: runs the language model off the main thread.
import { env, pipeline, TextStreamer, InterruptableStoppingCriteria } from './vendor/transformers.min.js';

env.allowLocalModels = false;
env.useBrowserCache = true;
// The ONNX runtime files are hosted next to this page, not on a CDN.
env.backends.onnx.wasm.wasmPaths = new URL('./vendor/', import.meta.url).href;

// ONNX Runtime's WebAssembly file is stored in 2 MB parts (GitHub's upload path here takes
// small files), then joined in memory and handed to the runtime directly.
const WASM_PARTS = 11;
let wasmReady = null;
function loadWasmBinary() {
  if (!wasmReady) {
    wasmReady = Promise.all(Array.from({ length: WASM_PARTS }, (_, i) =>
      fetch(new URL(`./vendor/ort-wasm-parts/part${i}.bin`, import.meta.url)).then((r) => {
        if (!r.ok) throw new Error('Could not download part of the AI engine (' + r.status + ')');
        return r.arrayBuffer();
      }))).then((bufs) => {
      const total = bufs.reduce((n, b) => n + b.byteLength, 0);
      const out = new Uint8Array(total);
      let offset = 0;
      for (const b of bufs) { out.set(new Uint8Array(b), offset); offset += b.byteLength; }
      env.backends.onnx.wasm.wasmBinary = out.buffer;
    });
  }
  return wasmReady;
}

const MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';
let generator = null;
let device = 'wasm';
const stopper = new InterruptableStoppingCriteria();

async function pickDevice() {
  try {
    if (self.navigator && navigator.gpu) {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) return 'webgpu';
    }
  } catch (e) { /* fall back */ }
  return 'wasm';
}

async function load(forceWasm) {
  await loadWasmBinary();
  device = forceWasm ? 'wasm' : await pickDevice();
  const dtype = device === 'webgpu' ? 'q4f16' : 'q8';
  const files = new Map();
  const progress_callback = (p) => {
    if (p.status === 'progress' && p.total) {
      files.set(p.file, { loaded: p.loaded, total: p.total });
      let loaded = 0, total = 0;
      for (const f of files.values()) { loaded += f.loaded; total += f.total; }
      self.postMessage({ type: 'progress', percent: Math.floor((loaded / total) * 100) });
    }
  };
  try {
    generator = await pipeline('text-generation', MODEL_ID, { device, dtype, progress_callback });
  } catch (err) {
    if (device === 'webgpu') {
      // Some devices report WebGPU but cannot run it. Try the CPU path.
      return load(true);
    }
    throw err;
  }
  self.postMessage({ type: 'ready', device });
}

async function generate({ id, messages, maxTokens, greedy }) {
  stopper.reset();
  let text = '';
  const streamer = new TextStreamer(generator.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (chunk) => {
      text += chunk;
      self.postMessage({ type: 'token', id, text });
    },
  });
  await generator(messages, {
    max_new_tokens: maxTokens,
    // Writing tools use greedy decoding (steady results); chat samples like the app (temperature 0.7).
    ...(greedy ? { do_sample: false } : { do_sample: true, temperature: 0.7, top_p: 0.9 }),
    repetition_penalty: 1.1,
    streamer,
    stopping_criteria: stopper,
  });
  self.postMessage({ type: 'done', id, text: text.trim() });
}

self.addEventListener('message', async (event) => {
  const msg = event.data;
  try {
    if (msg.type === 'load') {
      if (generator) { self.postMessage({ type: 'ready', device }); return; }
      await load(false);
    } else if (msg.type === 'generate') {
      await generate(msg);
    } else if (msg.type === 'stop') {
      stopper.interrupt();
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: msg.id, message: String(err && err.message || err) });
  }
});
