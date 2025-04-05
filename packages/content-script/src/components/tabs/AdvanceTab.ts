// packages/content-script/src/components/tabs/AdvanceTab.ts

import { ActionSidebar } from "../ActionSidebar";

export class AdvanceTab {
    private element: HTMLDivElement;
    private actionSidebar: ActionSidebar; // Instance of the sidebar

    constructor() {
        this.element = document.createElement("div");
        // Style the main container for AdvanceTab (e.g., use flex)
        Object.assign(this.element.style, {
            display: 'flex',
            width: '100%',
            height: '100%',
            overflow: 'hidden' // Main container doesn't scroll
        });

        // Create and add the sidebar
        this.actionSidebar = new ActionSidebar();
        this.element.appendChild(this.actionSidebar.getElement());

        // Create and add the main content area for this tab
        const mainArea = document.createElement('div');
        Object.assign(mainArea.style, {
            flex: '1', // Takes remaining space
            padding: '20px',
            overflowY: 'auto', // Allow this area to scroll
            color: '#ccc' // Example color
        });
        mainArea.innerHTML = `<h2>Advanced Content Area</h2><p>Settings and tools go here.</p>`;
        this.element.appendChild(mainArea);


        // --- Add actions to the sidebar ---
        this.actionSidebar.addAction("Primary Action", () => alert("Primary Action!"), "primary");
        this.actionSidebar.addAction("Default Action 1", () => alert("Default Action 1"));
        this.actionSidebar.addAction("Default Action 2", () => alert("Default Action 2"));
        this.actionSidebar.addAction("Dangerous Action", () => {
            if (confirm("Are you sure?")) {
                alert("Dangerous Action Done!");
            }
        }, "danger");

        console.log("Placeholder AdvanceTab initialized with ActionSidebar");
    }

    getElement(): HTMLDivElement {
        return this.element;
    }

    updateConversationId(conversationId: string | null): void {
        console.log(
            `Placeholder AdvanceTab: Conversation ID updated to: ${conversationId} (maybe update sidebar actions?)`,
        );
        // Potentially enable/disable sidebar actions based on conversationId
    }
}
