// packages/content-script/src/components/tabs/AdvanceTab.ts

import { theme } from "@shared";
import { ActionSidebar } from "../ActionSidebar";

// --- Import API Utils ---
import {
    fetchConversations,
    fetchConversationDetail,
    deleteConversationById,
    shareConversation,
    archiveConversation,
    renameConversation,
    generateAutocompletions,
    sendCopyFeedback,
    fetchAudioData,
    fetchConversationMessageIds,
    fetchConversationMessages,
    fetchConversationContext,
    markMessageThumbsUp,
    markMessageThumbsDown,
    fetchMarkdownExportData,
    fetchConversationAuthorCounts,
} from "../../utils/apiUtils";

// --- Import Download & Filename Utils ---
import {
    triggerAudioDownload,
    downloadTextFile,
} from "../../utils/downloadUtils";
import { generateMarkdownFileName } from "../../utils/exportUtils";

// --- Type Definitions ---
type SidebarActionType = "primary" | "danger" | "default";
interface SidebarActionConfig {
    label: string;
    handler: () => void | Promise<void>;
    type?: SidebarActionType;
}

export class AdvanceTab {
    private element: HTMLDivElement; // Main container for the tab (flex row: sidebar + mainPanel)
    private actionSidebar: ActionSidebar; // The sidebar component instance
    private mainPanel: HTMLDivElement; // Area for form inputs and brief feedback
    private feedbackContainer: HTMLDivElement; // Area for brief feedback messages within mainPanel
    private resultsPanel: HTMLDivElement | null = null; // The separate popup results panel

    constructor() {
        console.log("AdvanceTab initialized");

        this.element = document.createElement("div");
        Object.assign(this.element.style, {
            display: "flex",
            width: "100%",
            height: "100%",
            overflow: "hidden",
        });

        // Create Sidebar
        this.actionSidebar = new ActionSidebar();
        this.element.appendChild(this.actionSidebar.getElement());

        // Create Main Panel (for inputs and feedback area)
        this.mainPanel = this.createMainPanel();
        this.element.appendChild(this.mainPanel);

        // Create Input Fields within Main Panel
        this.createInputFields();

        // Create Feedback Area within Main Panel
        this.feedbackContainer = this.createFeedbackContainer();
        this.mainPanel.appendChild(this.feedbackContainer);

        // Setup Action Buttons on the Sidebar
        this.setupActionButtons();
    }

    /** Returns the root HTML element for this tab */
    getElement(): HTMLDivElement {
        return this.element;
    }

    /** Updates context - currently logs and updates conversation ID input */
    updateConversationId(conversationId: string | null): void {
        console.log(
            `AdvanceTab: Conversation ID updated to: ${conversationId}`,
        );
        const convoIdInput = this.mainPanel.querySelector<HTMLInputElement>(
            'input[name="conversationid"]',
        );
        if (convoIdInput) {
            convoIdInput.value = conversationId ?? "";
        }
        // Could potentially disable/enable some sidebar actions based on ID presence
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
            gap: theme.spacing.large,
        });
        return panel;
    }

    private createInputFields(): void {
        // ... (Same implementation as before, creates the grid and fields) ...
        const formContainer = document.createElement("div");
        Object.assign(formContainer.style, {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: theme.spacing.medium,
        });
        const fields = [
            {
                label: "Offset",
                name: "offset",
                type: "number",
                defaultValue: "0",
            },
            {
                label: "Limit",
                name: "limit",
                type: "number",
                defaultValue: "28",
            },
            {
                label: "Order",
                name: "order",
                type: "text",
                defaultValue: "updated",
            },
            {
                label: "Conversation ID",
                name: "conversationid",
                type: "text",
                defaultValue: "",
            },
            {
                label: "Current Node ID",
                name: "currentnodeid",
                type: "text",
                defaultValue: "",
            },
            {
                label: "New Title",
                name: "newtitle",
                type: "text",
                defaultValue: "",
            },
            {
                label: "Input Text (Autocomplete)",
                name: "inputtext",
                type: "text",
                defaultValue: "",
            },
            {
                label: "Num Completions",
                name: "numcompletions",
                type: "number",
                defaultValue: "4",
            },
            { label: "In Search Mode", name: "insearchmode", type: "checkbox" },
            {
                label: "Message ID",
                name: "messageid",
                type: "text",
                defaultValue: "",
            },
            {
                label: "Selected Text (Feedback)",
                name: "selectedtext",
                type: "text",
                defaultValue: "",
            },
            {
                label: "Audio Voice",
                name: "voice",
                type: "text",
                defaultValue: "orbit",
            },
            {
                label: "Audio Format",
                name: "format",
                type: "text",
                defaultValue: "aac",
            },
        ];
        fields.forEach((field) => {
            formContainer.appendChild(
                this.createFormField(
                    field.label,
                    field.name,
                    field.type,
                    field.defaultValue,
                ),
            );
        });
        this.mainPanel.appendChild(formContainer);
    }

    private createFormField(
        label: string,
        name: string,
        type: string,
        defaultValue?: string,
    ): HTMLDivElement {
        const container = document.createElement("div");
        const labelElement = document.createElement("label");
        const input = document.createElement("input");

        // --- Common Label Styling ---
        Object.assign(labelElement.style, {
            fontSize: theme.typography.fontSize.small,
            color: theme.colors.textSecondary,
            fontWeight: theme.typography.fontWeight.medium, // Default weight
            flexShrink: "0", // Prevent label from shrinking
        });
        labelElement.textContent = label;
        labelElement.htmlFor = `adv-input-${name}`;

        // --- Input Setup ---
        input.type = type;
        input.name = name;
        input.id = `adv-input-${name}`;

        if (type === "checkbox") {
            // --- Checkbox Specific Styling & Layout ---
            Object.assign(container.style, {
                display: "flex",
                flexDirection: "row", // Label first, then checkbox
                alignItems: "center",
                gap: theme.spacing.small, // Increased gap
                padding: theme.spacing.small, // Add padding around
                backgroundColor: `${theme.colors.accentPrimary}15`, // Subtle accent background (15% opacity)
                border: `1px solid ${theme.colors.accentPrimary}50`, // Subtle accent border (50% opacity)
                borderRadius: theme.borderRadius.medium, // Rounded corners for the container
                marginTop: theme.spacing.xsmall, // Add a bit of top margin to separate visually if needed
            });

            // Make label bold for checkboxes
            labelElement.style.fontWeight = theme.typography.fontWeight.bold;
            labelElement.style.color = theme.colors.textPrimary; // Make label text darker for contrast

            // Style the checkbox input itself
            Object.assign(input.style, {
                accentColor: theme.colors.accentPrimary,
                width: "20px", // Larger checkbox
                height: "20px", // Larger checkbox
                cursor: "pointer",
                margin: "0", // Remove default margins if any
            });
            (input as HTMLInputElement).checked = defaultValue === "true";

            // Append in label -> input order
            container.appendChild(labelElement);
            container.appendChild(input);

        } else {
            // --- Text/Number/Other Input Styling & Layout ---
            Object.assign(container.style, {
                display: "flex",
                flexDirection: "column", // Label on top
                alignItems: "stretch",
                gap: theme.spacing.xsmall, // Standard gap
            });

            Object.assign(input.style, {
                padding: `${theme.spacing.xsmall} ${theme.spacing.small}`,
                backgroundColor: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.borderPrimary}`,
                borderRadius: theme.borderRadius.small,
                color: theme.colors.textPrimary,
                fontSize: theme.typography.fontSize.small,
                outline: "none",
                transition: `all ${theme.transitions.duration.fast} ${theme.transitions.easing}`,
                boxSizing: "border-box",
                width: "100%",
            });
            input.value = defaultValue || "";
            input.placeholder = `Enter ${label}...`;

            // Focus/Blur styling for non-checkbox inputs
            input.addEventListener("focus", () => {
                input.style.borderColor = theme.colors.accentPrimary;
                input.style.boxShadow = `0 0 0 1px ${theme.colors.accentPrimary}60`;
            });
            input.addEventListener("blur", () => {
                input.style.borderColor = theme.colors.borderPrimary;
                input.style.boxShadow = "none";
            });

            // Append in label -> input order
            container.appendChild(labelElement);
            container.appendChild(input);
        }

        return container;
    }

    /** Creates the area for brief inline feedback messages */
    private createFeedbackContainer(): HTMLDivElement {
        const feedbackDiv = document.createElement("div");
        feedbackDiv.id = "advance-tab-feedback"; // Give it an ID
        Object.assign(feedbackDiv.style, {
            marginTop: theme.spacing.medium,
            padding: theme.spacing.medium,
            backgroundColor: theme.colors.backgroundPrimary, // Slightly different BG maybe
            borderRadius: theme.borderRadius.small,
            border: `1px solid ${theme.colors.borderSecondary}`,
            minHeight: "40px",
            color: theme.colors.textSecondary,
            fontSize: theme.typography.fontSize.small,
            fontStyle: "italic",
            display: "flex",
            alignItems: "center",
            justifyContent: "center", // Center align text
            textAlign: "center",
            transition: "color 0.3s ease", // Transition color change
        });
        feedbackDiv.textContent = "Action feedback will appear here briefly.";
        return feedbackDiv;
    }

    // --- Results Popup Panel Methods (Adapted from old code) ---

    private createResultsPanel(): HTMLDivElement {
        const panel = document.createElement("div");
        panel.id = "advancetab-results-panel"; // Unique ID
        Object.assign(panel.style, {
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(800px, 90vw)",
            maxHeight: "80vh",
            backgroundColor: theme.colors.backgroundPrimary,
            borderRadius: theme.borderRadius.medium,
            boxShadow: theme.shadows.xlarge,
            zIndex: "10001", // Higher than main window overlay
            border: `1px solid ${theme.colors.borderPrimary}`,
            display: "flex",
            flexDirection: "column",
            opacity: "0",
            transition: `opacity ${theme.transitions.duration.normal} ${theme.transitions.easing}`,
        });
        panel.appendChild(this.createResultsHeader());
        panel.appendChild(this.createResultsContent());
        return panel;
    }

    private createResultsHeader(): HTMLDivElement {
        const header = document.createElement("div");
        Object.assign(header.style, {
            padding: theme.spacing.medium,
            borderBottom: `1px solid ${theme.colors.borderPrimary}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: "0",
        });
        const title = document.createElement("h3");
        Object.assign(title.style, {
            margin: "0",
            fontSize: theme.typography.fontSize.medium,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.textPrimary,
        });
        title.textContent = "Action Result";
        header.appendChild(title);
        header.appendChild(
            this.createCloseButton(() => this.closeResultsPanel()),
        );
        return header;
    }

    private createResultsContent(): HTMLDivElement {
        const content = document.createElement("div");
        content.id = "advancetab-results-content"; // ID for easier targeting
        Object.assign(content.style, {
            padding: theme.spacing.medium,
            overflowY: "auto",
            flexGrow: "1",
            maxHeight: "calc(80vh - 60px)", // Adjust based on header height
            minHeight: "100px", // Ensure some minimum content height
        });
        return content;
    }

    private createCloseButton(handler: () => void): HTMLButtonElement {
        const button = document.createElement("button");
        Object.assign(button.style, {
            backgroundColor: "transparent",
            border: "none",
            padding: "0",
            cursor: "pointer",
            color: theme.colors.textSecondary,
            width: "28px",
            height: "28px",
            borderRadius: theme.borderRadius.small,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            transition: `all ${theme.transitions.duration.fast} ${theme.transitions.easing}`,
        });
        button.innerHTML = "✕"; // Cross symbol
        button.title = "Close Results";
        button.addEventListener("click", handler);
        button.addEventListener("mouseover", () =>
            Object.assign(button.style, {
                backgroundColor: theme.colors.backgroundHover,
                color: theme.colors.textPrimary,
            }),
        );
        button.addEventListener("mouseout", () =>
            Object.assign(button.style, {
                backgroundColor: "transparent",
                color: theme.colors.textSecondary,
            }),
        );
        return button;
    }

    private closeResultsPanel(): void {
        if (this.resultsPanel) {
            const panel = this.resultsPanel;
            this.resultsPanel = null; // Clear reference

            const handleTransitionEnd = (event: TransitionEvent) => {
                if (
                    event.propertyName === "opacity" &&
                    event.target === panel
                ) {
                    panel.remove(); // Remove from DOM after fade out
                    panel.removeEventListener(
                        "transitionend",
                        handleTransitionEnd,
                    );
                }
            };
            panel.style.opacity = "0"; // Start fade out
            panel.addEventListener("transitionend", handleTransitionEnd);

            // Fallback removal after timeout
            setTimeout(() => {
                if (document.body.contains(panel)) {
                    panel.remove();
                    panel.removeEventListener(
                        "transitionend",
                        handleTransitionEnd,
                    );
                }
            }, 500); // Slightly longer than transition
        }
    }

    // --- Display Logic (Modified) ---

    private displayLoading(): void {
        // Show loading in the *inline* feedback area
        this.feedbackContainer.textContent = "⏳ Loading...";
        this.feedbackContainer.style.color = theme.colors.textSecondary;
        this.feedbackContainer.style.fontStyle = "normal";
    }

    private displayResults(response: any): void {
        this.closeResultsPanel(); // Close any previous popup
        this.resultsPanel = this.createResultsPanel(); // Create the popup structure
        const content = this.resultsPanel.querySelector(
            "#advancetab-results-content",
        ) as HTMLDivElement;
        if (!content) return;

        const pre = document.createElement("pre");
        Object.assign(pre.style, {
            margin: 0,
            padding: theme.spacing.medium,
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: theme.borderRadius.small,
            color: theme.colors.success, // Use success color for result text
            fontSize: theme.typography.fontSize.small,
            lineHeight: theme.typography.lineHeight.medium,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflow: "auto",
            maxHeight: "calc(80vh - 100px)", // Ensure pre doesn't overflow content div
        });

        let displayText = "";
        // Simplified display logic for the popup
        if (typeof response === "object" && response !== null) {
            displayText = JSON.stringify(response, null, 2); // Pretty print JSON
        } else {
            displayText = String(response ?? "No data received."); // Handle null/undefined
        }
        pre.textContent = `✅ Success:\n\n${displayText}`; // Add success prefix

        content.appendChild(pre);
        document.body.appendChild(this.resultsPanel); // Add popup to body
        requestAnimationFrame(() => {
            // Start fade-in animation
            if (this.resultsPanel) this.resultsPanel.style.opacity = "1";
        });

        // Clear the inline feedback area
        this.updateResultsFeedback("Action completed successfully.", false);
    }

    private displayError(error: Error): void {
        this.closeResultsPanel(); // Close any previous popup
        this.resultsPanel = this.createResultsPanel(); // Create the popup structure
        const content = this.resultsPanel.querySelector(
            "#advancetab-results-content",
        ) as HTMLDivElement;
        if (!content) return;

        const errorDiv = document.createElement("div");
        Object.assign(errorDiv.style, {
            backgroundColor: `${theme.colors.error}20`,
            border: `1px solid ${theme.colors.error}`,
            borderRadius: theme.borderRadius.small,
            padding: theme.spacing.medium,
            color: theme.colors.error,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflow: "auto",
            fontFamily: "monospace",
            fontSize: theme.typography.fontSize.small,
            maxHeight: "calc(80vh - 100px)", // Ensure div doesn't overflow content
        });
        errorDiv.textContent = `❌ Error: ${error.name || "Unknown Error"}\n\nMessage:\n${error.message || "No message provided."}${error.stack ? `\n\nStack Trace:\n${error.stack}` : ""}`;

        content.appendChild(errorDiv);
        document.body.appendChild(this.resultsPanel); // Add popup to body
        requestAnimationFrame(() => {
            // Start fade-in animation
            if (this.resultsPanel) this.resultsPanel.style.opacity = "1";
        });

        // Also show error briefly in the inline feedback
        this.updateResultsFeedback(`Error: ${error.message}`, true);
    }

    /** Displays temporary feedback in the inline container */
    private updateResultsFeedback(
        message: string,
        isError: boolean = false,
    ): void {
        this.feedbackContainer.textContent = message;
        this.feedbackContainer.style.color = isError
            ? theme.colors.error
            : theme.colors.success; // Use appropriate color
        this.feedbackContainer.style.fontStyle = "normal";

        // Optional: Clear feedback after a delay
        setTimeout(() => {
            if (this.feedbackContainer.textContent === message) {
                // Avoid clearing newer messages
                this.feedbackContainer.textContent =
                    "Action feedback will appear here briefly.";
                this.feedbackContainer.style.color = theme.colors.textSecondary;
                this.feedbackContainer.style.fontStyle = "italic";
            }
        }, 5000); // Clear after 5 seconds
    }

    // --- Action Button Setup ---
    private setupActionButtons(): void {
        // ... (actionSections definition remains the same) ...
        const actionSections: Record<string, SidebarActionConfig[]> = {
            "Data Operations": [
                {
                    label: "View All Chats",
                    handler: () => this.handleFetchList(),
                },
                {
                    label: "View Specific Chat",
                    handler: () => this.handleFetchOne(),
                },
                {
                    label: "Remove Chat",
                    handler: () => this.handleDelete(),
                    type: "danger",
                },
            ],
            "Item Management": [
                { label: "Share Chat", handler: () => this.handleShare() },
                { label: "Archive Chat", handler: () => this.handleArchive() },
                {
                    label: "Rename Chat",
                    handler: () => this.handleRename(),
                    type: "primary",
                },
            ],
            Enhancements: [
                {
                    label: "Gen Autocomplete",
                    handler: () => this.handleGenerateAutocompletions(),
                },
                {
                    label: "Send Copy Feedback",
                    handler: () => this.handleSendCopyFeedback(),
                },
                {
                    label: "Download Audio",
                    handler: () => this.handleGetAudio(),
                },
                {
                    label: "Export Markdown",
                    handler: () => this.handleExportConversationAsMarkdown(),
                },
            ],
            Analysis: [
                {
                    label: "List Message IDs",
                    handler: () => this.handleConversationMessageIds(),
                },
                {
                    label: "View Messages",
                    handler: () => this.handleConversationMessages(),
                },
                {
                    label: "View Context",
                    handler: () => this.handleConversationContext(),
                },
                {
                    label: "Mark Helpful (👍)",
                    handler: () => this.handleMarkMessageAsThumbsUp(),
                },
                {
                    label: "Mark Unhelpful (👎)",
                    handler: () => this.handleMarkMessageAsThumbsDown(),
                },
                {
                    label: "Count Authors",
                    handler: () => this.handleConversationAuthorCounts(),
                },
            ],
        };

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

    // --- Form Value Retrieval ---
    private getFormValues(): Record<string, string | boolean> {
        // ... (Same implementation as before) ...
        const formValues: Record<string, string | boolean> = {};
        this.mainPanel.querySelectorAll("input").forEach((input) => {
            if (input.name) {
                if (input.type === "checkbox") {
                    formValues[input.name] = input.checked;
                } else {
                    formValues[input.name] = input.value;
                }
            }
        });
        console.log("Form Values:", formValues);
        return formValues;
    }

    // --- Action Handlers (Modified for separate results/feedback) ---

    private async handleFetchList(): Promise<void> {
        this.displayLoading(); // Show inline loading
        try {
            const { offset, limit, order } = this.getFormValues();
            const result = await fetchConversations({ offset, limit, order });
            this.displayResults(result); // Show result in popup panel
        } catch (error) {
            this.displayError(error as Error);
        } // Show error in popup panel
    }

    private async handleFetchOne(): Promise<void> {
        const { conversationid } = this.getFormValues();
        this.displayLoading();
        try {
            const result = await fetchConversationDetail(
                conversationid as string,
            );
            this.displayResults(result); // Show result in popup
        } catch (error) {
            this.displayError(error as Error);
        } // Show error in popup
    }

    private async handleDelete(): Promise<void> {
        const { conversationid } = this.getFormValues();
        if (!conversationid) {
            this.displayError(new Error("Conversation ID required."));
            return;
        }
        if (!confirm(`Delete conversation ${conversationid}?`)) return;
        this.displayLoading();
        try {
            const result = await deleteConversationById(
                conversationid as string,
            );
            // Show brief feedback inline, potentially full result in popup
            this.updateResultsFeedback(
                `Conversation ${conversationid} marked deleted.`,
            );
            // Optionally display detailed 'result' object in popup if needed:
            this.displayResults({
                message: `Conversation ${conversationid} marked deleted.`,
                details: result,
            });
        } catch (error) {
            this.displayError(error as Error);
        } // Show error in popup
    }

    // ... Other handlers similarly adapted ...

    private async handleShare(): Promise<void> {
        const { conversationid, currentnodeid } = this.getFormValues();
        this.displayLoading();
        try {
            const result = await shareConversation({
                conversationId: conversationid as string,
                currentNodeId: currentnodeid as string,
            });
            this.displayResults(result); // Show share URL etc. in popup
        } catch (error) {
            this.displayError(error as Error);
        }
    }

    private async handleArchive(): Promise<void> {
        const { conversationid } = this.getFormValues();
        this.displayLoading();
        try {
            const result = await archiveConversation(conversationid as string);
            this.updateResultsFeedback(
                `Conversation ${conversationid} archived.`,
            );
            this.displayResults({
                message: `Conversation ${conversationid} archived.`,
                details: result,
            }); // Optional popup
        } catch (error) {
            this.displayError(error as Error);
        }
    }

    private async handleRename(): Promise<void> {
        const { conversationid, newtitle } = this.getFormValues();
        this.displayLoading();
        try {
            const result = await renameConversation(
                conversationid as string,
                newtitle as string,
            );
            this.updateResultsFeedback(
                `Conversation ${conversationid} renamed.`,
            );
            this.displayResults({
                message: `Conversation ${conversationid} renamed.`,
                details: result,
            }); // Optional popup
        } catch (error) {
            this.displayError(error as Error);
        }
    }

    private async handleGenerateAutocompletions(): Promise<void> {
        const { inputtext, numcompletions, insearchmode } =
            this.getFormValues();
        this.displayLoading();
        try {
            const result = await generateAutocompletions({
                inputText: inputtext as string,
                numCompletions: numcompletions,
                inSearchMode: insearchmode,
            });
            this.displayResults(result); // Show results in popup
        } catch (error) {
            this.displayError(error as Error);
        }
    }

    private async handleSendCopyFeedback(): Promise<void> {
        const { messageid, conversationid, selectedtext } =
            this.getFormValues();
        this.displayLoading();
        try {
            const result = await sendCopyFeedback({
                messageId: messageid as string,
                conversationId: conversationid as string,
                selectedText: selectedtext as string,
            });
            this.updateResultsFeedback(
                `Feedback sent for message ${messageid}.`,
            );
            this.displayResults({
                message: `Feedback sent for message ${messageid}.`,
                details: result,
            }); // Optional popup
        } catch (error) {
            this.displayError(error as Error);
        }
    }

    private async handleGetAudio(): Promise<void> {
        const { messageid, conversationid, voice, format } =
            this.getFormValues();
        this.displayLoading();
        try {
            const audioData = await fetchAudioData({
                messageId: messageid as string,
                conversationId: conversationid as string,
                voice: voice as string,
                format: format as string,
            });
            triggerAudioDownload(
                audioData.dataUrl,
                audioData.messageId,
                audioData.format,
            );
            this.updateResultsFeedback(
                `Audio download initiated for ${audioData.messageId}.`,
            ); // Inline feedback is sufficient
        } catch (error) {
            this.displayError(error as Error);
        } // Show error in popup if fetch fails
    }

    private async handleExportConversationAsMarkdown(): Promise<void> {
        const { conversationid } = this.getFormValues();
        this.displayLoading();
        try {
            const exportData = await fetchMarkdownExportData(
                conversationid as string,
            );
            const fileName = generateMarkdownFileName(exportData.createTime);
            downloadTextFile(
                exportData.markdownContent,
                fileName,
                "text/markdown;charset=utf-8",
            );
            this.updateResultsFeedback(
                `Markdown export '${fileName}' initiated.`,
            ); // Inline feedback is sufficient
        } catch (error) {
            this.displayError(error as Error);
        } // Show error in popup if fetch fails
    }

    private async handleConversationMessageIds(): Promise<void> {
        const { conversationid } = this.getFormValues();
        this.displayLoading();
        try {
            const result = await fetchConversationMessageIds(
                conversationid as string,
            );
            this.displayResults(result);
        } catch (error) {
            this.displayError(error as Error);
        }
    }
    private async handleConversationMessages(): Promise<void> {
        const { conversationid } = this.getFormValues();
        this.displayLoading();
        try {
            const result = await fetchConversationMessages(
                conversationid as string,
            );
            this.displayResults(result);
        } catch (error) {
            this.displayError(error as Error);
        }
    }
    private async handleConversationContext(): Promise<void> {
        const { conversationid } = this.getFormValues();
        this.displayLoading();
        try {
            const result = await fetchConversationContext(
                conversationid as string,
            );
            this.displayResults(result);
        } catch (error) {
            this.displayError(error as Error);
        }
    }
    private async handleMarkMessageAsThumbsUp(): Promise<void> {
        const { messageid, conversationid } = this.getFormValues();
        this.displayLoading();
        try {
            const result = await markMessageThumbsUp({
                messageId: messageid as string,
                conversationId: conversationid as string,
            });
            this.updateResultsFeedback(
                `Marked helpful: ${messageid}.`,
            ); /* Optional: this.displayResults(result); */
            this.displayResults(result);
        } catch (error) {
            this.displayError(error as Error);
        }
    }
    private async handleMarkMessageAsThumbsDown(): Promise<void> {
        const { messageid, conversationid } = this.getFormValues();
        this.displayLoading();
        try {
            const result = await markMessageThumbsDown({
                messageId: messageid as string,
                conversationId: conversationid as string,
            });
            this.updateResultsFeedback(
                `Marked unhelpful: ${messageid}.`,
            ); /* Optional: this.displayResults(result); */
            this.displayResults(result);
        } catch (error) {
            this.displayError(error as Error);
        }
    }
    private async handleConversationAuthorCounts(): Promise<void> {
        const { conversationid } = this.getFormValues();
        this.displayLoading();
        try {
            const result = await fetchConversationAuthorCounts(
                conversationid as string,
            );
            this.displayResults(result);
        } catch (error) {
            this.displayError(error as Error);
        }
    }
}

