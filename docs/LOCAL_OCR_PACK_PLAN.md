# Optional local OCR pack

RapidOCR/PaddleOCR/ONNX is intentionally not bundled into the base Pot installer because the runtime and model files would materially increase install size.

If added later, it should be an optional pack downloaded only when the user enables it, stored under AppConfig/AppCache, versioned separately, and removable from Settings. The base app must continue to work without the pack.
