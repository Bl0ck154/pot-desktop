# Pot Bl0ck 3.0.7-bl0ck.7

- Added Auto Free translator fallback: Google → Bing → Yandex → Lingva, with short cooldown for actual provider failures. Unsupported language pairs do not poison a provider cooldown.
- Added LibreTranslate with configurable endpoint/API key. The public libretranslate.com instance currently requires a key because of bot-abuse restrictions; self-hosted instances may not.
- Added a Google Translate `TranslateWebserverUi` / `batchexecute` fallback in addition to clients5 and translate_a routes, and support for both known clients5 response shapes.
- Added Mistral OCR provider (`mistral-ocr-latest`).
- Added OCR.Space provider with selectable OCR Engine 1/2/3. Auto language detection transparently uses Engine 2 if Engine 1 was selected, because OCR.Space only supports auto-detection in Engines 2/3. The free endpoint has a 1 MB input limit.
- Added Auto OCR that can use existing System OCR/Tesseract plus optional Mistral/OCR.Space fallbacks, with configurable cloud preference and OCR.Space engine.
- No RapidOCR/Paddle/ONNX model is bundled in this release, so these changes do not add a large local OCR model to the installer.

## Verification

- Windows packaging is checked by the PR build workflow.
- Mistral OCR and OCR.Space request/response formats were checked against their current official API documentation.
- Google clients5/RPC and Edge/Bing are undocumented public web endpoints; the implementation follows currently active request/response shapes and has fallbacks, but these providers can change server-side without notice.
- Credentialed Mistral/OCR.Space/LibreTranslate calls require the user's own API keys and therefore cannot be fully live-tested in CI without secrets.
