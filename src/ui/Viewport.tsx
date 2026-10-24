import { useEffect, useRef } from "react";
import { CanStage, type StageInfo } from "../engine/stage";
import { useEditor } from "../state/editor";

let activeStage: CanStage | null = null;

/** The stage currently mounted, for export and camera commands. */
export function getStage() {
  return activeStage;
}

export function Viewport({ onInfo }: { onInfo?: (info: StageInfo) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settings = useEditor((s) => s.settings);
  const stageRef = useRef<CanStage | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const stage = new CanStage(canvas);
    stageRef.current = stage;
    activeStage = stage;
    if (import.meta.env.DEV) Object.assign(window, { __stage: stage });
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) stage.resize(width, height);
    });
    observer.observe(canvas.parentElement!);
    return () => {
      observer.disconnect();
      stage.dispose();
      if (activeStage === stage) activeStage = null;
      stageRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (stageRef.current) stageRef.current.onInfo = onInfo ?? null;
  }, [onInfo]);

  useEffect(() => {
    void stageRef.current?.apply(settings);
  }, [settings]);

  return <canvas ref={canvasRef} className="viewport-canvas" style={{ display: "block", width: "100%", height: "100%", touchAction: "none" }} />;
}
