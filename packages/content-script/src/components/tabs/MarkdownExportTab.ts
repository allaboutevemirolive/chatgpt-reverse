// packages/content-script/src/components/tabs/MarkdownExportTab.ts
import { theme } from "@shared";
import { MarkdownExport } from "@/constants/tabConfig";
import { downloadTextFile } from "@/utils/downloadUtils";
import { generateMarkdownFileName } from "@/utils/exportUtils";
import { SendMessageToSW } from "@/utils/swMessenger";

export class MarkdownExportTab {
    private rootElement: HTMLDivElement;
    private idInput!: HTMLInputElement;
    private idNote!: HTMLParagraphElement;
    private exportButton!: HTMLButtonElement;
    private feedbackArea!: HTMLDivElement;
    private sendMessageToSW: SendMessageToSW;

    constructor(sendMessageFunction: SendMessageToSW) {
        this.sendMessageToSW = sendMessageFunction;
        this.rootElement = this.buildUI();
        this.updateConversationId(null);
    }

    public getElement(): HTMLDivElement {
        return this.rootElement;
    }

    public updateConversationId(id: string | null): void {
        if (!this.idInput || !this.idNote) {
            console.warn(
                "MarkdownExportTab: UI elements not ready for updateConversationId.",
            );
            return;
        }

        if (id) {
            this.idInput.value = id;
            this.idNote.innerHTML = `✓ <span style="color: ${theme.colors.textSecondary};">Conversation ID automatically detected.</span>`; // Use success color for icon only
            this.idNote.style.color = theme.colors.success; // Color for the icon
            this.idInput.style.borderColor = theme.colors.borderPrimary; // Reset border
        } else {
            // Keep existing value if user might have pasted one
            this.idNote.innerHTML = `⚠ <span style="color: ${theme.colors.textSecondary};">No conversation detected. Paste ID or navigate to one.</span>`;
            this.idNote.style.color = theme.colors.warning; // Color for the icon
        }
        // Reset focus styles if needed (blur does this, but good safety)
        if (document.activeElement !== this.idInput) {
            this.idInput.style.borderColor = theme.colors.borderPrimary;
            this.idInput.style.boxShadow = "none";
        }
    }

    private buildUI(): HTMLDivElement {
        const container = document.createElement("div");
        Object.assign(container.style, {
            display: "flex",
            flexDirection: "column",
            gap: theme.spacing.large,
            padding: theme.spacing.large,
            boxSizing: "border-box",
            height: "100%",
        });

        // 1. Header Section
        const header = document.createElement("h2");
        Object.assign(header.style, {
            margin: "0",
            fontSize: theme.typography.fontSize.large,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.textPrimary,
            borderBottom: `1px solid ${theme.colors.borderSecondary}`,
            paddingBottom: theme.spacing.medium,
            flexShrink: "0",
        });
        header.textContent = MarkdownExport.label;
        container.appendChild(header);

        // 2. Main Content Area (Scrollable)
        const mainArea = document.createElement("div");
        Object.assign(mainArea.style, {
            flexGrow: "1",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: theme.spacing.large, // Increased gap
            paddingRight: theme.spacing.small, // Space for scrollbar if needed
        });
        container.appendChild(mainArea);

        // Description
        const description = document.createElement("p");
        Object.assign(description.style, {
            color: theme.colors.textSecondary,
            fontSize: theme.typography.fontSize.small,
            lineHeight: theme.typography.lineHeight.medium,
            margin: "0",
            flexShrink: "0",
        });
        description.innerHTML = `Export the specified conversation to a <code>.md</code> file. The ID is usually detected automatically from the URL, but you can also paste one manually below.`;
        mainArea.appendChild(description);

        // 3. Action Group (Input + Button)
        const actionGroup = document.createElement("div");
        Object.assign(actionGroup.style, {
            display: "flex",
            flexDirection: "column",
            gap: theme.spacing.medium, // Gap inside the group
            padding: theme.spacing.medium,
            borderRadius: theme.borderRadius.medium,
            border: `1px solid ${theme.colors.borderPrimary}`,
            backgroundColor: theme.colors.backgroundPrimary, // Group background
            flexShrink: "0",
        });
        mainArea.appendChild(actionGroup);

        // ID Input Section
        const idSection = document.createElement("div");
        Object.assign(idSection.style, {
            display: "flex",
            flexDirection: "column",
            gap: theme.spacing.xsmall,
        });
        const idLabel = document.createElement("label");
        Object.assign(idLabel.style, {
            fontSize: theme.typography.fontSize.small,
            color: theme.colors.textSecondary,
            fontWeight: theme.typography.fontWeight.medium,
        });
        idLabel.textContent = "Conversation ID:";
        idLabel.htmlFor = "markdown-export-conv-id";
        idSection.appendChild(idLabel);

        this.idInput = document.createElement("input");
        this.idInput.id = "markdown-export-conv-id";
        this.idInput.type = "text";
        this.idInput.placeholder =
            "Enter or paste Conversation ID (e.g., abc123xyz-...)";
        Object.assign(this.idInput.style, {
            padding: `${theme.spacing.small} ${theme.spacing.medium}`,
            backgroundColor: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.borderPrimary}`,
            borderRadius: theme.borderRadius.small,
            color: theme.colors.textPrimary,
            fontSize: theme.typography.fontSize.small,
            outline: "none",
            transition: `all ${theme.transitions.duration.fast} ${theme.transitions.easing}`,
            boxSizing: "border-box",
            width: "100%",
            fontFamily: "monospace",
        });
        this.idInput.addEventListener("focus", () => {
            this.idInput.style.borderColor = theme.colors.accentPrimary;
            this.idInput.style.boxShadow = `0 0 0 1px ${theme.colors.accentPrimary}`;
        });
        this.idInput.addEventListener("blur", () => {
            this.idInput.style.borderColor = theme.colors.borderPrimary;
            this.idInput.style.boxShadow = "none";
        });
        idSection.appendChild(this.idInput);

        this.idNote = document.createElement("p");
        Object.assign(this.idNote.style, {
            fontSize: theme.typography.fontSize.small,
            color: theme.colors.textTertiary, // Base color for icon
            fontStyle: "italic",
            margin: `${theme.spacing.xxsmall} 0 0 0`,
            textAlign: "left",
            display: "flex",
            alignItems: "center",
            gap: theme.spacing.xxsmall, // Align icon and text
        });
        idSection.appendChild(this.idNote);
        actionGroup.appendChild(idSection); // Add section to the group

        // Export Button (Inside action group)
        this.exportButton = document.createElement("button");
        Object.assign(this.exportButton.style, {
            padding: `${theme.spacing.small} ${theme.spacing.large}`,
            border: "none",
            borderRadius: theme.borderRadius.small,
            fontSize: theme.typography.fontSize.small,
            fontWeight: theme.typography.fontWeight.semibold,
            cursor: "pointer",
            transition: `all ${theme.transitions.duration.fast} ${theme.transitions.easing}`,
            textAlign: "center" as const,
            backgroundColor: theme.colors.accentPrimary,
            color: theme.colors.backgroundPrimary,
            // alignSelf: 'flex-start', // Changed to full width below
            marginTop: theme.spacing.small, // Keep margin
            width: "100%", // Make button full width within group
            minHeight: "38px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: theme.spacing.xsmall,
            boxShadow: theme.shadows.small,
            lineHeight: "1",
        });
        this.exportButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
                <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/>
            </svg>
            <span>Export as Markdown</span>
        `;
        this.exportButton.addEventListener("click", () =>
            this.handleExportClick(),
        );
        this.exportButton.addEventListener("mouseover", () => {
            if (!this.exportButton.disabled) {
                this.exportButton.style.backgroundColor =
                    theme.colors.accentHover;
                this.exportButton.style.boxShadow = theme.shadows.medium;
            }
        });
        this.exportButton.addEventListener("mouseout", () => {
            if (!this.exportButton.disabled) {
                this.exportButton.style.backgroundColor =
                    theme.colors.accentPrimary;
                this.exportButton.style.boxShadow = theme.shadows.small;
            }
        });
        this.exportButton.addEventListener("mousedown", () => {
            if (!this.exportButton.disabled)
                this.exportButton.style.backgroundColor =
                    theme.colors.accentActive;
        });
        this.exportButton.addEventListener("mouseup", () => {
            if (!this.exportButton.disabled)
                this.exportButton.style.backgroundColor =
                    theme.colors.accentHover;
        });
        actionGroup.appendChild(this.exportButton); // Add button to the group

        // 4. Feedback Area (Remains separate at the bottom of mainArea)
        this.feedbackArea = document.createElement("div");
        this.feedbackArea.id = "markdown-export-feedback";
        Object.assign(this.feedbackArea.style, {
            marginTop: theme.spacing.medium,
            padding: theme.spacing.medium, // More padding
            backgroundColor: theme.colors.backgroundSecondary, // Consistent background
            borderRadius: theme.borderRadius.small,
            border: `1px solid ${theme.colors.borderSecondary}`,
            minHeight: "40px",
            color: theme.colors.textSecondary,
            fontSize: theme.typography.fontSize.small,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            display: "none",
            transition: `all ${theme.transitions.duration.fast} ${theme.transitions.easing}`,
        });
        mainArea.appendChild(this.feedbackArea); // Add feedback to the main scrollable area

        return container;
    }

    private async handleExportClick(): Promise<void> {
        if (!this.idInput || !this.exportButton || !this.feedbackArea) return;

        const conversationId = this.idInput.value.trim();
        if (!conversationId) {
            this.displayFeedback(
                "Please enter or detect a Conversation ID.",
                "error",
            );
            this.idInput.style.borderColor = theme.colors.error; // Highlight error
            this.idInput.focus();
            return;
        }
        this.idInput.style.borderColor = theme.colors.borderPrimary; // Reset border on attempt

        this.exportButton.disabled = true;
        this.exportButton.innerHTML = `
             <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="margin-right: ${theme.spacing.xsmall};">
               <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41m-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9"/>
               <path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.5A5 5 0 0 0 8 3M3.5 9A5 5 0 0 0 8 13c1.552 0 2.94-.707 3.857-1.818a.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9z"/>
             </svg>
            <span>Exporting...</span>`;
        this.exportButton.style.opacity = "0.7";
        this.exportButton.style.cursor = "wait";
        this.displayFeedback("Starting export...", "loading");

        try {
            const response = await this.sendMessageToSW<{
                markdownContent: string;
                createTime: number;
                title: string;
            }>({
                type: "EXPORT_CONVERSATION_MARKDOWN",
                payload: { conversationId },
            });
            const fileName = generateMarkdownFileName(response.createTime);
            downloadTextFile(
                response.markdownContent,
                fileName,
                "text/markdown;charset=utf-8",
            );
            this.displayFeedback(
                `✅ Export successful! File saved as: ${fileName}`,
                "success",
                7000,
            );
        } catch (error) {
            this.displayFeedback(error as Error, "error");
        } finally {
            this.exportButton.disabled = false;
            this.exportButton.innerHTML = `
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                     <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
                     <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/>
                 </svg>
                 <span>Export as Markdown</span>
             `;
            this.exportButton.style.opacity = "1";
            this.exportButton.style.cursor = "pointer";
            // Restore hover style in case mouseout didn't fire during loading
            this.exportButton.style.backgroundColor =
                theme.colors.accentPrimary;
            this.exportButton.style.boxShadow = theme.shadows.small;
        }
    }

    /** Displays feedback messages in the dedicated area. */
    private displayFeedback(
        message: string | Error,
        type: "success" | "error" | "loading" | "info" | "warning",
        autoHideDelay?: number,
    ): void {
        if (!this.feedbackArea) return;
        let messageText: string;
        let effectiveType = type;

        if (message instanceof Error) {
            effectiveType = "error";
            // Add error emoji for clarity
            messageText = `❌ Error: ${message.name || "Unknown"}\n${message.message}`;
        } else {
            messageText = message;
        }

        this.feedbackArea.textContent = messageText;
        this.feedbackArea.style.display = messageText ? "block" : "none";

        // Reset border and background first
        this.feedbackArea.style.borderColor = theme.colors.borderSecondary;
        this.feedbackArea.style.backgroundColor =
            theme.colors.backgroundSecondary;

        switch (effectiveType) {
            case "success":
                this.feedbackArea.style.color = theme.colors.success;
                this.feedbackArea.style.borderColor = theme.colors.success;
                this.feedbackArea.style.backgroundColor = `${theme.colors.success}1A`; // 10% opacity
                break;
            case "error":
                this.feedbackArea.style.color = theme.colors.error;
                this.feedbackArea.style.borderColor = theme.colors.error;
                this.feedbackArea.style.backgroundColor = `${theme.colors.error}1A`; // 10% opacity
                break;
            case "warning":
                this.feedbackArea.style.color = theme.colors.warning;
                this.feedbackArea.style.borderColor = theme.colors.warning;
                this.feedbackArea.style.backgroundColor = `${theme.colors.warning}1A`;
                break;
            case "info":
                this.feedbackArea.style.color = theme.colors.textSecondary;
                break;
            case "loading":
            default:
                this.feedbackArea.style.color = theme.colors.textSecondary;
                break;
        }

        // Clear existing timeout
        const existingTimeout = Number(
            this.feedbackArea.dataset.hideTimeoutId || 0,
        );
        if (existingTimeout) clearTimeout(existingTimeout);
        this.feedbackArea.dataset.hideTimeoutId = "";

        // Auto-hide logic
        if (autoHideDelay && autoHideDelay > 0) {
            const timeoutId = setTimeout(() => {
                if (
                    this.feedbackArea &&
                    this.feedbackArea.textContent === messageText
                ) {
                    this.feedbackArea.style.display = "none";
                    this.feedbackArea.textContent = "";
                }
            }, autoHideDelay);
            this.feedbackArea.dataset.hideTimeoutId = String(timeoutId);
        } else if (effectiveType === "loading") {
            // Auto-hide loading only
            const timeoutId = setTimeout(() => {
                if (
                    this.feedbackArea &&
                    this.feedbackArea.textContent === messageText
                ) {
                    this.feedbackArea.style.display = "none";
                    this.feedbackArea.textContent = "";
                }
            }, 15000);
            this.feedbackArea.dataset.hideTimeoutId = String(timeoutId);
        }
        // Other message types (error, info, success without timeout) remain until replaced
    }
}
