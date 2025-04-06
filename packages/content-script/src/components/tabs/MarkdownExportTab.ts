// packages/content-script/src/components/tabs/MarkdownExportTab.ts
import { theme } from "@shared";
import { downloadTextFile } from "@/utils/downloadUtils";
import { generateMarkdownFileName } from "@/utils/exportUtils";
import { SendMessageToSW } from "@/utils/swMessenger";
import { fetchMarkdownExportData } from "@/utils/apiUtils";
import { ActionSidebar } from "../ActionSidebar";

interface ExportData {
    markdownContent: string;
    createTime: number;
    title: string;
}

type SidebarActionType = "primary" | "danger" | "default";
interface SidebarActionConfig {
    label: string;
    handler: () => void | Promise<void>;
    type?: SidebarActionType;
}

export class MarkdownExportTab {
    private rootElement: HTMLDivElement;
    private actionSidebar: ActionSidebar;
    private mainPanel: HTMLDivElement;

    private idInput!: HTMLInputElement;
    private filenameInput!: HTMLInputElement;

    private resultsPanel: HTMLDivElement | null = null;
    private feedbackContainer!: HTMLDivElement;

    private idStatusElement!: HTMLDivElement;
    private feedbackArea!: HTMLDivElement;

    private sendMessageToSW: SendMessageToSW;
    private isProcessing: boolean = false;
    private defaultFilename: string = "";
    private userModifiedFilename: boolean = false;
    private currentConversationId: string | null = null;

    private static animationStylesInjected = false;

    constructor(sendMessageFunction: SendMessageToSW) {
        this.sendMessageToSW = sendMessageFunction;

        this.rootElement = document.createElement("div");
        Object.assign(this.rootElement.style, {
            display: "flex",
            width: "100%",
            height: "100%",
            overflow: "hidden",
        });

        this.actionSidebar = new ActionSidebar();
        this.rootElement.appendChild(this.actionSidebar.getElement());

        this.mainPanel = this.createMainPanel();
        this.rootElement.appendChild(this.mainPanel);

        this.feedbackContainer = this.createFeedbackContainer();

        this.createInputFields();

        this.setupActionSidebar();

        MarkdownExportTab.injectAnimationStyles();

        requestAnimationFrame(() => {
            this.updateConversationId(null);
        });
    }

    private createFeedbackContainer(): HTMLDivElement {
        const feedbackDiv = document.createElement("div");
        feedbackDiv.id = "advance-tab-feedback";
        Object.assign(feedbackDiv.style, {
            marginTop: theme.spacing.medium,
            padding: theme.spacing.medium,
            backgroundColor: theme.colors.backgroundPrimary,
            borderRadius: theme.borderRadius.small,
            border: `1px solid ${theme.colors.borderSecondary}`,
            minHeight: "40px",
            color: theme.colors.textSecondary,
            fontSize: theme.typography.fontSize.small,
            fontStyle: "italic",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            transition: "color 0.3s ease",
        });
        feedbackDiv.textContent = "Action feedback will appear here briefly.";
        return feedbackDiv;
    }

    private static injectAnimationStyles(): void {
        if (this.animationStylesInjected) return;

        const spinKeyframes = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
        const spinClass = `.animate-spin { animation: spin 1s linear infinite; }`;
        const styleSheetId = "markdown-export-animations";

        if (document.getElementById(styleSheetId)) {
            this.animationStylesInjected = true;
            return;
        }

        const styleSheet = document.createElement("style");
        styleSheet.id = styleSheetId;
        styleSheet.textContent = spinKeyframes + spinClass;

        if (document.head) {
            document.head.appendChild(styleSheet);
            this.animationStylesInjected = true;
        } else {
            const inject = () => {
                if (document.head && !document.getElementById(styleSheetId)) {
                    document.head.appendChild(styleSheet);
                    this.animationStylesInjected = true;
                }

                document.removeEventListener("DOMContentLoaded", inject);
            };
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", inject);
            } else {
                if (document.head) {
                    inject();
                } else {
                    console.error(
                        "MarkdownExportTab: document.head not available for style injection even after DOM loaded.",
                    );
                }
            }
            console.warn(
                "MarkdownExportTab: document.head not immediately available for style injection, attempting fallback.",
            );
        }
    }

    public getElement(): HTMLDivElement {
        return this.rootElement;
    }

    public updateConversationId(id: string | null): void {
        if (!this.idInput || !this.filenameInput || !this.idStatusElement) {
            console.warn(
                "MarkdownExportTab: UI elements not ready for updateConversationId (likely called too early). Retrying.",
            );
            requestAnimationFrame(() => this.updateConversationId(id));
            return;
        }

        const previousId = this.currentConversationId;
        this.currentConversationId = id;

        if (id && id !== previousId && this.idInput.value !== id) {
            if (!this.idInput.value || this.idInput.value === previousId) {
                this.idInput.value = id;
                this.userModifiedFilename = false;
                this.suggestFilename(id);
            }
            this.idStatusElement.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="${theme.colors.success}" viewBox="0 0 16 16" style="flex-shrink: 0;">
                  <path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425z"/>
                </svg>
                <span style="color: ${theme.colors.textSecondary};">ID auto-detected.</span>
            `;
            this.idStatusElement.style.display = "flex";
        } else if (!id) {
            if (this.idInput.value === previousId) {
                this.idInput.value = "";
            }

            if (!this.idInput.value.trim()) {
                this.idStatusElement.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="${theme.colors.textTertiary}" viewBox="0 0 16 16" style="flex-shrink: 0;">
                      <path fill-rule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
                      <path d="M5.255 5.786a.237.237 0 0 0 .241.247h.825c.138 0 .248-.11.248-.247V5.786h.834v.263c0 .57-.463.942-.98.942h-.825A.98.98 0 0 1 6 6.247v-.261zm1.163.187a.25.25 0 0 0 .25.25h.825a.25.25 0 0 0 .25-.25V5.786h.834V6c0 .57-.463.942-.98.942h-.825a.98.98 0 0 1-.98-.942zm2.933 0a.25.25 0 0 0 .25.25h.825a.25.25 0 0 0 .25-.25V5.786h.834V6c0 .57-.463.942-.98.942h-.825a.98.98 0 0 1-.98-.942z"/>
                      <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0M7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0z"/>
                    </svg>
                    <span style="color: ${theme.colors.textTertiary}; font-style: italic;">No ID detected.</span>
                `;
                this.idStatusElement.style.display = "flex";
                if (!this.userModifiedFilename) {
                    this.filenameInput.value = "";
                    this.defaultFilename = "";
                }
            } else {
                this.updateIdStatusOnManualInput();
            }
        } else {
            this.updateIdStatusOnManualInput();
        }

        this.updateButtonStates();
    }

    private createMainPanel(): HTMLDivElement {
        const panel = document.createElement("div");
        Object.assign(panel.style, {
            flex: "1",
            padding: theme.spacing.large,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: theme.spacing.large,
            backgroundColor: theme.colors.backgroundSecondary,
        });

        return panel;
    }

    private createInputFields(): void {
        const formContainer = document.createElement("div");
        Object.assign(formContainer.style, {
            display: "flex",
            flexDirection: "column",
            gap: theme.spacing.large,
        });

        const fields = [
            {
                label: "Conversation ID",
                name: "conversationid",
                type: "text",
                defaultValue: "",
                placeholder: "Conversation ID (auto-detected or paste)",
            },
            {
                label: "Filename",
                name: "filename",
                type: "text",
                defaultValue: "",
                placeholder: "Defaults to ChatGPT_Title_Date.md",
            },
        ];

        fields.forEach((field) => {
            const fieldGroup = this.createFormField(
                field.label,
                field.name,
                field.type,
                field.defaultValue,
            );

            if (field.placeholder) {
                fieldGroup.input.placeholder = field.placeholder;
            }

            formContainer.appendChild(fieldGroup.container);

            if (field.name === "conversationid") {
                this.idInput = fieldGroup.input;

                this.idInput.addEventListener("input", () => {
                    this.updateButtonStates();
                    this.updateIdStatusOnManualInput();
                    if (!this.userModifiedFilename) {
                        this.suggestFilename(this.idInput.value.trim());
                    }
                });
                this.idInput.addEventListener("paste", () => {
                    setTimeout(() => {
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
                    this.updateIdStatusOnManualInput();
                });
            } else if (field.name === "filename") {
                this.filenameInput = fieldGroup.input;

                this.filenameInput.addEventListener("input", () => {
                    const currentVal = this.filenameInput.value.trim();
                    this.userModifiedFilename =
                        currentVal !== "" &&
                        currentVal !== this.defaultFilename;
                });
            }
        });

        this.mainPanel.appendChild(formContainer);
    }

    private updateIdStatusOnManualInput(): void {
        if (!this.idStatusElement || !this.idInput) return;

        const manualId = this.idInput.value.trim();
        const detectedId = this.currentConversationId;

        if (manualId && manualId === detectedId) {
            this.idStatusElement.innerHTML = `
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="${theme.colors.success}" viewBox="0 0 16 16" style="flex-shrink: 0;">
                   <path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425z"/>
                 </svg>
                 <span style="color: ${theme.colors.textSecondary};">ID auto-detected.</span>
             `;
            this.idStatusElement.style.display = "flex";
        } else if (manualId && detectedId && manualId !== detectedId) {
            this.idStatusElement.innerHTML = `
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="${theme.colors.warning}" viewBox="0 0 16 16" style="flex-shrink: 0;">
                    <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
                 </svg>
                 <span style="color: ${theme.colors.textSecondary};">Manual ID (differs).</span>
             `;
            this.idStatusElement.style.display = "flex";
        } else if (manualId && !detectedId) {
            this.idStatusElement.innerHTML = `
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="${theme.colors.textSecondary}" viewBox="0 0 16 16" style="flex-shrink: 0;">
                    <path fill-rule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1"/>
                    <path d="M9.5 14.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m-5 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m0-5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m5 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3"/>
                 </svg>
                 <span style="color: ${theme.colors.textSecondary};">Using manual ID.</span>
             `;
            this.idStatusElement.style.display = "flex";
        } else if (!manualId && detectedId) {
            this.idStatusElement.innerHTML = `
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="${theme.colors.warning}" viewBox="0 0 16 16" style="flex-shrink: 0;">
                    <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
                 </svg>
                 <span style="color: ${theme.colors.textSecondary};">Enter or paste an ID.</span>
             `;
            this.idStatusElement.style.display = "flex";
        } else {
            this.idStatusElement.innerHTML = `
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="${theme.colors.textTertiary}" viewBox="0 0 16 16" style="flex-shrink: 0;">
                   <path fill-rule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
                   <path d="M5.255 5.786a.237.237 0 0 0 .241.247h.825c.138 0 .248-.11.248-.247V5.786h.834v.263c0 .57-.463.942-.98.942h-.825A.98.98 0 0 1 6 6.247v-.261zm1.163.187a.25.25 0 0 0 .25.25h.825a.25.25 0 0 0 .25-.25V5.786h.834V6c0 .57-.463.942-.98.942h-.825a.98.98 0 0 1-.98-.942zm2.933 0a.25.25 0 0 0 .25.25h.825a.25.25 0 0 0 .25-.25V5.786h.834V6c0 .57-.463.942-.98.942h-.825a.98.98 0 0 1-.98-.942z"/>
                   <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0M7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0z"/>
                 </svg>
                 <span style="color: ${theme.colors.textTertiary}; font-style: italic;">No ID detected.</span>
             `;
            this.idStatusElement.style.display = "flex";
        }
    }

    private createFormField(
        label: string,
        name: string,
        type: string,
        defaultValue?: string,
    ): { container: HTMLDivElement; input: HTMLInputElement } {
        const container = document.createElement("div");
        const labelElement = document.createElement("label");
        const input = document.createElement("input");

        Object.assign(labelElement.style, {
            fontSize: theme.typography.fontSize.small,
            color: theme.colors.textSecondary,
            fontWeight: theme.typography.fontWeight.medium,
            flexShrink: "0",
        });
        labelElement.textContent = label;
        labelElement.htmlFor = `adv-input-${name}`;

        input.type = type;
        input.name = name;
        input.id = `adv-input-${name}`;

        if (type === "checkbox") {
            Object.assign(container.style, {
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: theme.spacing.small,
                padding: theme.spacing.small,
                backgroundColor: `${theme.colors.accentPrimary}15`,
                border: `1px solid ${theme.colors.accentPrimary}50`,
                borderRadius: theme.borderRadius.medium,
                marginTop: theme.spacing.xsmall,
            });

            labelElement.style.fontWeight = theme.typography.fontWeight.bold;
            labelElement.style.color = theme.colors.textPrimary;

            Object.assign(input.style, {
                accentColor: theme.colors.accentPrimary,
                width: "20px",
                height: "20px",
                cursor: "pointer",
                margin: "0",
            });
            (input as HTMLInputElement).checked = defaultValue === "true";

            container.appendChild(labelElement);
            container.appendChild(input);
        } else {
            Object.assign(container.style, {
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                gap: theme.spacing.xsmall,
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

            input.addEventListener("focus", () => {
                input.style.borderColor = theme.colors.accentPrimary;
                input.style.boxShadow = `0 0 0 1px ${theme.colors.accentPrimary}60`;
            });
            input.addEventListener("blur", () => {
                input.style.borderColor = theme.colors.borderPrimary;
                input.style.boxShadow = "none";
            });

            container.appendChild(labelElement);
            container.appendChild(input);
        }

        return { container, input };
    }

    private addSectionHeader(title: string): void {
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
            ],
        };

        const sidebarElement = this.actionSidebar.getElement();

        for (const sectionTitle in actionSections) {
            this.addSectionHeader(sectionTitle);
            actionSections[sectionTitle].forEach((action) => {
                this.actionSidebar.addAction(
                    action.label,
                    action.handler.bind(this),
                    action.type ?? "default",
                );
            });
        }

        const statusHeader = this.createSectionHeader("Status");
        sidebarElement.appendChild(statusHeader);

        this.idStatusElement = document.createElement("div");
        Object.assign(this.idStatusElement.style, {
            display: "flex",
            alignItems: "center",
            gap: theme.spacing.xsmall,
            padding: `${theme.spacing.small} ${theme.spacing.medium}`,
            fontSize: theme.typography.fontSize.small,
            color: theme.colors.textSecondary,
            borderRadius: theme.borderRadius.small,
            backgroundColor: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.borderSecondary}`,
            minHeight: "36px",
            marginTop: theme.spacing.xxsmall,
        });
        sidebarElement.appendChild(this.idStatusElement);

        this.feedbackArea = document.createElement("div");
        this.feedbackArea.id = "markdown-export-feedback";
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
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: theme.spacing.xsmall,
            marginTop: theme.spacing.medium,
            flexShrink: "0",
            wordBreak: "break-word",
        });
        this.feedbackArea.style.display = "none";
        sidebarElement.appendChild(this.feedbackArea);
    }

    private createSectionHeader(title: string): HTMLHeadingElement {
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

        if (!this.actionSidebar.getElement().querySelector("h3")) {
            header.style.marginTop = "0";
        }
        header.textContent = title;
        return header;
    }

    private async suggestFilename(conversationId: string): Promise<void> {
        if (!conversationId || !this.filenameInput) {
            if (this.filenameInput) this.filenameInput.value = "";
            this.defaultFilename = "";
            return;
        }
        if (this.userModifiedFilename) return;

        const originalPlaceholder = this.filenameInput.placeholder;
        this.filenameInput.placeholder = "Generating filename...";
        this.filenameInput.disabled = true;

        try {
            const exportData = await fetchMarkdownExportData(
                conversationId,
                this.sendMessageToSW,
            );
            this.defaultFilename = generateMarkdownFileName(
                exportData.createTime,
                exportData.title,
            );
            if (
                !this.userModifiedFilename &&
                document.body.contains(this.filenameInput)
            ) {
                this.filenameInput.value = this.defaultFilename;
            }
        } catch (error) {
            console.warn("Could not auto-generate filename:", error);
            this.defaultFilename = generateMarkdownFileName(Date.now() / 1000);
            if (
                !this.userModifiedFilename &&
                document.body.contains(this.filenameInput)
            ) {
                this.filenameInput.value = this.defaultFilename;
            }
            if (document.body.contains(this.filenameInput)) {
                this.filenameInput.placeholder =
                    "Defaults to ChatGPT_conv_Date.md";
            }
        } finally {
            if (document.body.contains(this.filenameInput)) {
                this.filenameInput.disabled = false;
                if (this.filenameInput.value) {
                    this.filenameInput.placeholder =
                        "Defaults to ChatGPT_Title_Date.md";
                } else {
                    this.filenameInput.placeholder = originalPlaceholder;
                }
            }
        }
    }

    private getFinalFilename(): string {
        if (!this.filenameInput)
            return generateMarkdownFileName(Date.now() / 1000) + ".md";

        let finalName = this.filenameInput.value.trim();

        if (!finalName) {
            finalName =
                this.defaultFilename ||
                generateMarkdownFileName(Date.now() / 1000);
        }

        if (!finalName.toLowerCase().endsWith(".md")) {
            finalName += ".md";
        }

        finalName = finalName.replace(/[/\\?%*:|"<>]/g, "-");
        finalName = finalName.replace(/^\.+/, "").trim();
        if (!finalName || finalName === ".md") {
            finalName =
                this.defaultFilename ||
                generateMarkdownFileName(Date.now() / 1000);
            if (!finalName.toLowerCase().endsWith(".md")) finalName += ".md";
        }
        return finalName;
    }

    private updateButtonStates(): void {
        const hasId = this.idInput && this.idInput.value.trim().length > 0;
        const isDisabled = !hasId || this.isProcessing;

        const buttons = this.actionSidebar
            .getElement()
            .querySelectorAll<HTMLButtonElement>("button");

        buttons.forEach((button) => {
            const wasDisabled = button.disabled;
            button.disabled = isDisabled;

            if (button.disabled !== wasDisabled) {
                button.style.opacity = isDisabled ? "0.5" : "1";
                button.style.cursor = isDisabled ? "not-allowed" : "pointer";

                if (!isDisabled && button.dataset.originalHtml) {
                    button.innerHTML = button.dataset.originalHtml;
                    delete button.dataset.originalHtml;
                } else if (isDisabled && !button.dataset.originalHtml) {
                    const span = button.querySelector("span");
                    if (span && span.textContent?.endsWith("...")) {
                    }
                }
            }
        });
    }

    private setProcessingState(
        isProcessing: boolean,
        actionText: string = "Processing",
        triggeredButtonText?: string,
    ): void {
        this.isProcessing = isProcessing;
        const buttons = this.actionSidebar
            .getElement()
            .querySelectorAll<HTMLButtonElement>("button");

        const spinnerSvg = `
            <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" style="margin-right: ${theme.spacing.xsmall}; flex-shrink: 0;">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.3" stroke-width="4"></circle>
              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>`;
        const spinnerHtml = (text: string) =>
            `${spinnerSvg}<span>${text}...</span>`;

        buttons.forEach((button) => {
            const buttonSpan = button.querySelector("span");
            const buttonLabel =
                buttonSpan?.textContent || button.textContent || "";
            const isTriggered =
                triggeredButtonText &&
                buttonLabel.includes(triggeredButtonText);

            if (isProcessing) {
                if (isTriggered && !button.dataset.originalHtml) {
                    button.dataset.originalHtml = button.innerHTML;
                }
                if (isTriggered) {
                    button.innerHTML = spinnerHtml(actionText);
                }
            } else {
                if (button.dataset.originalHtml) {
                    button.innerHTML = button.dataset.originalHtml;
                    delete button.dataset.originalHtml;
                }
            }
        });

        this.updateButtonStates();

        if (isProcessing) {
            this.displayFeedback(`⏳ ${actionText}...`, "loading", 0);
        }
    }

    private async fetchExportDataInternal(
        conversationId: string,
    ): Promise<ExportData | null> {
        if (!conversationId) {
            this.displayFeedback("Please provide a Conversation ID.", "error");
            return null;
        }

        try {
            const response = await fetchMarkdownExportData(
                conversationId,
                this.sendMessageToSW,
            );
            return response;
        } catch (error) {
            this.setProcessingState(false);
            this.displayFeedback(error as Error, "error");
            return null;
        }
    }

    private async handleExportClick(): Promise<void> {
        const conversationId = this.idInput?.value.trim();
        if (!conversationId || this.isProcessing) return;

        try {
            const exportData =
                await this.fetchExportDataInternal(conversationId);

            if (exportData) {
                const finalFilename = this.getFinalFilename();
                downloadTextFile(
                    exportData.markdownContent,
                    finalFilename,
                    "text/markdown;charset=utf-8",
                );

                this.displayResults(`Exported: ${finalFilename}`);

                if (
                    this.filenameInput &&
                    this.filenameInput.value === this.defaultFilename
                ) {
                    this.userModifiedFilename = false;
                    this.suggestFilename(conversationId);
                }
            }
        } catch (error) {
            if (
                !(
                    error instanceof Error &&
                    error.message.includes("Conversation fetch error")
                )
            ) {
                this.displayFeedback(
                    "Error during file preparation or download.",
                    "error",
                );
                console.error("File export process error:", error);
            }
        } finally {
            setTimeout(() => {
                this.setProcessingState(false);
            }, 100);
        }
    }

    private closeResultsPanel(): void {
        if (this.resultsPanel) {
            const panel = this.resultsPanel;
            this.resultsPanel = null;

            const handleTransitionEnd = (event: TransitionEvent) => {
                if (
                    event.propertyName === "opacity" &&
                    event.target === panel
                ) {
                    panel.remove();
                    panel.removeEventListener(
                        "transitionend",
                        handleTransitionEnd,
                    );
                }
            };
            panel.style.opacity = "0";
            panel.addEventListener("transitionend", handleTransitionEnd);

            setTimeout(() => {
                if (document.body.contains(panel)) {
                    panel.remove();
                    panel.removeEventListener(
                        "transitionend",
                        handleTransitionEnd,
                    );
                }
            }, 500);
        }
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
        button.innerHTML = "✕";
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

    private createResultsContent(): HTMLDivElement {
        const content = document.createElement("div");
        content.id = "advancetab-results-content";
        Object.assign(content.style, {
            padding: theme.spacing.medium,
            overflowY: "auto",
            flexGrow: "1",
            maxHeight: "calc(80vh - 60px)",
            minHeight: "100px",
        });
        return content;
    }

    private createResultsPanel(): HTMLDivElement {
        const panel = document.createElement("div");
        panel.id = "advancetab-results-panel";
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
            zIndex: "10001",
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

    private displayResults(response: any): void {
        this.closeResultsPanel();
        this.resultsPanel = this.createResultsPanel();
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
            color: theme.colors.success,
            fontSize: theme.typography.fontSize.small,
            lineHeight: theme.typography.lineHeight.medium,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflow: "auto",
            maxHeight: "calc(80vh - 100px)",
        });

        let displayText = "";

        if (typeof response === "object" && response !== null) {
            displayText = String(response ?? "No data received.");
        } else {
            displayText = String(response ?? "No data received.");
        }
        pre.textContent = `${displayText}`;

        content.appendChild(pre);
        document.body.appendChild(this.resultsPanel);
        requestAnimationFrame(() => {
            if (this.resultsPanel) this.resultsPanel.style.opacity = "1";
        });

        this.updateResultsFeedback("Action completed successfully.", false);
    }

    private updateResultsFeedback(
        message: string,
        isError: boolean = false,
    ): void {
        this.feedbackContainer.textContent = message;
        this.feedbackContainer.style.color = isError
            ? theme.colors.error
            : theme.colors.success;
        this.feedbackContainer.style.fontStyle = "normal";

        setTimeout(() => {
            if (this.feedbackContainer.textContent === message) {
                this.feedbackContainer.textContent =
                    "Action feedback will appear here briefly.";
                this.feedbackContainer.style.color = theme.colors.textSecondary;
                this.feedbackContainer.style.fontStyle = "italic";
            }
        }, 5000);
    }

    private async handleCopyToClipboardClick(): Promise<void> {
        const conversationId = this.idInput?.value.trim();
        if (!conversationId || this.isProcessing) return;

        try {
            const exportData =
                await this.fetchExportDataInternal(conversationId);

            if (exportData) {
                await navigator.clipboard.writeText(exportData.markdownContent);

                this.displayResults("Copied Markdown to clipboard!");
            }
        } catch (error) {
            if (
                error instanceof DOMException &&
                error.name === "NotAllowedError"
            ) {
                this.displayFeedback(
                    "Clipboard write permission denied.",
                    "error",
                );
            } else if (
                !(
                    error instanceof Error &&
                    error.message.includes("Conversation fetch error")
                )
            ) {
                this.displayFeedback("Failed to copy to clipboard.", "error");
                console.error("Clipboard write error:", error);
            }
        } finally {
            setTimeout(() => {
                this.setProcessingState(false);
            }, 100);
        }
    }

    private displayFeedback(
        message: string | Error,
        type: "success" | "error" | "loading" | "info" | "warning",
        autoHideDelay?: number,
    ): void {
        if (!this.feedbackArea) {
            console.error(
                "Feedback area not initialized in MarkdownExportTab.",
            );
            return;
        }

        let messageText: string;
        let effectiveType = type;
        let iconHtml = "";

        if (message instanceof Error) {
            effectiveType = "error";
            iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-circle-fill" viewBox="0 0 16 16" style="flex-shrink: 0;"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293z"/></svg>`;

            messageText = message.message || "An unknown error occurred.";

            if (message.message.includes("Conversation not found")) {
                messageText = "Error: Conversation not found (invalid ID?).";
            } else if (message.message.includes("Failed to fetch")) {
                messageText =
                    "Error: Network request failed. Check connection or service status.";
            } else {
                messageText = `Error: ${messageText}`;
            }
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
                    iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-info-circle-fill" viewBox="0 0 16 16" style="flex-shrink: 0;"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m.93-9.412l-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM8 5.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2"/></svg>`;
                    break;
            }
        }

        const spanElement = document.createElement("span");
        spanElement.textContent = messageText;
        Object.assign(spanElement.style, {
            overflowWrap: "break-word",
            wordWrap: "break-word",
            textAlign: "left",
            flexGrow: "1",
        });

        this.feedbackArea.innerHTML = iconHtml;
        this.feedbackArea.appendChild(spanElement);
        this.feedbackArea.style.display = messageText ? "flex" : "none";
        this.feedbackArea.style.justifyContent = "flex-start";

        let bgColor = theme.colors.backgroundSecondary;
        let textColor = theme.colors.textSecondary;
        let borderColor = theme.colors.borderSecondary;

        switch (effectiveType) {
            case "success":
                bgColor = `${theme.colors.success}1A`;
                textColor = theme.colors.success;
                borderColor = `${theme.colors.success}60`;
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
        this.feedbackArea.style.color = textColor;
        this.feedbackArea.style.borderColor = borderColor;

        const svgIcon = this.feedbackArea.querySelector("svg");
        if (svgIcon) {
            svgIcon.style.fill = textColor;
            svgIcon.style.flexShrink = "0";
        }

        requestAnimationFrame(() => {
            this.feedbackArea.style.opacity = "1";
        });

        const existingTimeout = Number(
            this.feedbackArea.dataset.hideTimeoutId || 0,
        );
        if (existingTimeout) clearTimeout(existingTimeout);
        this.feedbackArea.dataset.hideTimeoutId = "";

        if (autoHideDelay && autoHideDelay > 0 && effectiveType !== "loading") {
            const fadeDuration = parseInt(
                theme.transitions.duration.normal || "300",
            );
            const timeoutId = setTimeout(() => {
                const currentSpanContent =
                    this.feedbackArea.querySelector("span")?.textContent;
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
            this.feedbackArea.style.opacity = "1";
        }
    }
}
