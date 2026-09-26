# Pot Bl0ck 3.0.7-bl0ck.7

- Added Auto Free translator fallback: Google → Bing → Yandex → Lingva, with short cooldown for failed providers.
- Added LibreTranslate with configurable endpoint and optional API key.
- Added a Google Translate `TranslateWebserverUi` / `batchexecute` fallback in addition to clients5 and translate_a routes.
- Added Mistral OCR provider (`mistral-ocr-latest`).
- Added OCR.Space provider with selectable OCR Engine 1/2/3.
- Added Auto OCR that can use existing System OCR/Tesseract plus optional Mistral/OCR.Space fallbacks.
- No RapidOCR/Paddle/ONNX model is bundled in this release, so these changes do not add a large local OCR model to the installer.
