// packages/content-script/src/components/tabs/MarkdownExportTab.ts
import { theme } from "@shared";
import { downloadTextFile } from "@/utils/downloadUtils";
import { generateMarkdownFileName } from "@/utils/exportUtils";
import { SendMessageToSW } from "@/utils/swMessenger";
import { fetchMarkdownExportData } from "@/utils/apiUtils"; // Import fetch function
import { ActionSidebar } from "../ActionSidebar"; // Import ActionSidebar

// Type for the data returned by the service worker
interface ExportData {
    markdownContent: string;
    createTime: number;
    title: string;
}

// FIXME: Duplicate
// --- Type Definitions ---
type SidebarActionType = "primary" | "danger" | "default";
interface SidebarActionConfig {
    label: string;
    handler: () => void | Promise<void>;
    type?: SidebarActionType;
}

export class MarkdownExportTab {
    private rootElement: HTMLDivElement; // Main container (flex row: sidebar + mainPanel)
    private actionSidebar: ActionSidebar; // The sidebar component instance
    private mainPanel: HTMLDivElement; // Area for form inputs

    // Form Elements (in mainPanel)
    private idInput!: HTMLInputElement;
    private filenameInput!: HTMLInputElement;

    // Sidebar Elements
    private idStatusElement!: HTMLDivElement; // Displays "ID auto-detected" status in sidebar
    private feedbackArea!: HTMLDivElement; // Feedback area now part of the sidebar

    // State
    private sendMessageToSW: SendMessageToSW;
    private isProcessing: boolean = false;
    private defaultFilename: string = "";
    private userModifiedFilename: boolean = false;
    private currentConversationId: string | null = null; // Track current ID locally

    // Static flag for style injection
    private static animationStylesInjected = false;

    constructor(sendMessageFunction: SendMessageToSW) {
        this.sendMessageToSW = sendMessageFunction;

        // Create main container
        this.rootElement = document.createElement("div");
        Object.assign(this.rootElement.style, {
            display: "flex",
            width: "100%",
            height: "100%",
            overflow: "hidden",
        });

        // Create Sidebar
        this.actionSidebar = new ActionSidebar();
        this.rootElement.appendChild(this.actionSidebar.getElement());

        // Create Main Panel (for inputs)
        this.mainPanel = this.createMainPanel();
        this.rootElement.appendChild(this.mainPanel);

        // Create Input Fields within Main Panel
        this.createInputFields(); // Assigns this.idInput and this.filenameInput

        // Setup Action Buttons and Feedback Area on the Sidebar
        this.setupActionSidebar(); // Assigns this.idStatusElement and this.feedbackArea

        // Inject animation styles safely
        MarkdownExportTab.injectAnimationStyles();

        // Defer initial update to ensure DOM elements are ready
        requestAnimationFrame(() => {
            this.updateConversationId(null); // Initialize UI state based on initial ID
        });
    }

    // Static method to inject styles only once
    private static injectAnimationStyles(): void {
        if (this.animationStylesInjected) return;

        const spinKeyframes = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
        const spinClass = `.animate-spin { animation: spin 1s linear infinite; }`;
        const styleSheetId = "markdown-export-animations";

        // Check if the style element already exists
        if (document.getElementById(styleSheetId)) {
            this.animationStylesInjected = true;
            return;
        }

        const styleSheet = document.createElement("style");
        styleSheet.id = styleSheetId;
        styleSheet.textContent = spinKeyframes + spinClass;

        // Ensure document.head exists before appending
        if (document.head) {
            document.head.appendChild(styleSheet);
            this.animationStylesInjected = true;
        } else {
            // Fallback: Wait for DOMContentLoaded if head is not available
            const inject = () => {
                if (document.head && !document.getElementById(styleSheetId)) {
                    document.head.appendChild(styleSheet);
                    this.animationStylesInjected = true;
                }
                // Remove listener after trying to inject
                document.removeEventListener('DOMContentLoaded', inject);
            };
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', inject);
            } else {
                // DOM already loaded, but head wasn't found initially? Try immediate injection.
                if (document.head) { // Check again just in case
                    inject();
                } else {
                    console.error("MarkdownExportTab: document.head not available for style injection even after DOM loaded.");
                }
            }
            console.warn("MarkdownExportTab: document.head not immediately available for style injection, attempting fallback.");
        }
    }


    public getElement(): HTMLDivElement {
        return this.rootElement;
    }

    public updateConversationId(id: string | null): void {
        // Ensure elements are ready (important check!)
        if (!this.idInput || !this.filenameInput || !this.idStatusElement) {
            // It's possible this gets called by requestAnimationFrame before elements are fully ready
            // If the error persists, adding a small setTimeout here might be needed, but requestAnimationFrame is usually sufficient.
            console.warn(
                "MarkdownExportTab: UI elements not ready for updateConversationId (likely called too early). Retrying.",
            );
            // Simple retry mechanism
            requestAnimationFrame(() => this.updateConversationId(id));
            return;
        }

        const previousId = this.currentConversationId;
        this.currentConversationId = id; // Update local tracker

        // Only update input value if the detected ID actually changed AND
        // the user hasn't manually entered something different.
        if (id && id !== previousId && this.idInput.value !== id) {
            // Check if the input field currently holds the *previous* auto-detected ID
            // or if it's empty. If so, update it. Otherwise, respect manual input.
            if (!this.idInput.value || this.idInput.value === previousId) {
                this.idInput.value = id;
                // If we just auto-filled the ID, reset the userModifiedFilename flag
                // and suggest a filename based on the new ID
                this.userModifiedFilename = false;
                this.suggestFilename(id); // Suggest filename based on new ID
            }
            // Update sidebar status regardless
            this.idStatusElement.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="${theme.colors.success}" viewBox="0 0 16 16" style="flex-shrink: 0;">
                  <path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425z"/>
                </svg>
                <span style="color: ${theme.colors.textSecondary};">ID auto-detected.</span>
            `;
            this.idStatusElement.style.display = 'flex';

        } else if (!id) { // ID is null (navigated away or initial load without ID)
            // Clear input ONLY if it currently holds the previously auto-detected ID
            if (this.idInput.value === previousId) {
                this.idInput.value = "";
            }

            // Check if input is now effectively empty
            if (!this.idInput.value.trim()) {
                this.idStatusElement.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="${theme.colors.textTertiary}" viewBox="0 0 16 16" style="flex-shrink: 0;">
                      <path fill-rule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
                      <path d="M5.255 5.786a.237.237 0 0 0 .241.247h.825c.138 0 .248-.11.248-.247V5.786h.834v.263c0 .57-.463.942-.98.942h-.825A.98.98 0 0 1 6 6.247v-.261zm1.163.187a.25.25 0 0 0 .25.25h.825a.25.25 0 0 0 .25-.25V5.786h.834V6c0 .57-.463.942-.98.942h-.825a.98.98 0 0 1-.98-.942zm2.933 0a.25.25 0 0 0 .25.25h.825a.25.25 0 0 0 .25-.25V5.786h.834V6c0 .57-.463.942-.98.942h-.825a.98.98 0 0 1-.98-.942z"/>
                      <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0M7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0z"/>
                    </svg>
                    <span style="color: ${theme.colors.textTertiary}; font-style: italic;">No ID detected.</span>
                `;
                this.idStatusElement.style.display = 'flex'; // Show placeholder
                if (!this.userModifiedFilename) {
                    this.filenameInput.value = "";
                    this.defaultFilename = "";
                }
            } else {
                // Input is not empty (manual entry), update status accordingly
                this.updateIdStatusOnManualInput(); // Reflect manual state
            }
        } else {
            // ID hasn't changed, but maybe user manually changed input? Update status.
            this.updateIdStatusOnManualInput();
        }

        this.updateButtonStates();
    }

    // --- UI Creation Methods ---

    private createMainPanel(): HTMLDivElement {
        const panel = document.createElement("div");
        Object.assign(panel.style, {
            flex: "1",
            padding: theme.spacing.large,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: theme.spacing.large, // Gap between input sections
            backgroundColor: theme.colors.backgroundSecondary, // Match WindowMain content area
        });

        return panel;
    }

    /** Creates the form input fields in the main panel */
    private createInputFields(): void {
        const formContainer = document.createElement("div");
        // Using flex column for simplicity here
        Object.assign(formContainer.style, {
            display: "flex",
            flexDirection: "column",
            gap: theme.spacing.large, // Gap between the two fields
        });

        const fields = [
            {
                label: "Conversation ID",
                name: "conversationid",
                id: "markdown-export-conv-id",
                placeholder: "Conversation ID (auto-detected or paste)",
                monospace: true,
            },
            {
                label: "Filename (Optional)",
                name: "filename",
                id: "markdown-export-filename",
                placeholder: "Defaults to ChatGPT_Title_Date.md",
                monospace: false,
            },
        ];

        fields.forEach((field) => {
            const fieldGroup = this.createFormField(
                field.label,
                field.name,
                field.id,
                field.placeholder,
                field.monospace,
            );
            formContainer.appendChild(fieldGroup.container);

            // Assign class properties to the created input elements
            if (field.name === "conversationid") {
                this.idInput = fieldGroup.input;
                // Attach event listeners specific to idInput
                this.idInput.addEventListener("input", () => {
                    // Update local state *immediately* on manual input
                    // this.currentConversationId = this.idInput.value.trim(); // No, updateConversationId handles this relation
                    this.updateButtonStates();
                    this.updateIdStatusOnManualInput(); // Update sidebar status
                    if (!this.userModifiedFilename) {
                        this.suggestFilename(this.idInput.value.trim());
                    }
                });
                this.idInput.addEventListener("paste", () => {
                    // Allow paste event to complete before updating state
                    setTimeout(() => {
                        // this.currentConversationId = this.idInput.value.trim(); // No, let updateIdStatusOnManualInput handle comparison
                        this.updateButtonStates();
                        this.updateIdStatusOnManualInput();
                        if (!this.userModifiedFilename) {
                            this.suggestFilename(this.idInput.value.trim());
                        }
                    }, 0);
                });
                this.idInput.addEventListener("blur", () => {
                    if (!this.userModifiedFilename) {
                        this.suggestFilename(this.idInput.value.trim());
                    }
                    // Also ensure status is correct on blur
                    this.updateIdStatusOnManualInput();
                });
            } else if (field.name === "filename") {
                this.filenameInput = fieldGroup.input;
                // Attach event listeners specific to filenameInput
                this.filenameInput.addEventListener("input", () => {
                    const currentVal = this.filenameInput.value.trim();
                    // User modified if not empty AND different from the last known default/suggested
                    this.userModifiedFilename = currentVal !== "" && currentVal !== this.defaultFilename;
                });
            }
        });

        this.mainPanel.appendChild(formContainer); // Add the form fields to the main panel
    }

    /** Updates the ID status element in the sidebar based on manual input vs detected ID */
    private updateIdStatusOnManualInput(): void {
        if (!this.idStatusElement || !this.idInput) return;

        const manualId = this.idInput.value.trim();
        const detectedId = this.currentConversationId; // Get the ID potentially detected from URL

        if (manualId && manualId === detectedId) {
            // Manual input matches detected ID
            this.idStatusElement.innerHTML = `
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="${theme.colors.success}" viewBox="0 0 16 16" style="flex-shrink: 0;">
                   <path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425z"/>
                 </svg>
                 <span style="color: ${theme.colors.textSecondary};">ID auto-detected.</span>
             `;
            this.idStatusElement.style.display = 'flex';
        } else if (manualId && detectedId && manualId !== detectedId) {
            // Manual input, differs from detected
            this.idStatusElement.innerHTML = `
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="${theme.colors.warning}" viewBox="0 0 16 16" style="flex-shrink: 0;">
                    <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
                 </svg>
                 <span style="color: ${theme.colors.textSecondary};">Manual ID (differs).</span>
             `;
            this.idStatusElement.style.display = 'flex';
        } else if (manualId && !detectedId) {
            // Manual input, no detected ID available for comparison
            this.idStatusElement.innerHTML = `
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="${theme.colors.textSecondary}" viewBox="0 0 16 16" style="flex-shrink: 0;">
                    <path fill-rule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1"/>
                    <path d="M9.5 14.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m-5 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m0-5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m5 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3"/>
                 </svg>
                 <span style="color: ${theme.colors.textSecondary};">Using manual ID.</span>
             `;
            this.idStatusElement.style.display = 'flex';
        } else if (!manualId && detectedId) {
            // Input is empty, but an ID was detected (likely cleared by user)
            this.idStatusElement.innerHTML = `
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="${theme.colors.warning}" viewBox="0 0 16 16" style="flex-shrink: 0;">
                    <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
                 </svg>
                 <span style="color: ${theme.colors.textSecondary};">Enter or paste an ID.</span>
             `;
            this.idStatusElement.style.display = 'flex';
        } else { // !manualId && !detectedId
            // Input is empty, no ID detected
            this.idStatusElement.innerHTML = `
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="${theme.colors.textTertiary}" viewBox="0 0 16 16" style="flex-shrink: 0;">
                   <path fill-rule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
                   <path d="M5.255 5.786a.237.237 0 0 0 .241.247h.825c.138 0 .248-.11.248-.247V5.786h.834v.263c0 .57-.463.942-.98.942h-.825A.98.98 0 0 1 6 6.247v-.261zm1.163.187a.25.25 0 0 0 .25.25h.825a.25.25 0 0 0 .25-.25V5.786h.834V6c0 .57-.463.942-.98.942h-.825a.98.98 0 0 1-.98-.942zm2.933 0a.25.25 0 0 0 .25.25h.825a.25.25 0 0 0 .25-.25V5.786h.834V6c0 .57-.463.942-.98.942h-.825a.98.98 0 0 1-.98-.942z"/>
                   <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0M7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0z"/>
                 </svg>
                 <span style="color: ${theme.colors.textTertiary}; font-style: italic;">No ID detected.</span>
             `;
            this.idStatusElement.style.display = 'flex';
        }
    }


    /** Creates a single form field (label + input) */
    private createFormField(
        label: string,
        name: string,
        id: string,
        placeholder: string,
        isMonospace: boolean,
    ): { container: HTMLDivElement; input: HTMLInputElement } {
        const container = document.createElement("div");
        Object.assign(container.style, {
            display: "flex",
            flexDirection: "column", // Label on top
            alignItems: "stretch",
            gap: theme.spacing.xsmall, // Standard gap
        });

        const labelElement = document.createElement("label");
        Object.assign(labelElement.style, {
            fontSize: theme.typography.fontSize.small,
            color: theme.colors.textSecondary,
            fontWeight: theme.typography.fontWeight.medium,
            paddingLeft: theme.spacing.xsmall, // Slight indent for label
        });
        labelElement.textContent = label;
        labelElement.htmlFor = id;
        container.appendChild(labelElement);

        const input = document.createElement("input");
        input.id = id;
        input.name = name;
        input.type = "text";
        input.placeholder = placeholder;
        Object.assign(input.style, {
            padding: `${theme.spacing.small} ${theme.spacing.medium}`,
            backgroundColor: theme.colors.backgroundPrimary, // Use primary background for inputs
            border: `1px solid ${theme.colors.borderPrimary}`,
            borderRadius: theme.borderRadius.small,
            color: theme.colors.textPrimary,
            fontSize: theme.typography.fontSize.small,
            outline: "none",
            transition: `border-color ${theme.transitions.duration.fast} ${theme.transitions.easing}, box-shadow ${theme.transitions.duration.fast} ${theme.transitions.easing}, background-color ${theme.transitions.duration.fast} ${theme.transitions.easing}`,
            boxSizing: "border-box",
            width: "100%",
            fontFamily: isMonospace ? "monospace" : theme.typography.fontFamily,
            height: "38px", // Consistent height
            lineHeight: "1.4",
        });

        input.addEventListener("focus", () => {
            input.style.borderColor = theme.colors.accentPrimary;
            input.style.boxShadow = `0 0 0 2px ${theme.colors.accentPrimary}40`;
        });
        input.addEventListener("blur", () => {
            input.style.borderColor = theme.colors.borderPrimary;
            input.style.boxShadow = "none";
        });

        container.appendChild(input);

        return { container, input }; // Return both elements
    }

    private addSectionHeader(title: string): void {
        // ... (Same implementation as before) ...
        const header = document.createElement("h3");
        Object.assign(header.style, {
            fontSize: theme.typography.fontSize.small,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.textSecondary,
            marginTop: theme.spacing.medium,
            marginBottom: theme.spacing.xxsmall,
            paddingBottom: theme.spacing.xxsmall,
            borderBottom: `1px solid ${theme.colors.borderSecondary}`,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
        });
        header.textContent = title;
        this.actionSidebar.getElement().appendChild(header);
    }

    /** Adds buttons, status, and feedback area to the ActionSidebar */
    private setupActionSidebar(): void {

        const actionSections: Record<string, SidebarActionConfig[]> = {
            "Data Operations": [
                {
                    label: "Export File",
                    handler: () => this.handleExportClick(),
                    type: "primary",
                },
                {
                    label: "Copy Text",
                    handler: () => this.handleCopyToClipboardClick(),
                },
            ]
        }

        const sidebarElement = this.actionSidebar.getElement();

        for (const sectionTitle in actionSections) {
            this.addSectionHeader(sectionTitle);
            actionSections[sectionTitle].forEach((action) => {
                // Add action to the ActionSidebar instance, binding 'this'
                this.actionSidebar.addAction(
                    action.label,
                    action.handler.bind(this),
                    action.type ?? "default",
                );
            });
        }

        // // --- Section Header: Actions ---
        // const actionsHeader = this.createSectionHeader("Actions");
        // sidebarElement.appendChild(actionsHeader);

        // // Export Button
        // this.actionSidebar.addAction(
        //     "Export File",
        //     () => this.handleExportClick(),
        //     "primary",
        // );

        // // Copy Button
        // this.actionSidebar.addAction(
        //     "Copy Text",
        //     () => this.handleCopyToClipboardClick(),
        //     "default",
        // );

        // --- Section Header: Status ---
        const statusHeader = this.createSectionHeader("Status");
        sidebarElement.appendChild(statusHeader);

        // ID Status Element
        this.idStatusElement = document.createElement("div");
        Object.assign(this.idStatusElement.style, {
            display: 'flex', // Use flex to align icon and text
            alignItems: 'center',
            gap: theme.spacing.xsmall,
            padding: `${theme.spacing.small} ${theme.spacing.medium}`, // Consistent padding
            fontSize: theme.typography.fontSize.small,
            color: theme.colors.textSecondary,
            borderRadius: theme.borderRadius.small,
            backgroundColor: theme.colors.backgroundSecondary, // Subtle background
            border: `1px solid ${theme.colors.borderSecondary}`,
            minHeight: '36px', // Match button height approx
            marginTop: theme.spacing.xxsmall, // Space below header
        });
        sidebarElement.appendChild(this.idStatusElement); // Add status element to sidebar

        // Feedback Area (also in sidebar)
        this.feedbackArea = document.createElement("div");
        this.feedbackArea.id = "markdown-export-feedback"; // Keep ID for potential targeting
        Object.assign(this.feedbackArea.style, {
            padding: `${theme.spacing.small} ${theme.spacing.medium}`,
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: theme.borderRadius.medium,
            border: `1px solid ${theme.colors.borderSecondary}`,
            minHeight: "40px",
            color: theme.colors.textSecondary,
            fontSize: theme.typography.fontSize.small,
            textAlign: "center",
            opacity: "0",
            transition: `all ${theme.transitions.duration.normal} ${theme.transitions.easing}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.xsmall,
            marginTop: theme.spacing.medium, // Add space above feedback
            flexShrink: "0", // Prevent shrinking
            wordBreak: 'break-word', // Allow long feedback messages to wrap
        });
        this.feedbackArea.style.display = 'none'; // Initially hidden
        sidebarElement.appendChild(this.feedbackArea); // Add feedback area to sidebar
    }

    /** Helper to create styled section headers for the sidebar */
    private createSectionHeader(title: string): HTMLHeadingElement {
        const header = document.createElement("h3");
        Object.assign(header.style, {
            fontSize: theme.typography.fontSize.small,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.textSecondary,
            marginTop: theme.spacing.medium, // Add space above headers (except first)
            marginBottom: theme.spacing.xxsmall, // Less space below header
            paddingBottom: theme.spacing.xxsmall,
            borderBottom: `1px solid ${theme.colors.borderSecondary}`,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
        });
        // Remove top margin for the very first header added to the sidebar
        if (!this.actionSidebar.getElement().querySelector('h3')) {
            header.style.marginTop = '0';
        }
        header.textContent = title;
        return header;
    }


    // --- Action Handlers and Helpers (Adapted) ---

    /** Suggests a filename based on conversation ID, requires fetching title/time */
    private async suggestFilename(conversationId: string): Promise<void> {
        if (!conversationId || !this.filenameInput) { // Check if filenameInput exists
            if (this.filenameInput) this.filenameInput.value = "";
            this.defaultFilename = "";
            return;
        }
        // Don't suggest if the user has manually entered a filename
        if (this.userModifiedFilename) return;

        const originalPlaceholder = this.filenameInput.placeholder;
        this.filenameInput.placeholder = "Generating filename...";
        this.filenameInput.disabled = true;

        try {
            const exportData = await fetchMarkdownExportData(conversationId, this.sendMessageToSW);
            this.defaultFilename = generateMarkdownFileName(
                exportData.createTime,
                exportData.title,
            );
            // Only update if the user hasn't modified it in the meantime AND element still exists
            if (
                !this.userModifiedFilename &&
                document.body.contains(this.filenameInput)
            ) {
                this.filenameInput.value = this.defaultFilename;
            }
        } catch (error) {
            console.warn("Could not auto-generate filename:", error);
            this.defaultFilename = generateMarkdownFileName(Date.now() / 1000); // Fallback default
            if (
                !this.userModifiedFilename &&
                document.body.contains(this.filenameInput)
            ) {
                this.filenameInput.value = this.defaultFilename;
            }
            // Restore placeholder even on error if element still exists
            if (document.body.contains(this.filenameInput)) {
                this.filenameInput.placeholder = "Defaults to ChatGPT_conv_Date.md";
            }
        } finally {
            // Ensure input is re-enabled if it still exists
            if (document.body.contains(this.filenameInput)) {
                this.filenameInput.disabled = false;
                // Set appropriate placeholder based on whether a value was set
                if (this.filenameInput.value) {
                    this.filenameInput.placeholder = "Defaults to ChatGPT_Title_Date.md";
                } else {
                    this.filenameInput.placeholder = originalPlaceholder; // Restore original if no value set
                }
            }
        }
    }

    /** Gets the final filename, using user input or default, ensuring .md extension */
    private getFinalFilename(): string {
        if (!this.filenameInput) return generateMarkdownFileName(Date.now() / 1000) + '.md'; // Fallback

        let finalName = this.filenameInput.value.trim();

        if (!finalName) {
            finalName =
                this.defaultFilename ||
                generateMarkdownFileName(Date.now() / 1000);
        }

        if (!finalName.toLowerCase().endsWith(".md")) {
            finalName += ".md";
        }

        // Sanitize filename (basic)
        finalName = finalName.replace(/[/\\?%*:|"<>]/g, "-");
        finalName = finalName.replace(/^\.+/, "").trim(); // Remove leading dots
        if (!finalName || finalName === ".md") { // Handle edge case of empty/invalid name
            finalName = this.defaultFilename || generateMarkdownFileName(Date.now() / 1000);
            if (!finalName.toLowerCase().endsWith(".md")) finalName += ".md";
        }
        return finalName;
    }


    /** Updates the enabled/disabled state of sidebar action buttons */
    private updateButtonStates(): void {
        // Ensure idInput is available before checking its value
        const hasId = this.idInput && this.idInput.value.trim().length > 0;
        const isDisabled = !hasId || this.isProcessing;

        // Get buttons from the sidebar instance
        const buttons = this.actionSidebar.getElement().querySelectorAll<HTMLButtonElement>('button');

        buttons.forEach(button => {
            const wasDisabled = button.disabled;
            button.disabled = isDisabled;

            // Only update styles/listeners if the state actually changed
            if (button.disabled !== wasDisabled) {
                button.style.opacity = isDisabled ? "0.5" : "1";
                button.style.cursor = isDisabled ? "not-allowed" : "pointer";

                // Reset any "processing" state visuals if becoming enabled
                if (!isDisabled && button.dataset.originalHtml) {
                    button.innerHTML = button.dataset.originalHtml;
                    delete button.dataset.originalHtml;
                    // Re-apply hover/focus/active states if needed (ActionSidebar might handle this better ideally)
                    // This part is tricky without modifying ActionSidebar. For now, just resetting content.
                    // ActionSidebar's listeners *should* still be attached unless explicitly removed.
                } else if (isDisabled && !button.dataset.originalHtml) {
                    // If becoming disabled, ensure no processing spinner is stuck
                    // (This case might be less common if setProcessingState handles it)
                    // Find span inside button to check if it's a label or spinner text
                    const span = button.querySelector('span');
                    if (span && span.textContent?.endsWith('...')) { // Basic check for spinner text
                        // Attempt to restore based on known button labels? Or store originalHTML earlier.
                        // For now, leave it, rely on setProcessingState(false) to restore.
                    }
                }
            }
        });
    }

    /** Sets the visual state for processing (loading) */
    private setProcessingState(
        isProcessing: boolean,
        actionText: string = "Processing",
        triggeredButtonText?: string, // Identify button by its text content
    ): void {
        this.isProcessing = isProcessing;
        // Get buttons *before* calling updateButtonStates if we need original state
        const buttons = this.actionSidebar.getElement().querySelectorAll<HTMLButtonElement>('button');

        const spinnerSvg = `
            <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" style="margin-right: ${theme.spacing.xsmall}; flex-shrink: 0;">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.3" stroke-width="4"></circle>
              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>`;
        const spinnerHtml = (text: string) => `${spinnerSvg}<span>${text}...</span>`;

        buttons.forEach(button => {
            const buttonSpan = button.querySelector('span');
            const buttonLabel = buttonSpan?.textContent || button.textContent || ""; // Try getting text from span first
            const isTriggered = triggeredButtonText && buttonLabel.includes(triggeredButtonText);

            if (isProcessing) {
                // Store original only if not already stored and this is the triggered button
                if (isTriggered && !button.dataset.originalHtml) {
                    button.dataset.originalHtml = button.innerHTML;
                }
                // Show spinner only on the triggered button
                if (isTriggered) {
                    button.innerHTML = spinnerHtml(actionText);
                }
                // Disable all buttons (handled by updateButtonStates called next)
            } else {
                // Restore original HTML if it was stored
                if (button.dataset.originalHtml) {
                    button.innerHTML = button.dataset.originalHtml;
                    delete button.dataset.originalHtml;
                }
                // Re-enable buttons (handled by updateButtonStates called after this function finishes)
            }
        });

        // Update button enabled/disabled states based on new isProcessing value
        this.updateButtonStates();

        // Show feedback *after* updating buttons
        if (isProcessing) {
            this.displayFeedback(`⏳ ${actionText}...`, "loading", 0);
        }
    }


    /** Fetches export data from the service worker */
    private async fetchExportDataInternal(
        conversationId: string,
    ): Promise<ExportData | null> {
        if (!conversationId) {
            this.displayFeedback("Please provide a Conversation ID.", "error");
            return null;
        }
        // Feedback is handled by setProcessingState

        try {
            const response = await fetchMarkdownExportData(conversationId, this.sendMessageToSW);
            return response;
        } catch (error) {
            // Display error *after* resetting processing state
            this.setProcessingState(false); // Ensure buttons are usable
            this.displayFeedback(error as Error, "error");
            return null;
        }
    }

    /** Handles the Export button click */
    private async handleExportClick(): Promise<void> {
        const conversationId = this.idInput?.value.trim();
        if (!conversationId || this.isProcessing) return;

        this.setProcessingState(true, "Exporting", "Export File");
        let success = false; // Track success

        try {
            const exportData = await this.fetchExportDataInternal(conversationId);

            if (exportData) {
                const finalFilename = this.getFinalFilename();
                downloadTextFile(
                    exportData.markdownContent,
                    finalFilename,
                    "text/markdown;charset=utf-8",
                );
                this.displayFeedback(
                    `✅ Exported: ${finalFilename}`,
                    "success",
                    7000,
                );
                // Reset filename modification state ONLY if the current filename matches the suggested one
                if (this.filenameInput && this.filenameInput.value === this.defaultFilename) {
                    this.userModifiedFilename = false;
                    // Re-suggest might not be necessary if ID didn't change, but safe to call
                    this.suggestFilename(conversationId);
                }
                success = true;
            }
            // If exportData is null, fetchExportDataInternal already handled the error display
        } catch (error) { // Catch errors during downloadTextFile or getFinalFilename
            this.displayFeedback("Error during file preparation or download.", "error");
            console.error("File export process error:", error);
        } finally {
            // Always reset processing state, slight delay helps UI responsiveness
            setTimeout(() => {
                this.setProcessingState(false);
                // Ensure button states are correct after processing
                this.updateButtonStates();
            }, 100);
        }
    }

    /** Handles the Copy button click */
    private async handleCopyToClipboardClick(): Promise<void> {
        const conversationId = this.idInput?.value.trim();
        if (!conversationId || this.isProcessing) return;

        this.setProcessingState(true, "Copying", "Copy Text");
        let success = false;

        try {
            const exportData = await this.fetchExportDataInternal(conversationId);

            if (exportData) {
                await navigator.clipboard.writeText(exportData.markdownContent);
                this.displayFeedback(
                    `✅ Copied Markdown to clipboard!`,
                    "success",
                    5000,
                );
                success = true;
            }
            // Error display handled by fetchExportDataInternal if null
        } catch (error) { // Catch clipboard write errors
            this.displayFeedback("Failed to copy to clipboard.", "error");
            console.error("Clipboard write error:", error);
        } finally {
            // Always reset processing state
            setTimeout(() => {
                this.setProcessingState(false);
                this.updateButtonStates();
            }, 100);
        }
    }

    /** Displays feedback messages in the sidebar's feedback area */
    private displayFeedback(
        message: string | Error,
        type: "success" | "error" | "loading" | "info" | "warning",
        autoHideDelay?: number,
    ): void {
        if (!this.feedbackArea) {
            console.error("Feedback area not initialized in MarkdownExportTab.");
            return;
        }

        let messageText: string;
        let effectiveType = type;
        let iconHtml = "";

        // Determine message text and icon based on type
        if (message instanceof Error) {
            effectiveType = "error";
            iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-circle-fill" viewBox="0 0 16 16" style="flex-shrink: 0;"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293z"/></svg>`;
            messageText = `Error: ${message.message || "Unknown error"}`; // Simplified error message
        } else {
            messageText = message;
            switch (effectiveType) {
                case "success":
                    iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-circle-fill" viewBox="0 0 16 16" style="flex-shrink: 0;"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>`;
                    break;
                case "warning":
                    iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-exclamation-triangle-fill" viewBox="0 0 16 16" style="flex-shrink: 0;"><path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2"/></svg>`;
                    break;
                case "loading":
                    iconHtml = `<svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" style="flex-shrink: 0;"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.3" stroke-width="4"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
                    break;
                case "info":
                    iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-info-circle-fill" viewBox="0 0 16 16" style="flex-shrink: 0;"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m.93-9.412l-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM8 5.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2"/></svg>`; // Updated info icon
                    break;
            }
        }

        // Set content and make visible
        const spanElement = document.createElement('span');
        spanElement.textContent = messageText;
        // Apply specific styles to the text span if needed, e.g., for wrapping
        Object.assign(spanElement.style, {
            overflowWrap: 'break-word', // Ensure long text wraps
            wordWrap: 'break-word', // Older browsers
            textAlign: 'left', // Align text left within the feedback area
            flexGrow: '1', // Allow span to take available width
        });

        this.feedbackArea.innerHTML = iconHtml; // Set icon
        this.feedbackArea.appendChild(spanElement); // Append text span
        this.feedbackArea.style.display = messageText ? "flex" : "none"; // Use flex for icon+text alignment
        this.feedbackArea.style.justifyContent = 'flex-start'; // Align icon/text to the left

        // Apply styles based on type
        let bgColor = theme.colors.backgroundSecondary;
        let textColor = theme.colors.textSecondary;
        let borderColor = theme.colors.borderSecondary;

        switch (effectiveType) {
            case "success":
                bgColor = `${theme.colors.success}1A`; // Lighter background
                textColor = theme.colors.success;
                borderColor = `${theme.colors.success}60`; // Softer border
                break;
            case "error":
                bgColor = `${theme.colors.error}1A`;
                textColor = theme.colors.error;
                borderColor = `${theme.colors.error}60`;
                break;
            case "warning":
                bgColor = `${theme.colors.warning}1A`;
                textColor = theme.colors.warning;
                borderColor = `${theme.colors.warning}60`;
                break;
            case "loading":
            case "info":
                bgColor = theme.colors.backgroundActive;
                textColor = theme.colors.textSecondary;
                borderColor = theme.colors.borderPrimary;
                break;
        }

        this.feedbackArea.style.backgroundColor = bgColor;
        this.feedbackArea.style.color = textColor; // Set text color for icon/span
        this.feedbackArea.style.borderColor = borderColor;

        // Ensure the icon inherits the text color
        const svgIcon = this.feedbackArea.querySelector('svg');
        if (svgIcon) {
            svgIcon.style.fill = textColor; // Use fill for SVG color
            svgIcon.style.flexShrink = '0'; // Prevent icon shrinking
        }


        // Trigger fade-in animation
        requestAnimationFrame(() => {
            this.feedbackArea.style.opacity = "1";
        });

        // --- Auto-hide logic ---
        const existingTimeout = Number(
            this.feedbackArea.dataset.hideTimeoutId || 0,
        );
        if (existingTimeout) clearTimeout(existingTimeout);
        this.feedbackArea.dataset.hideTimeoutId = "";

        if (autoHideDelay && autoHideDelay > 0 && effectiveType !== "loading") {
            const fadeDuration = parseInt(theme.transitions.duration.normal || '300');
            const timeoutId = setTimeout(() => {
                const currentSpanContent =
                    this.feedbackArea.querySelector("span")?.textContent;
                // Only hide if the message hasn't changed
                if (this.feedbackArea && currentSpanContent === messageText) {
                    this.feedbackArea.style.opacity = "0";
                    setTimeout(() => {
                        if (
                            this.feedbackArea &&
                            this.feedbackArea.style.opacity === "0"
                        ) {
                            this.feedbackArea.style.display = "none";
                        }
                    }, fadeDuration);
                }
            }, autoHideDelay);
            this.feedbackArea.dataset.hideTimeoutId = String(timeoutId);
        } else if (effectiveType === "loading") {
            // Ensure loading message stays visible and opaque
            this.feedbackArea.style.opacity = "1";
        }
    }
}

// Note: Animation styles injection is now handled within the class static method.
