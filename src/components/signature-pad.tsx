import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Trash2 } from "lucide-react";

/**
 * A small freehand signature pad drawn on a `<canvas>`.
 *
 * Emits a PNG data URL (or `null` after clearing) via `onChange`. Sized to its
 * container width so it works on both desktop and touch devices.
 */
export function SignaturePad({
  onChange,
  height = 150,
}: {
  onChange: (dataUrl: string | null) => void;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function prepare() {
      const el = canvasRef.current;
      if (!el) return;
      const dpr = window.devicePixelRatio || 1;
      const width = el.clientWidth || 320;
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
      const ctx = el.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0f172a";
    }

    prepare();
    // A resize clears the canvas, so any existing signature must be re-drawn by
    // the user — acceptable for a fresh acknowledgement.
    window.addEventListener("resize", prepare);
    return () => window.removeEventListener("resize", prepare);
  }, [height]);

  function pointOf(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event: ReactPointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    last.current = pointOf(event);
  }

  function draw(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const from = last.current;
    if (!canvas || !ctx || !from) return;
    const to = pointOf(event);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    last.current = to;
    if (!hasInk) setHasInk(true);
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    const canvas = canvasRef.current;
    if (canvas && hasInk) onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setHasInk(false);
    onChange(null);
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-lg border bg-white">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={draw}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
          style={{ height, touchAction: "none" }}
          className="block w-full cursor-crosshair"
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center text-xs text-slate-400">
            Sign here
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          Draw with a finger, stylus or mouse.
        </span>
        <button
          type="button"
          onClick={clear}
          className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          <Trash2 className="size-3.5" /> Clear
        </button>
      </div>
    </div>
  );
}
