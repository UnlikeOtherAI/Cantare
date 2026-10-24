import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { useEditor } from "./state/editor";
import { useUi } from "./state/ui";
import { demoArtwork } from "./engine/demoArtwork";
import { startPersistence } from "./platform/persistence";

if (import.meta.env.DEV) Object.assign(window, { __editor: useEditor, __ui: useUi, __demo: demoArtwork });

// The last scene is restored before the first render so the stage never shows the defaults first.
void startPersistence()
  .catch(() => undefined)
  .then(() =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
);
