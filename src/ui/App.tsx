import { Viewport } from "./Viewport";

export function App() {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#111" }}>
      <Viewport />
    </div>
  );
}
