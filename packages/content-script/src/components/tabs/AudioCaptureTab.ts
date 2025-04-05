// packages/content-script/src/components/tabs/AudioCaptureTab.ts
import { theme } from "@shared";
import { AudioCapture } from "@/constants/tabConfig";
import { triggerAudioDownload } from "@/utils/downloadUtils";
import { SendMessageToSW } from "@/utils/swMessenger";

interface MessageInfo {
    id: string;
    role: string; // 'user' or 'assistant' typically
    parts: string[]; // Array of text parts for the message
}

export class AudioCaptureTab {
    private rootElement: HTMLDivElement;
    private convIdDisplay!: HTMLParagraphElement;
    private loadButton!: HTMLButtonElement;
    private messageListContainer!: HTMLDivElement;
    private feedbackArea!: HTMLDivElement;
    private voiceSelect!: HTMLSelectElement;
    private formatSelect!: HTMLSelectElement;

    private currentConversationId: string | null = null;
    private sendMessageToSW: SendMessageToSW;
    private isLoadingMessages: boolean = false;

    constructor(sendMessageFunction: SendMessageToSW) {
        this.sendMessageToSW = sendMessageFunction;
        this.rootElement = this.buildUI();
        this.updateConversationId(null); // Set initial state
    }

    /** Returns the root HTMLElement for this tab's content. */
    public getElement(): HTMLDivElement {
        return this.rootElement;
    }

    /** Updates the UI based on the currently detected conversation ID. */
    public updateConversationId(id: string | null): void {
        const changed = id !== this.currentConversationId;
        this.currentConversationId = id;

        if (
            !this.convIdDisplay ||
            !this.loadButton ||
            !this.messageListContainer
        ) {
            console.warn(
                "AudioCaptureTab: UI elements not ready for updateConversationId.",
            );
            return;
        }

        // const messageListPlaceholder =
        //     this.messageListContainer.querySelector<HTMLParagraphElement>(
        //         ".placeholder-message",
        //     );

        if (this.currentConversationId) {
            this.convIdDisplay.textContent = this.currentConversationId;
            this.convIdDisplay.style.color = theme.colors.textPrimary;
            this.convIdDisplay.style.opacity = "1"; // Make it fully visible
            this.loadButton.disabled = false;
            this.loadButton.style.opacity = "1";
            this.loadButton.style.cursor = "pointer";

            if (
                changed ||
                !this.messageListContainer.querySelector(".message-item")
            ) {
                this.setPlaceholderMessage(
                    "Click 'Load Messages' to view downloadable audio.",
                );
                this.displayFeedback("", "loading", 0); // Clear feedback only if needed
            }
        } else {
            this.convIdDisplay.textContent = "No conversation selected"; // Clearer text
            this.convIdDisplay.style.color = theme.colors.textSecondary;
            this.convIdDisplay.style.opacity = "0.7"; // Dim it slightly
            this.loadButton.disabled = true;
            this.loadButton.style.opacity = "0.5";
            this.loadButton.style.cursor = "not-allowed";
            this.setPlaceholderMessage(
                "Navigate to a ChatGPT conversation page to enable audio download.",
            );
            this.displayFeedback("", "loading", 0); // Clear feedback
        }
    }

    // --- Private Methods ---

    private buildUI(): HTMLDivElement {
        const container = document.createElement("div");
        Object.assign(container.style, {
            display: "flex",
            flexDirection: "column",
            gap: theme.spacing.large, // Increased gap between main sections
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
            borderBottom: `1px solid ${theme.colors.borderSecondary}`, // Subtle separator
            paddingBottom: theme.spacing.medium,
            flexShrink: "0",
        });
        header.textContent = AudioCapture.label;
        container.appendChild(header);

        // 2. Top Controls Section (ID + Load Button)
        const topControlsSection = document.createElement("div");
        Object.assign(topControlsSection.style, {
            display: "flex",
            alignItems: "flex-end", // Align bottom of ID display and button
            gap: theme.spacing.medium,
            flexShrink: "0",
            flexWrap: "wrap", // Allow wrapping on smaller widths
        });
        container.appendChild(topControlsSection);

        // ID Display Area
        const idContainer = document.createElement("div");
        Object.assign(idContainer.style, { flexGrow: "1", minWidth: "250px" });
        const idLabel = document.createElement("label");
        Object.assign(idLabel.style, {
            fontSize: theme.typography.fontSize.small,
            color: theme.colors.textSecondary,
            display: "block",
            marginBottom: theme.spacing.xxsmall,
            fontWeight: theme.typography.fontWeight.medium,
        });
        idLabel.textContent = "Current Conversation ID:";
        idLabel.htmlFor = "audio-capture-conv-id"; // Link label to display for accessibility
        this.convIdDisplay = document.createElement("p");
        this.convIdDisplay.id = "audio-capture-conv-id";
        Object.assign(this.convIdDisplay.style, {
            padding: `${theme.spacing.small} ${theme.spacing.medium}`,
            backgroundColor: theme.colors.backgroundSecondary, // Use secondary for subtle grouping
            border: `1px solid ${theme.colors.borderPrimary}`,
            borderRadius: theme.borderRadius.small,
            color: theme.colors.textSecondary, // Default to secondary
            fontSize: theme.typography.fontSize.small,
            fontFamily: "monospace",
            margin: "0",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minHeight: "38px", // Match button height better
            display: "flex",
            alignItems: "center",
            transition: "color 0.2s, opacity 0.2s",
            opacity: "0.7", // Smooth transition
        });
        idContainer.appendChild(idLabel);
        idContainer.appendChild(this.convIdDisplay);
        topControlsSection.appendChild(idContainer);

        // Load Button Area (aligned with ID display)
        this.loadButton = document.createElement("button");
        Object.assign(this.loadButton.style, {
            padding: `${theme.spacing.small} ${theme.spacing.large}`, // Slightly more padding
            border: "none", // Make it look more actionable
            borderRadius: theme.borderRadius.small,
            fontSize: theme.typography.fontSize.small,
            fontWeight: theme.typography.fontWeight.semibold, // Bolder
            cursor: "pointer",
            transition: `all ${theme.transitions.duration.fast} ${theme.transitions.easing}`,
            textAlign: "center" as const,
            backgroundColor: theme.colors.accentPrimary, // Use accent color
            color: theme.colors.backgroundPrimary,
            whiteSpace: "nowrap",
            minHeight: "38px", // Match ID display height
            boxShadow: theme.shadows.small,
            lineHeight: "1", // Ensure text centers vertically
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
        });
        this.loadButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="margin-right: ${theme.spacing.xsmall};">
              <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/>
              <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/>
            </svg> Load Messages
        `; // Add an icon
        this.loadButton.addEventListener("click", () => this.loadMessages());
        // Enhance hover/active states for accent button
        this.loadButton.addEventListener("mouseover", () => {
            if (!this.loadButton.disabled) {
                this.loadButton.style.backgroundColor =
                    theme.colors.accentHover;
                this.loadButton.style.boxShadow = theme.shadows.medium;
            }
        });
        this.loadButton.addEventListener("mouseout", () => {
            if (!this.loadButton.disabled) {
                this.loadButton.style.backgroundColor =
                    theme.colors.accentPrimary;
                this.loadButton.style.boxShadow = theme.shadows.small;
            }
        });
        this.loadButton.addEventListener("mousedown", () => {
            if (!this.loadButton.disabled)
                this.loadButton.style.backgroundColor =
                    theme.colors.accentActive;
        });
        this.loadButton.addEventListener("mouseup", () => {
            if (!this.loadButton.disabled)
                this.loadButton.style.backgroundColor =
                    theme.colors.accentHover;
        });
        topControlsSection.appendChild(this.loadButton);

        // 3. Options Section (Grouped and slightly inset)
        const optionsSection = document.createElement("div");
        Object.assign(optionsSection.style, {
            display: "flex",
            flexDirection: "column",
            gap: theme.spacing.small, // Gap between header and grid
            marginTop: theme.spacing.small, // Smaller margin now that it's grouped
            padding: theme.spacing.medium,
            borderRadius: theme.borderRadius.medium,
            border: `1px solid ${theme.colors.borderPrimary}`,
            backgroundColor: theme.colors.backgroundPrimary, // Slightly different bg
            flexShrink: "0",
        });
        container.appendChild(optionsSection);

        const optionsHeader = document.createElement("h3");
        Object.assign(optionsHeader.style, {
            margin: "0",
            fontSize: theme.typography.fontSize.small,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.textSecondary,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
        });
        optionsHeader.textContent = "Download Options";
        optionsSection.appendChild(optionsHeader);

        const optionsGrid = document.createElement("div");
        Object.assign(optionsGrid.style, {
            display: "grid", // Use grid for better alignment
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", // Responsive columns
            gap: theme.spacing.medium,
        });
        optionsSection.appendChild(optionsGrid);

        // Voice Select Group
        const voiceGroup = this.createSelectGroup(
            "Voice:",
            "audio-voice-select",
            ["breeze", "cove", "ember", "juniper", "maple", "orbit", "vale"],
        );
        this.voiceSelect = voiceGroup.querySelector("select")!;
        optionsGrid.appendChild(voiceGroup);

        // Format Select Group
        const formatGroup = this.createSelectGroup(
            "Format:",
            "audio-format-select",
            ["aac", "mp3", "opus", "flac"],
        );
        this.formatSelect = formatGroup.querySelector("select")!;
        optionsGrid.appendChild(formatGroup);

        // 4. Message List Container (Improved Styling)
        this.messageListContainer = document.createElement("div");
        this.messageListContainer.id = "audio-message-list";
        Object.assign(this.messageListContainer.style, {
            flexGrow: "1",
            overflowY: "auto",
            border: `1px solid ${theme.colors.borderPrimary}`, // Solid border
            borderRadius: theme.borderRadius.medium,
            backgroundColor: theme.colors.backgroundPrimary, // Match options bg
            padding: theme.spacing.small, // Padding inside
            marginTop: theme.spacing.medium, // Consistent margin
            minHeight: "150px", // Ensure it has some visible height
        });
        container.appendChild(this.messageListContainer);
        this.setPlaceholderMessage(
            "Navigate to a ChatGPT conversation page...",
        ); // Initial placeholder

        // 5. Feedback Area (Remains at the bottom)
        this.feedbackArea = document.createElement("div");
        this.feedbackArea.id = "audio-capture-feedback";
        Object.assign(this.feedbackArea.style, {
            marginTop: theme.spacing.small, // Consistent margin
            padding: theme.spacing.medium, // More padding
            borderRadius: theme.borderRadius.small,
            border: `1px solid ${theme.colors.borderSecondary}`,
            color: theme.colors.textSecondary,
            fontSize: theme.typography.fontSize.small,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            display: "none",
            transition: `all ${theme.transitions.duration.fast} ${theme.transitions.easing}`,
            flexShrink: "0",
            backgroundColor: theme.colors.backgroundSecondary, // Match top controls bg
        });
        container.appendChild(this.feedbackArea);

        return container;
    }

    /** Helper to create a label and select pair wrapped in a div. */
    private createSelectGroup(
        labelText: string,
        id: string,
        options: string[],
    ): HTMLDivElement {
        const group = document.createElement("div");
        Object.assign(group.style, {
            display: "flex",
            flexDirection: "column",
            gap: theme.spacing.xxsmall,
        });

        const label = document.createElement("label");
        Object.assign(label.style, {
            fontSize: theme.typography.fontSize.small,
            color: theme.colors.textSecondary,
            fontWeight: theme.typography.fontWeight.medium,
        });
        label.textContent = labelText;
        label.htmlFor = id;

        const select = document.createElement("select");
        select.id = id;
        Object.assign(select.style, {
            padding: `${theme.spacing.small} ${theme.spacing.medium}`, // Increased padding
            backgroundColor: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.borderPrimary}`,
            borderRadius: theme.borderRadius.small,
            color: theme.colors.textPrimary,
            fontSize: theme.typography.fontSize.small,
            outline: "none",
            appearance: "none", // Basic reset
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23${theme.colors.textSecondary.substring(1)}' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, // Chevron icon
            backgroundPosition: `right ${theme.spacing.medium} center`,
            backgroundRepeat: "no-repeat",
            backgroundSize: "1em 1em",
            cursor: "pointer",
        });
        options.forEach((v) => {
            const opt = new Option(v, v);
            select.add(opt);
        });

        // Add focus styles
        select.addEventListener("focus", () => {
            select.style.borderColor = theme.colors.accentPrimary;
            select.style.boxShadow = `0 0 0 1px ${theme.colors.accentPrimary}`;
        });
        select.addEventListener("blur", () => {
            select.style.borderColor = theme.colors.borderPrimary;
            select.style.boxShadow = "none";
        });

        group.appendChild(label);
        group.appendChild(select);
        return group;
    }

    private setPlaceholderMessage(text: string) {
        if (!this.messageListContainer) return;
        // Remove existing items first
        this.messageListContainer
            .querySelectorAll(".message-item")
            .forEach((el) => el.remove());
        // Add or update placeholder
        let placeholder =
            this.messageListContainer.querySelector<HTMLParagraphElement>(
                ".placeholder-message",
            );
        if (!placeholder) {
            placeholder = document.createElement("p");
            placeholder.classList.add("placeholder-message");
            Object.assign(placeholder.style, {
                color: theme.colors.textSecondary,
                fontStyle: "italic",
                textAlign: "center",
                padding: theme.spacing.large,
            });
            this.messageListContainer.appendChild(placeholder);
        }
        placeholder.textContent = text;
    }

    private async loadMessages(): Promise<void> {
        if (!this.currentConversationId || this.isLoadingMessages) return;

        this.isLoadingMessages = true;
        this.setPlaceholderMessage("Loading messages..."); // Use placeholder function
        this.displayFeedback("Loading messages...", "loading");
        this.loadButton.disabled = true;
        this.loadButton.innerHTML = `
             <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="margin-right: ${theme.spacing.xsmall};">
               <path d="M8 3a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0v-3A.5.5 0 0 1 8 3m0 8a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0v-3a.5.5 0 0 1 .5-.5m-6.23-4.73a.5.5 0 0 1 .708 0l2.12 2.122a.5.5 0 0 1-.707.707L1.77 5.27a.5.5 0 0 1 0-.707m10.46 0a.5.5 0 0 1 0 .708l-2.122 2.12a.5.5 0 0 1-.707-.707l2.122-2.12a.5.5 0 0 1 .707 0M4 8a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3A.5.5 0 0 1 4 8m8 0a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5M5.27 1.77a.5.5 0 0 1 .707 0l2.122 2.12a.5.5 0 1 1-.707.708L5.27 2.477a.5.5 0 0 1 0-.707M10.73 1.77a.5.5 0 0 1 0 .707l-2.12 2.122a.5.5 0 0 1-.708-.707l2.12-2.122a.5.5 0 0 1 .708 0m-6.46 8.96a.5.5 0 0 1 .708 0l2.12 2.12a.5.5 0 0 1-.707.708l-2.12-2.122a.5.5 0 0 1 0-.707m10.46 0a.5.5 0 0 1 0 .708l-2.122 2.12a.5.5 0 0 1-.707-.707l2.122-2.12a.5.5 0 0 1 .707 0z"/>
             </svg> Loading...`;
        this.loadButton.style.opacity = "0.7";

        try {
            const messages = await this.sendMessageToSW<MessageInfo[]>({
                type: "FETCH_CONVERSATION_MESSAGES",
                payload: { conversationId: this.currentConversationId },
            });
            const assistantMessages = messages.filter(
                (msg) =>
                    msg.role === "assistant" &&
                    msg.parts.join("").trim().length > 0,
            );

            if (assistantMessages.length === 0) {
                this.setPlaceholderMessage(
                    "No assistant messages found to convert to audio.",
                );
                this.displayFeedback("No downloadable messages found.", "info");
            } else {
                this.messageListContainer.innerHTML = ""; // Clear placeholder before adding items
                this.displayMessages(
                    assistantMessages,
                    this.currentConversationId,
                );
                this.displayFeedback(
                    `✓ Loaded ${assistantMessages.length} message(s).`,
                    "success",
                    4000,
                );
            }
        } catch (error) {
            this.displayFeedback(error as Error, "error");
            this.setPlaceholderMessage("❌ Failed to load messages.");
        } finally {
            this.isLoadingMessages = false;
            this.loadButton.disabled = false;
            this.loadButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="margin-right: ${theme.spacing.xsmall};">
                  <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/>
                  <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/>
                </svg> Load Messages
            `;
            this.loadButton.style.opacity = "1";
        }
    }

    private displayMessages(
        messages: MessageInfo[],
        conversationId: string,
    ): void {
        if (!this.messageListContainer) return;
        this.messageListContainer.innerHTML = ""; // Clear any previous state

        messages.forEach((message) => {
            const item = document.createElement("div");
            item.classList.add("message-item"); // Add class for easier selection
            Object.assign(item.style, {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: theme.spacing.medium,
                padding: theme.spacing.medium, // More padding
                borderBottom: `1px solid ${theme.colors.borderSecondary}`, // Use secondary for list items
                backgroundColor: theme.colors.backgroundSecondary, // Slightly different bg for items
                borderRadius: theme.borderRadius.small,
                marginBottom: theme.spacing.small,
                transition: "background-color 0.2s",
            });
            // Subtle hover effect
            item.addEventListener(
                "mouseenter",
                () =>
                    (item.style.backgroundColor = theme.colors.backgroundHover),
            );
            item.addEventListener(
                "mouseleave",
                () =>
                (item.style.backgroundColor =
                    theme.colors.backgroundSecondary),
            );

            const textPreview = document.createElement("p");
            Object.assign(textPreview.style, {
                flexGrow: "1",
                margin: "0",
                color: theme.colors.textPrimary, // Primary text for preview
                fontSize: theme.typography.fontSize.small,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "calc(100% - 180px)", // Adjust based on button size
                lineHeight: theme.typography.lineHeight.small,
            });
            const previewText = message.parts.join(" ").trim();
            textPreview.textContent =
                previewText.substring(0, 100) +
                (previewText.length > 100 ? "..." : ""); // Slightly longer preview
            textPreview.title = previewText;

            const downloadButton = document.createElement("button");
            Object.assign(downloadButton.style, {
                padding: `${theme.spacing.xsmall} ${theme.spacing.medium}`, // Adjust padding
                border: "none",
                borderRadius: theme.borderRadius.small,
                fontSize: theme.typography.fontSize.small,
                fontWeight: theme.typography.fontWeight.medium, // Medium weight is fine
                cursor: "pointer",
                transition: `all ${theme.transitions.duration.fast} ${theme.transitions.easing}`,
                backgroundColor: theme.colors.backgroundActive, // Less prominent default state
                color: theme.colors.textPrimary,
                flexShrink: "0",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: theme.spacing.xsmall, // Gap for icon
                lineHeight: "1", // Better vertical alignment
            });
            downloadButton.innerHTML = `
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
                    <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/>
                 </svg>
                 Download
             `;
            downloadButton.dataset.messageId = message.id;

            downloadButton.addEventListener("mouseover", () => {
                if (!downloadButton.disabled)
                    downloadButton.style.backgroundColor =
                        theme.colors.accentPrimary;
                downloadButton.style.color = theme.colors.backgroundPrimary;
            });
            downloadButton.addEventListener("mouseout", () => {
                if (!downloadButton.disabled)
                    downloadButton.style.backgroundColor =
                        theme.colors.backgroundActive;
                downloadButton.style.color = theme.colors.textPrimary;
            });
            downloadButton.addEventListener("mousedown", () => {
                if (!downloadButton.disabled) {
                    downloadButton.style.backgroundColor =
                        theme.colors.accentActive;
                    downloadButton.style.color = theme.colors.backgroundPrimary;
                }
            });
            downloadButton.addEventListener("mouseup", () => {
                if (!downloadButton.disabled) {
                    downloadButton.style.backgroundColor =
                        theme.colors.accentPrimary;
                    downloadButton.style.color = theme.colors.backgroundPrimary;
                }
            });

            downloadButton.addEventListener("click", () => {
                this.handleDownloadClick(
                    message.id,
                    conversationId,
                    downloadButton,
                );
            });

            item.appendChild(textPreview);
            item.appendChild(downloadButton);
            this.messageListContainer.appendChild(item);
        });
    }

    private async handleDownloadClick(
        messageId: string,
        conversationId: string,
        buttonElement: HTMLButtonElement,
    ): Promise<void> {
        const originalContent = buttonElement.innerHTML; // Store original HTML
        buttonElement.disabled = true;
        buttonElement.innerHTML = `
             <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" style="margin-right: ${theme.spacing.xsmall};">
                <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41m-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9"/>
                <path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.5A5 5 0 0 0 8 3M3.5 9A5 5 0 0 0 8 13c1.552 0 2.94-.707 3.857-1.818a.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9z"/>
            </svg> Downloading...`;
        Object.assign(buttonElement.style, {
            opacity: "0.7",
            cursor: "wait",
            backgroundColor: theme.colors.accentActive,
            color: theme.colors.backgroundPrimary,
        });
        this.displayFeedback(
            `Requesting audio for message ${messageId.substring(0, 8)}...`,
            "loading",
        );

        const voice = this.voiceSelect?.value || "alloy";
        const format = this.formatSelect?.value || "aac";

        try {
            const response = await this.sendMessageToSW<{
                dataUrl: string;
                format: string;
                messageId: string;
            }>({
                type: "GET_AUDIO",
                payload: { messageId, conversationId, voice, format },
            });
            triggerAudioDownload(
                response.dataUrl,
                response.messageId,
                response.format,
            );
            this.displayFeedback(
                `✅ Audio download started for message ${messageId.substring(0, 8)}.`,
                "success",
                5000,
            );
        } catch (error) {
            this.displayFeedback(error as Error, "error");
        } finally {
            if (document.body.contains(buttonElement)) {
                buttonElement.disabled = false;
                buttonElement.innerHTML = originalContent; // Restore original HTML
                // Reset styles explicitly
                Object.assign(buttonElement.style, {
                    opacity: "1",
                    cursor: "pointer",
                    backgroundColor: theme.colors.backgroundActive, // Back to default non-hover state
                    color: theme.colors.textPrimary,
                });
            }
        }
    }

    /** Displays feedback messages in the dedicated area for the Audio tab. */
    private displayFeedback(
        message: string | Error,
        type: "success" | "error" | "loading" | "info",
        autoHideDelay?: number,
    ): void {
        if (!this.feedbackArea) return;
        let messageText: string;
        let effectiveType = type;

        if (message instanceof Error) {
            effectiveType = "error";
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
                // Use a subtle background tint for success
                this.feedbackArea.style.backgroundColor = `${theme.colors.success}1A`; // e.g., 10% opacity
                break;
            case "error":
                this.feedbackArea.style.color = theme.colors.error;
                this.feedbackArea.style.borderColor = theme.colors.error;
                // Use a subtle background tint for error
                this.feedbackArea.style.backgroundColor = `${theme.colors.error}1A`; // e.g., 10% opacity
                break;
            case "info":
                this.feedbackArea.style.color = theme.colors.textSecondary; // Keep secondary for info
                break;
            case "loading":
            default:
                this.feedbackArea.style.color = theme.colors.textSecondary;
                break;
        }

        const existingTimeout = Number(
            this.feedbackArea.dataset.hideTimeoutId || 0,
        );
        if (existingTimeout) clearTimeout(existingTimeout);
        this.feedbackArea.dataset.hideTimeoutId = "";

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
            // Only auto-hide loading
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
    }
}
