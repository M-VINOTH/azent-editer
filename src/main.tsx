import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App.tsx"
import { restoreDocumentFile } from "./services/documentFile"
import { restoreEditorSession } from "./services/editorSession"
import "./index.css"

async function boot(): Promise<void> {
  document.documentElement.dataset.theme = localStorage.getItem("azent-editor-theme") === "dark" ? "dark" : "light"
  await restoreEditorSession()
  await restoreDocumentFile()
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
