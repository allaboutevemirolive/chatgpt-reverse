// packages/content-script/src/components/tabs/MarkdownExportTab.ts
import type { SendMessageToSW } from "../../utils/swMessenger"; // Use relative path

// Placeholder for the Markdown Export Tab UI and Logic
export class MarkdownExportTab {
    private element: HTMLDivElement;
    private sendMessage: SendMessageToSW; // Store the function
    private currentConvoId: string | null = null;

    constructor(sendMessage: SendMessageToSW) {
        console.log("Placeholder MarkdownExportTab initialized");
        this.sendMessage = sendMessage; // Assign the passed function
        this.element = document.createElement("div");
        this.element.innerHTML = `
            <div style="padding: 20px; color: #ccc; height: 100%; display: flex; flex-direction: column;">
                <h2>Markdown Export (Placeholder)</h2>
                <p>UI for exporting conversation <strong id="md-convo-id">N/A</strong> will be here.</p>
                <button id="md-export-btn" style="padding: 8px 12px; margin-top: 15px; cursor: pointer;">Export Now (Placeholder)</button>
                <div style="flex-grow: 1; border: 1px dashed #555; margin-top: 15px; display: flex; align-items: center; justify-content: center;">Preview Area</div>
            </div>
        `;
        // Add basic styling or structure needed
        Object.assign(this.element.style, {
            width: "100%",
            height: "100%",
            overflowY: "auto", // Allow scrolling
            boxSizing: "border-box",
        });

        // Example of using sendMessage (add actual logic later)
        const btn =
            this.element.querySelector<HTMLButtonElement>("#md-export-btn");
        btn?.addEventListener("click", () => {
            if (this.currentConvoId) {
                console.log(
                    `Placeholder: Requesting export for ${this.currentConvoId}`,
                );
                this.sendMessage({
                    type: "EXPORT_CONVERSATION_MARKDOWN",
                    payload: { conversationId: this.currentConvoId },
                })
                    .then((data) =>
                        console.log("Placeholder Export Success:", data),
                    )
                    .catch((err) =>
                        console.error("Placeholder Export Error:", err),
                    );
            } else {
                console.log("Placeholder: No conversation ID to export.");
                alert("No active conversation selected for export.");
            }
        });
    }

    getElement(): HTMLDivElement {
        return this.element;
    }

    updateConversationId(conversationId: string | null): void {
        this.currentConvoId = conversationId;
        console.log(
            `Placeholder MarkdownExportTab: Conversation ID updated to: ${this.currentConvoId}`,
        );
        const idElement =
            this.element.querySelector<HTMLElement>("#md-convo-id");
        if (idElement) {
            idElement.textContent = this.currentConvoId || "N/A";
        }
        const btn =
            this.element.querySelector<HTMLButtonElement>("#md-export-btn");
        if (btn) {
            btn.disabled = !this.currentConvoId;
        }
    }
}
