import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { registerPwa } from "./pwa/registerPwa";
import "./styles/index.css";

registerPwa();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <App />,
);
