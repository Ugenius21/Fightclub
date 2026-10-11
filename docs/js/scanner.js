'use strict';

/* =========================================================
   Strichcode-Scanner (EAN/UPC auf Lebensmittelverpackungen)

   Nutzt die eingebaute BarcodeDetector-API, wenn der Browser sie
   kennt. Auf dem iPhone (Safari) gibt es sie nicht – dann wird die
   mitgelieferte Erkennung (ZXing-C++ als WebAssembly, vendor/) geladen.
   Alles läuft lokal auf dem Gerät, auch offline.
   ========================================================= */

const Scanner = (() => {
  const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
  let detectorPromise = null;
  let stream = null;
  let running = false;

  function loadPonyfill() {
    if (window.BarcodeDetectionAPI) return Promise.resolve(window.BarcodeDetectionAPI);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/barcode-detector.js';
      s.onload = () => {
        const api = window.BarcodeDetectionAPI;
        api.prepareZXingModule({
          overrides: {
            locateFile: (path, prefix) => (path.endsWith('.wasm') ? new URL('vendor/zxing_reader.wasm', location.href).href : prefix + path),
          },
        });
        resolve(api);
      };
      s.onerror = () => reject(new Error('Scanner konnte nicht geladen werden.'));
      document.head.appendChild(s);
    });
  }

  function getDetector() {
    if (!detectorPromise) {
      detectorPromise = (async () => {
        if ('BarcodeDetector' in window) {
          try {
            const supported = await window.BarcodeDetector.getSupportedFormats();
            if (supported.includes('ean_13')) return new window.BarcodeDetector({ formats: FORMATS });
          } catch (e) { /* auf die mitgelieferte Erkennung ausweichen */ }
        }
        const api = await loadPonyfill();
        return new api.BarcodeDetector({ formats: FORMATS });
      })();
      detectorPromise.catch(() => { detectorPromise = null; });
    }
    return detectorPromise;
  }

  /** Prüfziffer von EAN-8/EAN-13/UPC-A prüfen, damit Fehlerkennungen aussortiert werden. */
  function validCode(code) {
    if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
    const digits = code.split('').map(Number);
    const check = digits.pop();
    const sum = digits.reverse().reduce((a, d, i) => a + d * (i % 2 === 0 ? 3 : 1), 0);
    return (10 - (sum % 10)) % 10 === check;
  }

  function pickCode(results) {
    for (const r of results || []) {
      const code = String(r.rawValue || '').trim();
      // UPC-E hat eine eigene Prüfziffer-Logik – den liefert die Erkennung schon geprüft.
      if (validCode(code) || (r.format === 'upc_e' && /^\d{8}$/.test(code))) return code;
    }
    return null;
  }

  /** Live-Scan mit der Rückkamera. onCode(code) wird genau einmal aufgerufen. */
  async function start(video, onCode, onStatus) {
    stop();
    running = true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Die Kamera wird hier nicht unterstützt. Nutze „Foto“ oder tippe den Code ein.');
    }
    onStatus && onStatus('Kamera wird gestartet …');
    const [detector, media] = await Promise.all([
      getDetector(),
      navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      }),
    ]);
    if (!running) { media.getTracks().forEach((t) => t.stop()); return; }
    stream = media;
    video.setAttribute('playsinline', '');
    video.muted = true;
    video.srcObject = stream;
    await video.play();
    onStatus && onStatus('Strichcode in den Rahmen halten');

    let busy = false;
    const loop = async () => {
      if (!running) return;
      if (!busy && video.readyState >= 2) {
        busy = true;
        try {
          const code = pickCode(await detector.detect(video));
          if (code && running) { stop(); onCode(code); return; }
        } catch (e) { /* einzelner Frame fehlgeschlagen – weiter */ }
        busy = false;
      }
      setTimeout(loop, 120);
    };
    loop();
  }

  function stop() {
    running = false;
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  }

  /** Strichcode aus einem Foto lesen (Ausweichlösung, falls die Live-Kamera nicht klappt). */
  async function fromFile(file) {
    const detector = await getDetector();
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return pickCode(await detector.detect(img));
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return { start, stop, fromFile, validCode, preload: () => getDetector().catch(() => {}) };
})();
