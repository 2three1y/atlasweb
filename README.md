# Atlas Web

Atlas Web is my web version of **Atlas AI**, a free, space-themed AI assistant app for Android made by **Taha Armin**. I wanted the same thing in a browser, working well with VoiceOver, TalkBack and a keyboard.

Try it: https://2three1y.github.io/atlasweb/

## Credit

Atlas AI is Taha Armin's app. Atlas Web is an unofficial rebuild of its features and layout, not a copy of its code or art. You can find Taha's post about Atlas here: https://www.reddit.com/r/AiBuilders/comments/1xd9llc/hello_im_taha_armin_and_i_made_atlas_ai/

## What it does

- Chat with Atlas, with four AI personalities from the original app: Atlas, Hyperion, Astraea and Prometheus.
- AI response length: Concise, Standard, Detailed (default) or Exhaustive.
- Suggestions to get started, Stop generation, Copy reply, Copy code, Share reply and Read aloud.
- Voice chat: Atlas listens, answers in one short sentence and speaks it, in 17 languages.
- Writing tools, like the Atlas keyboard: fix grammar, make casual, make professional, shorten, summarize, translate to Finnish or Persian, and write a script.
- Conversation history, saved only in your browser, with search and delete.

## Keyless and private

The original app sends messages to a cloud AI service. Atlas Web runs a small open model, Qwen 2.5 0.5B Instruct, right in your browser with Transformers.js. It uses WebGPU when your device has it and falls back to WebAssembly when it does not. There are no API keys and no server.

The model, about 500 MB, downloads once from Hugging Face (the model's own host) and is cached by your browser. The Transformers.js and ONNX Runtime files are hosted in this repo, so no CDN is used. Your chats stay on your device.

Because the model is small, answers are simpler and slower than the app's big cloud models. All four personalities use the same model.

## Not included

The "Hey Atlas" always-on wake word, the quick settings tile and the system-wide keyboard can't be done in a browser.

## Accessibility

One heading level 1, real buttons and labels, and a single polite status message for things like "Atlas is thinking..." and "Atlas replied." Each message has its own heading, so you can jump between messages by heading.

## Licenses

My code is under the MIT License. Third-party files in `vendor/` are listed in `vendor/NOTICE.md`.

Co-written with Tab
