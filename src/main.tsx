import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { useEditor } from "./state/editor";
import { useUi } from "./state/ui";
import { demoArtwork } from "./engine/demoArtwork";

if (import.meta.env.DEV) Object.assign(window, { __editor: useEditor, __ui: useUi, __demo: demoArtwork });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
