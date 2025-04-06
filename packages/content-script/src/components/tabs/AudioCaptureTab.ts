// packages/content-script/src/components/tabs/AudioCaptureTab.ts
import { theme } from "@shared"; // Ensure this path resolves correctly
import { triggerAudioDownload } from "@/utils/downloadUtils";
import { SendMessageToSW } from "@/utils/swMessenger";

interface MessageInfo {
    id: string;
    role: string;
    parts: string[];
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
        this.updateConversationId(null);
    }

    public getElement(): HTMLDivElement {
        return this.rootElement;
    }

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

        if (this.currentConversationId) {
            this.convIdDisplay.textContent = `ID: ${this.currentConversationId}`; // Add prefix for context
            this.convIdDisplay.title = this.currentConversationId; // Full ID on hover
            this.convIdDisplay.style.color = theme.colors.textPrimary;
            this.convIdDisplay.style.opacity = "1";
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
                this.displayFeedback("", "loading", 0);
            }
        } else {
            this.convIdDisplay.textContent = "No conversation selected";
            this.convIdDisplay.title = "";
            this.convIdDisplay.style.color = theme.colors.textSecondary;
            this.convIdDisplay.style.opacity = "0.7";
            this.loadButton.disabled = true;
            this.loadButton.style.opacity = "0.5";
            this.loadButton.style.cursor = "not-allowed";
            this.setPlaceholderMessage(
                "Navigate to a ChatGPT conversation page to enable audio download.",
            );
            this.displayFeedback("", "loading", 0);
        }
    }

    // --- Private Methods ---

    private buildUI(): HTMLDivElement {
        const container = document.createElement("div");
        Object.assign(container.style, {
            display: "flex",
            flexDirection: "column",
            gap: theme.spacing.medium, // Main gap between sections
            padding: theme.spacing.large,
            boxSizing: "border-box",
            height: "100%",
            backgroundColor: theme.colors.backgroundSecondary, // Set base background
        });

        // // 1. Header Section
        // const header = document.createElement("h2");
        // Object.assign(header.style, {
        //     margin: "0",
        //     fontSize: theme.typography.fontSize.large,
        //     fontWeight: theme.typography.fontWeight.semibold,
        //     color: theme.colors.textPrimary,
        //     borderBottom: `1px solid ${theme.colors.borderPrimary}`,
        //     paddingBottom: theme.spacing.medium,
        //     flexShrink: "0",
        //     textAlign: "center",
        // });
        // header.textContent = AudioCapture.label;
        // container.appendChild(header);

        // 2. Action Bar (Combined Controls: ID, Load, Options)
        const actionBar = document.createElement("div");
        Object.assign(actionBar.style, {
            display: "flex",
            alignItems: "center", // Vertically center items in the bar
            justifyContent: "space-between", // Space out left/right groups
            gap: theme.spacing.medium,
            flexShrink: "0",
            flexWrap: "wrap", // Allow wrapping on smaller screens
            padding: `${theme.spacing.small} 0`, // Padding top/bottom for the bar
            borderBottom: `1px solid ${theme.colors.borderPrimary}`, // Separator below action bar
        });
        container.appendChild(actionBar);

        // --- Left Group: ID Display + Load Button ---
        const leftGroup = document.createElement("div");
        Object.assign(leftGroup.style, {
            display: "flex",
            alignItems: "center",
            gap: theme.spacing.medium,
            flexWrap: "nowrap", // Prevent wrapping within this group initially
        });
        actionBar.appendChild(leftGroup);

        // Compact ID Display (No separate label)
        this.convIdDisplay = document.createElement("p");
        this.convIdDisplay.id = "audio-capture-conv-id";
        Object.assign(this.convIdDisplay.style, {
            padding: `${theme.spacing.xsmall} ${theme.spacing.small}`, // Reduced padding
            backgroundColor: theme.colors.backgroundPrimary, // Contrast bg
            border: `1px solid ${theme.colors.borderPrimary}`,
            borderRadius: theme.borderRadius.small,
            color: theme.colors.textSecondary,
            fontSize: theme.typography.fontSize.small,
            fontFamily: "monospace",
            margin: "0",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            width: "350px", // Limit width
            // minHeight: '32px', // Reduced height
            lineHeight: "1.4", // Match button line height
            display: "flex",
            alignItems: "center",
            transition: "color 0.2s, opacity 0.2s",
            opacity: "0.7",
        });
        leftGroup.appendChild(this.convIdDisplay);

        // Load Button
        this.loadButton = this.createActionButton(
            // Load icon + text
            `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="margin-right: ${theme.spacing.xsmall};"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/></svg> Load Messages`,
            () => this.loadMessages(),
            true, // Start disabled
            "primary", // Make it the primary action button
        );
        // Adjust padding for slightly smaller button
        this.loadButton.style.padding = `${theme.spacing.xsmall} ${theme.spacing.medium}`;
        leftGroup.appendChild(this.loadButton);

        // --- Right Group: Download Options ---
        const rightGroup = document.createElement("div");
        Object.assign(rightGroup.style, {
            display: "flex",
            alignItems: "center",
            gap: theme.spacing.medium,
            flexWrap: "nowrap", // Prevent wrapping within this group initially
        });
        actionBar.appendChild(rightGroup);

        // Voice Select (Inline Label)
        const voiceGroup = this.createInlineSelectGroup(
            "Voice:",
            "audio-voice-select",
            ["breeze", "cove", "ember", "juniper", "maple", "orbit", "vale"],
        );
        this.voiceSelect = voiceGroup.querySelector("select")!;
        rightGroup.appendChild(voiceGroup);

        // Format Select (Inline Label)
        const formatGroup = this.createInlineSelectGroup(
            "Format:",
            "audio-format-select",
            ["aac", "mp3", "opus", "flac"],
        );
        this.formatSelect = formatGroup.querySelector("select")!;
        rightGroup.appendChild(formatGroup);

        // 3. Message List Container
        this.messageListContainer = document.createElement("div");
        this.messageListContainer.id = "audio-message-list";
        Object.assign(this.messageListContainer.style, {
            flexGrow: "1",
            overflowY: "auto",
            border: `1px solid ${theme.colors.borderPrimary}`,
            borderRadius: theme.borderRadius.medium,
            backgroundColor: theme.colors.backgroundPrimary, // List background
            // No internal padding needed if items handle it
            minHeight: "150px", // Ensure visibility
            marginTop: 0, // Remove top margin, rely on container gap
        });
        container.appendChild(this.messageListContainer);
        this.setPlaceholderMessage(
            "Navigate to a ChatGPT conversation page...",
        ); // Initial placeholder

        // 4. Feedback Area
        this.feedbackArea = document.createElement("div");
        this.feedbackArea.id = "audio-capture-feedback";
        Object.assign(this.feedbackArea.style, {
            padding: `${theme.spacing.small} ${theme.spacing.medium}`, // Standard padding
            borderRadius: theme.borderRadius.small,
            border: `1px solid transparent`, // Border set based on type
            color: theme.colors.textSecondary,
            fontSize: theme.typography.fontSize.small,
            minHeight: "24px", // Reserve space
            textAlign: "center",
            display: "none",
            transition: `all ${theme.transitions.duration.fast} ${theme.transitions.easing}`,
            flexShrink: "0",
            marginTop: "auto", // Push to bottom if list doesn't fill space
            backgroundColor: theme.colors.backgroundSecondary, // Match container bg
        });
        container.appendChild(this.feedbackArea);

        return container;
    }

    /** Helper to create a primary action button */
    private createActionButton(
        htmlContent: string,
        onClick: () => void,
        disabled: boolean,
        type: "primary" | "default" = "default",
    ): HTMLButtonElement {
        const button = document.createElement("button");
        button.innerHTML = htmlContent;
        button.disabled = disabled;
        button.addEventListener("click", onClick);

        const baseStyles: Partial<CSSStyleDeclaration> = {
            padding: `${theme.spacing.small} ${theme.spacing.large}`, // Default padding
            border: `1px solid ${theme.colors.borderPrimary}`,
            borderRadius: theme.borderRadius.small,
            fontSize: theme.typography.fontSize.small,
            fontWeight: theme.typography.fontWeight.semibold, // Bolder for action buttons
            cursor: disabled ? "not-allowed" : "pointer",
            transition: `all ${theme.transitions.duration.fast} ${theme.transitions.easing}`,
            textAlign: "center",
            backgroundColor: theme.colors.backgroundSecondary,
            color: theme.colors.textPrimary,
            opacity: disabled ? "0.7" : "1", // Use opacity for disabled state
            whiteSpace: "nowrap",
            lineHeight: "1.3",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: theme.shadows.small,
        };

        let hoverBgColor = theme.colors.backgroundHover;
        let activeBgColor = theme.colors.backgroundActive;
        let hoverBorderColor = theme.colors.borderPrimary;
        let activeBorderColor = theme.colors.borderPrimary;

        if (type === "primary") {
            baseStyles.backgroundColor = theme.colors.accentPrimary;
            baseStyles.color = theme.colors.backgroundPrimary; // Use contrast color
            baseStyles.border = "none";
            hoverBgColor = theme.colors.accentHover;
            activeBgColor = theme.colors.accentActive;
            hoverBorderColor = "none";
            activeBorderColor = "none";
        }

        Object.assign(button.style, baseStyles);

        if (!disabled) {
            button.addEventListener("mouseover", () => {
                button.style.backgroundColor = hoverBgColor;
                if (type === "primary")
                    button.style.color = theme.colors.backgroundPrimary;
                if (hoverBorderColor !== "none")
                    button.style.borderColor = hoverBorderColor;
                button.style.boxShadow = theme.shadows.medium;
            });
            button.addEventListener("mouseout", () => {
                Object.assign(button.style, baseStyles); // Reset to original calculated base
            });
            button.addEventListener("mousedown", () => {
                button.style.backgroundColor = activeBgColor;
                if (type === "primary")
                    button.style.color = theme.colors.backgroundPrimary;
                if (activeBorderColor !== "none")
                    button.style.borderColor = activeBorderColor;
                button.style.boxShadow = theme.shadows.small; // Less shadow when pressed
            });
            button.addEventListener("mouseup", () => {
                // Revert to hover state if mouse is still over
                if (button.matches(":hover")) {
                    button.style.backgroundColor = hoverBgColor;
                    if (type === "primary")
                        button.style.color = theme.colors.backgroundPrimary;
                    if (hoverBorderColor !== "none")
                        button.style.borderColor = hoverBorderColor;
                    button.style.boxShadow = theme.shadows.medium;
                } else {
                    Object.assign(button.style, baseStyles); // Fully reset if mouse left
                }
            });
        }

        return button;
    }

    /** Helper for inline label + select */
    private createInlineSelectGroup(
        labelText: string,
        id: string,
        options: string[],
    ): HTMLDivElement {
        const group = document.createElement("div");
        Object.assign(group.style, {
            display: "flex",
            alignItems: "center", // Align label and select vertically
            gap: theme.spacing.xsmall, // Space between label and select
        });

        const label = document.createElement("label");
        Object.assign(label.style, {
            fontSize: theme.typography.fontSize.small,
            color: theme.colors.textSecondary, // Dimmer label text
            fontWeight: theme.typography.fontWeight.medium,
            whiteSpace: "nowrap", // Prevent label wrapping
        });
        label.textContent = labelText;
        label.htmlFor = id;

        const select = document.createElement("select");
        select.id = id;
        Object.assign(select.style, {
            padding: `${theme.spacing.xxsmall} ${theme.spacing.small}`, // Reduced padding
            backgroundColor: theme.colors.backgroundPrimary, // Use primary bg for contrast
            border: `1px solid ${theme.colors.borderPrimary}`,
            borderRadius: theme.borderRadius.small,
            color: theme.colors.textPrimary,
            fontSize: theme.typography.fontSize.small,
            outline: "none",
            appearance: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23${theme.colors.textSecondary.substring(1)}' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
            backgroundPosition: `right ${theme.spacing.small} center`, // Adjusted position
            backgroundRepeat: "no-repeat",
            backgroundSize: "0.8em 0.8em", // Smaller chevron
            cursor: "pointer",
            minWidth: "100px", // Give dropdown some base width
            lineHeight: "1.3", // Match button
        });
        options.forEach((v) => {
            const opt = new Option(v.charAt(0).toUpperCase() + v.slice(1), v); // Capitalize option text
            select.add(opt);
        });

        select.addEventListener("focus", () => {
            select.style.borderColor = theme.colors.accentPrimary;
            select.style.boxShadow = `0 0 0 1px ${theme.colors.accentPrimary}60`; // Subtle focus ring
        });
        select.addEventListener("blur", () => {
            select.style.borderColor = theme.colors.borderPrimary;
            select.style.boxShadow = "none";
        });

        group.appendChild(label);
        group.appendChild(select);
        return group;
    }

    private setPlaceholderMessage(text: string): void {
        if (!this.messageListContainer) return;
        this.messageListContainer
            .querySelectorAll(".message-item")
            .forEach((el) => el.remove());
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
                // Center vertically using flex on parent
                margin: "auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
            });
            this.messageListContainer.appendChild(placeholder);
        }
        placeholder.textContent = text;
    }

    private async loadMessages(): Promise<void> {
        if (!this.currentConversationId || this.isLoadingMessages) return;

        this.isLoadingMessages = true;
        this.setPlaceholderMessage("⏳ Loading messages..."); // Loading indicator
        this.displayFeedback("Loading messages...", "loading", 0); // No auto-hide for loading
        this.loadButton.disabled = true;
        const originalLoadHtml = this.loadButton.innerHTML;
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
                this.messageListContainer.innerHTML = ""; // Clear placeholder
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
            if (document.body.contains(this.loadButton)) {
                this.loadButton.disabled = false;
                this.loadButton.innerHTML = originalLoadHtml;
                this.loadButton.style.opacity = "1";
            }
        }
    }

    private displayMessages(
        messages: MessageInfo[],
        conversationId: string,
    ): void {
        if (!this.messageListContainer) return;
        this.messageListContainer.innerHTML = ""; // Clear

        const fragment = document.createDocumentFragment();
        messages.forEach((message, index) => {
            const item = document.createElement("div");
            item.classList.add("message-item");
            Object.assign(item.style, {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: theme.spacing.medium,
                padding: `${theme.spacing.small} ${theme.spacing.medium}`, // Adjusted padding
                borderBottom:
                    index < messages.length - 1 // No border on last item
                        ? `1px solid ${theme.colors.borderSecondary}`
                        : "none",
                backgroundColor: theme.colors.backgroundPrimary, // Match list container bg
                transition: "background-color 0.15s",
            });
            item.addEventListener("mouseenter", () => {
                item.style.backgroundColor = theme.colors.backgroundHover;
            });
            item.addEventListener("mouseleave", () => {
                item.style.backgroundColor = theme.colors.backgroundPrimary;
            });

            const textPreview = document.createElement("p");
            Object.assign(textPreview.style, {
                flexGrow: "1",
                margin: "0",
                color: theme.colors.textPrimary,
                fontSize: theme.typography.fontSize.small,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "calc(100% - 140px)", // Adjusted max width for smaller button
                lineHeight: theme.typography.lineHeight.small,
            });
            const previewText = message.parts.join(" ").trim();
            textPreview.textContent =
                previewText.substring(0, 120) + // Slightly longer preview
                (previewText.length > 120 ? "..." : "");
            textPreview.title = previewText;

            const downloadButton = document.createElement("button");
            Object.assign(downloadButton.style, {
                padding: `${theme.spacing.xxsmall} ${theme.spacing.small}`, // Compact padding
                border: `1px solid ${theme.colors.borderSecondary}`, // Subtle border
                borderRadius: theme.borderRadius.small,
                fontSize: theme.typography.fontSize.small,
                fontWeight: theme.typography.fontWeight.medium,
                cursor: "pointer",
                transition: `all ${theme.transitions.duration.fast} ${theme.transitions.easing}`,
                backgroundColor: "transparent", // Transparent default
                color: theme.colors.textSecondary, // Dimmer default text
                flexShrink: "0",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: theme.spacing.xsmall,
                lineHeight: "1",
            });
            downloadButton.innerHTML = `
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
                    <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/>
                 </svg>
                 <span>Download</span>
            `; // Keep text for clarity
            downloadButton.dataset.messageId = message.id;

            // Refined Hover/Active states for download button
            downloadButton.addEventListener("mouseover", () => {
                if (!downloadButton.disabled) {
                    downloadButton.style.backgroundColor =
                        theme.colors.accentPrimary;
                    downloadButton.style.color = theme.colors.backgroundPrimary;
                    downloadButton.style.borderColor =
                        theme.colors.accentPrimary;
                }
            });
            downloadButton.addEventListener("mouseout", () => {
                if (!downloadButton.disabled) {
                    downloadButton.style.backgroundColor = "transparent";
                    downloadButton.style.color = theme.colors.textSecondary;
                    downloadButton.style.borderColor =
                        theme.colors.borderSecondary;
                }
            });
            downloadButton.addEventListener("mousedown", () => {
                if (!downloadButton.disabled) {
                    downloadButton.style.backgroundColor =
                        theme.colors.accentActive;
                    downloadButton.style.color = theme.colors.backgroundPrimary;
                    downloadButton.style.borderColor =
                        theme.colors.accentActive;
                }
            });
            downloadButton.addEventListener("mouseup", () => {
                if (!downloadButton.disabled) {
                    // Revert to hover state if still hovering
                    if (downloadButton.matches(":hover")) {
                        downloadButton.style.backgroundColor =
                            theme.colors.accentPrimary;
                        downloadButton.style.color =
                            theme.colors.backgroundPrimary;
                        downloadButton.style.borderColor =
                            theme.colors.accentPrimary;
                    } else {
                        // Reset completely if mouse left
                        downloadButton.style.backgroundColor = "transparent";
                        downloadButton.style.color = theme.colors.textSecondary;
                        downloadButton.style.borderColor =
                            theme.colors.borderSecondary;
                    }
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
            fragment.appendChild(item);
        });
        this.messageListContainer.appendChild(fragment); // Append all at once
    }

    private async handleDownloadClick(
        messageId: string,
        conversationId: string,
        buttonElement: HTMLButtonElement,
    ): Promise<void> {
        const originalContent = buttonElement.innerHTML;
        buttonElement.disabled = true;
        // Use a simpler loading indicator for the small button
        buttonElement.innerHTML = `
             <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" style="margin: 0 auto;">
               <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41m-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9"/>
               <path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.5A5 5 0 0 0 8 3M3.5 9A5 5 0 0 0 8 13c1.552 0 2.94-.707 3.857-1.818a.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9z"/>
             </svg>`;
        Object.assign(buttonElement.style, {
            opacity: "0.7",
            cursor: "wait",
            color: theme.colors.accentPrimary, // Use accent color for spinner
            backgroundColor: theme.colors.backgroundActive, // Darker bg while loading
            borderColor: theme.colors.borderSecondary,
        });
        this.displayFeedback(
            `Requesting audio for message ${messageId.substring(0, 8)}...`,
            "loading",
            0,
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
                `✅ Audio download started`, // Simpler message
                "success",
                5000,
            );
        } catch (error) {
            this.displayFeedback(error as Error, "error");
        } finally {
            if (document.body.contains(buttonElement)) {
                buttonElement.disabled = false;
                buttonElement.innerHTML = originalContent;
                // Reset specific styles modified during loading
                buttonElement.style.opacity = "1";
                buttonElement.style.cursor = "pointer";
                buttonElement.style.backgroundColor = "transparent";
                buttonElement.style.color = theme.colors.textSecondary;
                buttonElement.style.borderColor = theme.colors.borderSecondary;
            }
        }
    }

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
            messageText = `❌ Error: ${message.name || "Unknown"} - ${message.message}`; // More compact error
        } else {
            messageText = message;
        }

        this.feedbackArea.textContent = messageText;
        this.feedbackArea.style.display = messageText ? "block" : "none";

        // Reset styles
        this.feedbackArea.style.borderColor = "transparent";
        this.feedbackArea.style.backgroundColor = "transparent";
        this.feedbackArea.style.color = theme.colors.textSecondary;

        switch (effectiveType) {
            case "success":
                this.feedbackArea.style.color = theme.colors.success;
                this.feedbackArea.style.borderColor = theme.colors.success;
                this.feedbackArea.style.backgroundColor = `${theme.colors.success}1A`;
                break;
            case "error":
                this.feedbackArea.style.color = theme.colors.error;
                this.feedbackArea.style.borderColor = theme.colors.error;
                this.feedbackArea.style.backgroundColor = `${theme.colors.error}1A`;
                break;
            case "loading":
            case "info":
            default:
                this.feedbackArea.style.color = theme.colors.textSecondary;
                this.feedbackArea.style.borderColor =
                    theme.colors.borderSecondary;
                this.feedbackArea.style.backgroundColor =
                    theme.colors.backgroundSecondary;
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
                }
            }, autoHideDelay);
            this.feedbackArea.dataset.hideTimeoutId = String(timeoutId);
        } else if (effectiveType === "loading") {
            // Keep loading message displayed
        }
    }
}
