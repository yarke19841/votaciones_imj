import React from "react"
import ReactDOM from "react-dom/client"
import { HashRouter } from "react-router-dom"
import App from "./App.jsx"
import "./styles/ui.css"
import "./index.css"
import "./styles/identity.css"

// Preserve the two entry links issued for the original prototype.
if (window.location.hash === '#admin') window.history.replaceState(null, '', '#/admin')
if (window.location.hash === '#votante') window.history.replaceState(null, '', '#/')

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)
