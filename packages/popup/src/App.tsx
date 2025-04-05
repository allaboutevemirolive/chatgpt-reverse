// packages/popup/src/App.tsx
import { useState } from "react";
import { createGreeting, VERSION } from "@shared";
import "./App.css";

function App() {
    const [response, setResponse] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const handleSendMessage = () => {
        setIsLoading(true);
        setResponse(""); // Clear previous response

        const messagePayload = createGreeting("Popup User");

        console.log("Sending message from popup:", messagePayload);

        // Send message to background script
        chrome.runtime.sendMessage(messagePayload, (responseFromBackground) => {
            setIsLoading(false);
            if (chrome.runtime.lastError) {
                // Handle potential errors (e.g., background script not ready)
                console.error(
                    "Popup Error:",
                    chrome.runtime.lastError.message,
                );
                setResponse(`Error: ${chrome.runtime.lastError.message}`);
            } else {
                console.log(
                    "Received response in popup:",
                    responseFromBackground,
                );
                setResponse(
                    responseFromBackground?.farewell ?? "No response received",
                );
            }
        });
    };

    return (
        <div className="AppContainer">
            <h1 className="AppTitle">ChatGPT Reverse Extension</h1>

            <button
                type="button"
                onClick={handleSendMessage}
                disabled={isLoading}
                className="AppButton"
            >
                {isLoading ? "Sending..." : "Greet Background"}
            </button>

            <div className="AppResponse">
                Response: {response || "(Click button)"}
            </div>

            <div className="AppVersion">Shared Lib Version: {VERSION}</div>
        </div>
    );
}

export default App;
