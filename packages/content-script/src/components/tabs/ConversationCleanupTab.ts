// packages/content-script/src/components/tabs/ConversationCleanupTab.ts
import type { SendMessageToSW } from "../../utils/swMessenger"; // Adjust path if needed

// Placeholder for the Conversation Cleanup Tab UI and Logic
export class ConversationCleanupTab {
    private element: HTMLDivElement;
    private sendMessage: SendMessageToSW;

    constructor(sendMessage: SendMessageToSW) {
        console.log("Placeholder ConversationCleanupTab initialized");
        this.sendMessage = sendMessage; // Store the function if needed for cleanup actions

        this.element = document.createElement("div");
        this.element.innerHTML = `
            <div style="padding: 20px; color: #ccc; height: 100%; display: flex; flex-direction: column;">
                <h2>Conversation Cleanup (Placeholder)</h2>
                <p>UI for managing/deleting multiple conversations will be here.</p>
                <button id="cleanup-btn" style="padding: 8px 12px; margin-top: 15px; cursor: pointer;">Start Cleanup (Placeholder)</button>
                 <div style="flex-grow: 1; border: 1px dashed #555; margin-top: 15px; display: flex; align-items: center; justify-content: center;">Conversation List Area</div>
            </div>
        `;
        // Add basic styling or structure needed
        Object.assign(this.element.style, {
            width: "100%",
            height: "100%",
            overflowY: "auto", // Allow scrolling
            boxSizing: "border-box",
        });

        // Example button listener
        const btn =
            this.element.querySelector<HTMLButtonElement>("#cleanup-btn");
        btn?.addEventListener("click", () => {
            console.log("Placeholder: Cleanup button clicked.");
            // Example: this.sendMessage({ type: "START_CLEANUP", payload: { options: {} } });
            alert("Cleanup action placeholder triggered.");
        });
    }

    /**
     * Returns the root HTML element for this tab's UI.
     */
    getElement(): HTMLDivElement {
        return this.element;
    }

    /**
     * Called when the active conversation ID changes in the main window.
     * This tab might not need to react to specific conversation changes.
     */
    updateConversationId(conversationId: string | null): void {
        console.log(
            `Placeholder ConversationCleanupTab: Conversation ID updated to: ${conversationId} (likely ignored by this tab)`,
        );
        // Usually, cleanup operates on the list, not a single conversation.
    }
}
