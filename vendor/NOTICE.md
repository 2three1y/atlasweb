# Third-party files

- `transformers.min.js`, `ort-wasm-simd-threaded.jsep.mjs` and `ort-wasm-simd-threaded.jsep.wasm` (stored as 2 MB pieces in `ort-wasm-parts/`, joined again in the browser) come from the npm package `@huggingface/transformers` version 3.8.1 (Apache License 2.0, see `LICENSE-transformers.js.txt`). The `ort-wasm` files are ONNX Runtime Web (MIT License, Copyright Microsoft Corporation).
- The AI model, `onnx-community/Qwen2.5-0.5B-Instruct`, is not stored here. It downloads from Hugging Face on first use. Qwen2.5 is released by the Qwen team under the Apache License 2.0.
