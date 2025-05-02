// packages/popup/src/authMain.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import AuthPage from "./AuthPage";
import "./auth.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <AuthPage />
    </React.StrictMode>,
);
