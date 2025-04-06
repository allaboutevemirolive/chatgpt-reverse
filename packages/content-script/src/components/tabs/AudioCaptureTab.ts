// packages/content-script/src/components/tabs/AudioCaptureTab.ts
import { theme } from "@shared";
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
            this.convIdDisplay.textContent = `ID: ${this.currentConversationId}`;
            this.convIdDisplay.title = this.currentConversationId;
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

    private buildUI(): HTMLDivElement {
        const container = document.createElement("div");
        Object.assign(container.style, {
            display: "flex",
            flexDirection: "column",
            gap: theme.spacing.medium,
            padding: theme.spacing.large,
            boxSizing: "border-box",
            height: "100%",
            backgroundColor: theme.colors.backgroundSecondary,
        });

        const actionBar = document.createElement("div");
        Object.assign(actionBar.style, {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: theme.spacing.medium,
            flexShrink: "0",
            flexWrap: "wrap",
            padding: `${theme.spacing.small} 0`,
            borderBottom: `1px solid ${theme.colors.borderPrimary}`,
        });
        container.appendChild(actionBar);

        const leftGroup = document.createElement("div");
        Object.assign(leftGroup.style, {
            display: "flex",
            alignItems: "center",
            gap: theme.spacing.medium,
            flexWrap: "nowrap",
        });
        actionBar.appendChild(leftGroup);

        this.convIdDisplay = document.createElement("p");
        this.convIdDisplay.id = "audio-capture-conv-id";
        Object.assign(this.convIdDisplay.style, {
            padding: `${theme.spacing.xsmall} ${theme.spacing.small}`,
            backgroundColor: theme.colors.backgroundPrimary,
            border: `1px solid ${theme.colors.borderPrimary}`,
            borderRadius: theme.borderRadius.small,
            color: theme.colors.textSecondary,
            fontSize: theme.typography.fontSize.small,
            fontFamily: "monospace",
            margin: "0",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            width: "350px",

            lineHeight: "1.4",
            display: "flex",
            alignItems: "center",
            transition: "color 0.2s, opacity 0.2s",
            opacity: "0.7",
        });
        leftGroup.appendChild(this.convIdDisplay);

        this.loadButton = this.createActionButton(
            `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="margin-right: ${theme.spacing.xsmall};"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/></svg> Load Messages`,
            () => this.loadMessages(),
            true,
            "primary",
        );

        this.loadButton.style.padding = `${theme.spacing.xsmall} ${theme.spacing.medium}`;
        leftGroup.appendChild(this.loadButton);

        const rightGroup = document.createElement("div");
        Object.assign(rightGroup.style, {
            display: "flex",
            alignItems: "center",
            gap: theme.spacing.medium,
            flexWrap: "nowrap",
        });
        actionBar.appendChild(rightGroup);

        const voiceGroup = this.createInlineSelectGroup(
            "Voice:",
            "audio-voice-select",
            ["breeze", "cove", "ember", "juniper", "maple", "orbit", "vale"],
        );
        this.voiceSelect = voiceGroup.querySelector("select")!;
        rightGroup.appendChild(voiceGroup);

        const formatGroup = this.createInlineSelectGroup(
            "Format:",
            "audio-format-select",
            ["aac", "mp3", "opus", "flac"],
        );
        this.formatSelect = formatGroup.querySelector("select")!;
        rightGroup.appendChild(formatGroup);

        this.messageListContainer = document.createElement("div");
        this.messageListContainer.id = "audio-message-list";
        Object.assign(this.messageListContainer.style, {
            flexGrow: "1",
            overflowY: "auto",
            border: `1px solid ${theme.colors.borderPrimary}`,
            borderRadius: theme.borderRadius.medium,
            backgroundColor: theme.colors.backgroundPrimary,

            minHeight: "150px",
            marginTop: 0,
        });
        container.appendChild(this.messageListContainer);
        this.setPlaceholderMessage(
            "Navigate to a ChatGPT conversation page...",
        );

        this.feedbackArea = document.createElement("div");
        this.feedbackArea.id = "audio-capture-feedback";
        Object.assign(this.feedbackArea.style, {
            padding: `${theme.spacing.small} ${theme.spacing.medium}`,
            borderRadius: theme.borderRadius.small,
            border: `1px solid transparent`,
            color: theme.colors.textSecondary,
            fontSize: theme.typography.fontSize.small,
            minHeight: "24px",
            textAlign: "center",
            display: "none",
            transition: `all ${theme.transitions.duration.fast} ${theme.transitions.easing}`,
            flexShrink: "0",
            marginTop: "auto",
            backgroundColor: theme.colors.backgroundSecondary,
        });
        container.appendChild(this.feedbackArea);

        return container;
    }

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
            padding: `${theme.spacing.small} ${theme.spacing.large}`,
            border: `1px solid ${theme.colors.borderPrimary}`,
            borderRadius: theme.borderRadius.small,
            fontSize: theme.typography.fontSize.small,
            fontWeight: theme.typography.fontWeight.semibold,
            cursor: disabled ? "not-allowed" : "pointer",
            transition: `all ${theme.transitions.duration.fast} ${theme.transitions.easing}`,
            textAlign: "center",
            backgroundColor: theme.colors.backgroundSecondary,
            color: theme.colors.textPrimary,
            opacity: disabled ? "0.7" : "1",
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
            baseStyles.color = theme.colors.backgroundPrimary;
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
                Object.assign(button.style, baseStyles);
            });
            button.addEventListener("mousedown", () => {
                button.style.backgroundColor = activeBgColor;
                if (type === "primary")
                    button.style.color = theme.colors.backgroundPrimary;
                if (activeBorderColor !== "none")
                    button.style.borderColor = activeBorderColor;
                button.style.boxShadow = theme.shadows.small;
            });
            button.addEventListener("mouseup", () => {
                if (button.matches(":hover")) {
                    button.style.backgroundColor = hoverBgColor;
                    if (type === "primary")
                        button.style.color = theme.colors.backgroundPrimary;
                    if (hoverBorderColor !== "none")
                        button.style.borderColor = hoverBorderColor;
                    button.style.boxShadow = theme.shadows.medium;
                } else {
                    Object.assign(button.style, baseStyles);
                }
            });
        }

        return button;
    }

    private createInlineSelectGroup(
        labelText: string,
        id: string,
        options: string[],
    ): HTMLDivElement {
        const group = document.createElement("div");
        Object.assign(group.style, {
            display: "flex",
            alignItems: "center",
            gap: theme.spacing.xsmall,
        });

        const label = document.createElement("label");
        Object.assign(label.style, {
            fontSize: theme.typography.fontSize.small,
            color: theme.colors.textSecondary,
            fontWeight: theme.typography.fontWeight.medium,
            whiteSpace: "nowrap",
        });
        label.textContent = labelText;
        label.htmlFor = id;

        const select = document.createElement("select");
        select.id = id;
        Object.assign(select.style, {
            padding: `${theme.spacing.xxsmall} ${theme.spacing.small}`,
            backgroundColor: theme.colors.backgroundPrimary,
            border: `1px solid ${theme.colors.borderPrimary}`,
            borderRadius: theme.borderRadius.small,
            color: theme.colors.textPrimary,
            fontSize: theme.typography.fontSize.small,
            outline: "none",
            appearance: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23${theme.colors.textSecondary.substring(1)}' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
            backgroundPosition: `right ${theme.spacing.small} center`,
            backgroundRepeat: "no-repeat",
            backgroundSize: "0.8em 0.8em",
            cursor: "pointer",
            minWidth: "100px",
            lineHeight: "1.3",
        });
        options.forEach((v) => {
            const opt = new Option(v.charAt(0).toUpperCase() + v.slice(1), v);
            select.add(opt);
        });

        select.addEventListener("focus", () => {
            select.style.borderColor = theme.colors.accentPrimary;
            select.style.boxShadow = `0 0 0 1px ${theme.colors.accentPrimary}60`;
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
        this.setPlaceholderMessage("⏳ Loading messages...");
        this.displayFeedback("Loading messages...", "loading", 0);
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
                this.messageListContainer.innerHTML = "";
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
        this.messageListContainer.innerHTML = "";

        const fragment = document.createDocumentFragment();
        messages.forEach((message, index) => {
            const item = document.createElement("div");
            item.classList.add("message-item");
            Object.assign(item.style, {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: theme.spacing.medium,
                padding: `${theme.spacing.small} ${theme.spacing.medium}`,
                borderBottom:
                    index < messages.length - 1
                        ? `1px solid ${theme.colors.borderSecondary}`
                        : "none",
                backgroundColor: theme.colors.backgroundPrimary,
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
                maxWidth: "calc(100% - 140px)",
                lineHeight: theme.typography.lineHeight.small,
            });
            const previewText = message.parts.join(" ").trim();
            textPreview.textContent =
                previewText.substring(0, 120) +
                (previewText.length > 120 ? "..." : "");
            textPreview.title = previewText;

            const downloadButton = document.createElement("button");
            Object.assign(downloadButton.style, {
                padding: `${theme.spacing.xxsmall} ${theme.spacing.small}`,
                border: `1px solid ${theme.colors.borderSecondary}`,
                borderRadius: theme.borderRadius.small,
                fontSize: theme.typography.fontSize.small,
                fontWeight: theme.typography.fontWeight.medium,
                cursor: "pointer",
                transition: `all ${theme.transitions.duration.fast} ${theme.transitions.easing}`,
                backgroundColor: "transparent",
                color: theme.colors.textSecondary,
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
            `;
            downloadButton.dataset.messageId = message.id;

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
                    if (downloadButton.matches(":hover")) {
                        downloadButton.style.backgroundColor =
                            theme.colors.accentPrimary;
                        downloadButton.style.color =
                            theme.colors.backgroundPrimary;
                        downloadButton.style.borderColor =
                            theme.colors.accentPrimary;
                    } else {
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
        this.messageListContainer.appendChild(fragment);
    }

    private async handleDownloadClick(
        messageId: string,
        conversationId: string,
        buttonElement: HTMLButtonElement,
    ): Promise<void> {
        const originalContent = buttonElement.innerHTML;
        buttonElement.disabled = true;

        buttonElement.innerHTML = `
             <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" style="margin: 0 auto;">
               <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41m-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9"/>
               <path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.5A5 5 0 0 0 8 3M3.5 9A5 5 0 0 0 8 13c1.552 0 2.94-.707 3.857-1.818a.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9z"/>
             </svg>`;
        Object.assign(buttonElement.style, {
            opacity: "0.7",
            cursor: "wait",
            color: theme.colors.accentPrimary,
            backgroundColor: theme.colors.backgroundActive,
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
            this.displayFeedback(`✅ Audio download started`, "success", 5000);
        } catch (error) {
            this.displayFeedback(error as Error, "error");
        } finally {
            if (document.body.contains(buttonElement)) {
                buttonElement.disabled = false;
                buttonElement.innerHTML = originalContent;

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
            messageText = `❌ Error: ${message.name || "Unknown"} - ${message.message}`;
        } else {
            messageText = message;
        }

        this.feedbackArea.textContent = messageText;
        this.feedbackArea.style.display = messageText ? "block" : "none";

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
        }
    }
}
