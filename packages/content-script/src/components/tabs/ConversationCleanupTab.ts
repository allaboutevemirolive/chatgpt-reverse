// packages/content-script/src/components/tabs/ConversationCleanupTab.ts
import { theme } from "@shared";
import { fetchConversations, deleteConversationById } from "@/utils/apiUtils";
import type { SendMessageToSW } from "@/utils/swMessenger";

interface ConversationSummary {
    id: string;
    title: string;
}

const ITEMS_PER_PAGE = 28;

export class ConversationCleanupTab {
    private rootElement: HTMLDivElement;
    private sendMessage: SendMessageToSW;

    private conversations: ConversationSummary[] = [];
    private selectedConversationIds: Set<string> = new Set();
    private currentPage: number = 1;
    private totalPages: number = 1;
    private totalConversations: number = 0;
    private isLoading: boolean = false;
    private isDeleting: boolean = false;
    private error: string | null = null;

    private selectAllCheckbox!: HTMLInputElement;
    private selectAllLabel!: HTMLLabelElement;
    private listContainer!: HTMLDivElement;
    private paginationContainer!: HTMLDivElement;
    private deleteButton!: HTMLButtonElement;
    private refreshButton!: HTMLButtonElement;
    private feedbackArea!: HTMLDivElement;
    private listInfoArea!: HTMLParagraphElement;

    constructor(sendMessage: SendMessageToSW) {
        this.sendMessage = sendMessage;
        this.rootElement = this.buildUI();
        this.fetchDataForCurrentPage();
    }

    public getElement(): HTMLDivElement {
        return this.rootElement;
    }

    public updateConversationId(conversationId: string | null): void {
        console.log(
            `ConversationCleanupTab: Ignoring Conversation ID update: ${conversationId}`,
        );
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
            overflow: "hidden",
            backgroundColor: theme.colors.backgroundSecondary,
        });

        this.listContainer = document.createElement("div");
        Object.assign(this.listContainer.style, {
            flexGrow: "1",
            overflowY: "auto",
            border: `1px solid ${theme.colors.borderPrimary}`,
            borderRadius: theme.borderRadius.medium,
            backgroundColor: theme.colors.backgroundPrimary,
            position: "relative",
            boxShadow: theme.shadows.small,
            marginBottom: theme.spacing.small,
        });
        container.appendChild(this.listContainer);

        this.feedbackArea = document.createElement("div");
        this.feedbackArea.id = "cleanup-feedback-area";
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
        });
        container.appendChild(this.feedbackArea);

        const bottomBar = document.createElement("div");
        Object.assign(bottomBar.style, {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: theme.spacing.medium,
            borderTop: `1px solid ${theme.colors.borderPrimary}`,
            flexShrink: "0",
            gap: theme.spacing.medium,
            marginTop: "auto",
        });
        container.appendChild(bottomBar);

        const leftActions = document.createElement("div");
        Object.assign(leftActions.style, {
            display: "flex",
            alignItems: "center",
            gap: theme.spacing.medium,
        });
        bottomBar.appendChild(leftActions);

        this.deleteButton = this.createButton(
            "",
            () => this.handleDeleteSelected(),
            true,
            "danger",
        );
        this.deleteButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" style="margin-right: ${theme.spacing.xsmall}; flex-shrink: 0;">
                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
                <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
            </svg>
            <span>Delete Selected (0)</span>
        `;
        leftActions.appendChild(this.deleteButton);

        this.selectAllLabel = document.createElement("label");
        Object.assign(this.selectAllLabel.style, {
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
            fontSize: theme.typography.fontSize.small,
            color: theme.colors.textSecondary,
            fontWeight: theme.typography.fontWeight.medium,
            gap: theme.spacing.small,
            whiteSpace: "nowrap",
            opacity: "0.6",
        });
        leftActions.appendChild(this.selectAllLabel);

        this.selectAllCheckbox = document.createElement("input");
        this.selectAllCheckbox.type = "checkbox";
        this.selectAllCheckbox.id = "cleanup-select-all";
        this.selectAllCheckbox.disabled = true;
        Object.assign(this.selectAllCheckbox.style, {
            cursor: "pointer",
            width: "16px",
            height: "16px",
            accentColor: theme.colors.accentPrimary,
            margin: "0",
            flexShrink: "0",
        });
        this.selectAllCheckbox.addEventListener("change", (e) =>
            this.handleSelectAllChange(e),
        );
        this.selectAllLabel.appendChild(this.selectAllCheckbox);
        this.selectAllLabel.appendChild(document.createTextNode("Select Page"));

        const rightActions = document.createElement("div");
        Object.assign(rightActions.style, {
            display: "flex",
            alignItems: "center",
            gap: theme.spacing.medium,
        });
        bottomBar.appendChild(rightActions);

        const refreshIconSvg =
            '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" style="margin-right: 4px; flex-shrink: 0;"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/></svg>';
        this.refreshButton = this.createButton(
            `${refreshIconSvg}<span>Refresh</span>`,
            () => this.fetchDataForCurrentPage(),
            false,
            "default",
        );

        this.refreshButton.style.padding = `${theme.spacing.xsmall} ${theme.spacing.small}`;
        this.refreshButton.style.backgroundColor = "transparent";
        this.refreshButton.style.borderColor = theme.colors.borderSecondary;
        this.refreshButton.style.color = theme.colors.textSecondary;

        this.refreshButton.addEventListener("mouseenter", () => {
            if (!this.refreshButton.disabled) {
                this.refreshButton.style.backgroundColor =
                    theme.colors.backgroundHover;
                this.refreshButton.style.color = theme.colors.textPrimary;
                this.refreshButton.style.borderColor =
                    theme.colors.accentPrimary;
            }
        });
        this.refreshButton.addEventListener("mouseleave", () => {
            if (!this.refreshButton.disabled) {
                this.refreshButton.style.backgroundColor = "transparent";
                this.refreshButton.style.color = theme.colors.textSecondary;
                this.refreshButton.style.borderColor =
                    theme.colors.borderSecondary;
            }
        });
        rightActions.appendChild(this.refreshButton);

        this.listInfoArea = document.createElement("p");
        Object.assign(this.listInfoArea.style, {
            fontSize: theme.typography.fontSize.small,
            color: theme.colors.textSecondary,
            margin: "0",
            whiteSpace: "nowrap",
        });
        rightActions.appendChild(this.listInfoArea);

        this.paginationContainer = document.createElement("div");
        Object.assign(this.paginationContainer.style, {
            display: "flex",
            alignItems: "center",
            gap: theme.spacing.xsmall,
        });
        rightActions.appendChild(this.paginationContainer);

        this.renderPagination();

        return container;
    }

    private renderConversationList(): void {
        this.listContainer.innerHTML = "";
        const hasContent = this.conversations && this.conversations.length > 0;

        this.toggleSelectAllEnabled(hasContent && !this.isLoading);

        if (this.isLoading) {
            this.listContainer.appendChild(
                this.createStatusMessage("⏳ Loading conversations..."),
            );

            return;
        }
        if (this.error) {
            this.listContainer.appendChild(
                this.createStatusMessage(`❌ Error: ${this.error}`, true),
            );

            return;
        }
        if (!hasContent) {
            this.listContainer.appendChild(
                this.createStatusMessage("🗑️ No conversations found."),
            );

            return;
        }

        const fragment = document.createDocumentFragment();
        this.conversations.forEach(
            (conv: ConversationSummary, index: number) => {
                const item = document.createElement("div");
                Object.assign(item.style, {
                    display: "flex",
                    alignItems: "center",
                    gap: theme.spacing.medium,
                    padding: `${theme.spacing.small} ${theme.spacing.medium}`,
                    borderBottom:
                        index < this.conversations.length - 1
                            ? `1px solid ${theme.colors.borderSecondary}`
                            : "none",
                    cursor: "pointer",
                    transition: "background-color 0.1s ease-in-out",
                    boxSizing: "border-box",
                    backgroundColor: theme.colors.backgroundPrimary,
                });
                item.addEventListener("mouseenter", () => {
                    item.style.backgroundColor = theme.colors.backgroundHover;
                });
                item.addEventListener("mouseout", () => {
                    item.style.backgroundColor = theme.colors.backgroundPrimary;
                });
                item.addEventListener("click", (e) => {
                    if ((e.target as HTMLElement).tagName !== "INPUT") {
                        const checkbox =
                            item.querySelector<HTMLInputElement>("input");
                        if (checkbox) {
                            checkbox.checked = !checkbox.checked;
                            this.handleConversationCheckboxChange(
                                conv.id,
                                checkbox.checked,
                                checkbox,
                            );
                        }
                    }
                });

                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.value = conv.id;
                checkbox.checked = this.selectedConversationIds.has(conv.id);
                checkbox.id = `conv-checkbox-${conv.id}`;
                Object.assign(checkbox.style, {
                    cursor: "pointer",
                    width: "16px",
                    height: "16px",
                    accentColor: theme.colors.accentPrimary,
                    flexShrink: "0",
                    margin: "0",
                });
                checkbox.addEventListener("change", (e) => {
                    const target = e.target as HTMLInputElement;
                    this.handleConversationCheckboxChange(
                        conv.id,
                        target.checked,
                        target,
                    );
                });

                const titleLabel = document.createElement("label");
                titleLabel.htmlFor = checkbox.id;
                titleLabel.textContent =
                    conv.title || "(Untitled Conversation)";
                Object.assign(titleLabel.style, {
                    flexGrow: "1",
                    fontSize: theme.typography.fontSize.small,
                    fontWeight: theme.typography.fontWeight.medium,
                    color: theme.colors.textPrimary,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                    lineHeight: "1.3",
                });
                titleLabel.title = conv.title || "(Untitled Conversation)";

                item.appendChild(checkbox);
                item.appendChild(titleLabel);
                fragment.appendChild(item);
            },
        );
        this.listContainer.appendChild(fragment);

        this.updateSelectAllState();
    }

    private updateListInfo(text: string): void {
        if (this.listInfoArea) {
            this.listInfoArea.textContent = text;
        }
    }

    private createStatusMessage(
        text: string,
        isError: boolean = false,
    ): HTMLParagraphElement {
        const message = document.createElement("p");
        Object.assign(message.style, {
            textAlign: "center",
            padding: theme.spacing.large,
            color: isError ? theme.colors.error : theme.colors.textSecondary,
            fontSize: theme.typography.fontSize.medium,
            fontStyle: "italic",
            margin: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
        });
        message.textContent = text;
        return message;
    }

    private renderPagination(): void {
        this.paginationContainer.innerHTML = "";

        const isActionInProgress = this.isLoading || this.isDeleting;

        const infoText = this.isLoading
            ? `Loading...`
            : this.error
                ? `Error`
                : this.totalConversations > 0
                    ? `Showing ${this.conversations.length} of ${this.totalConversations}`
                    : `0 conversations`;
        this.updateListInfo(infoText);

        if (this.totalPages > 1 && !this.isLoading && !this.error) {
            const prevButton = this.createButton(
                "<",
                () => this.changePage(this.currentPage - 1),
                this.currentPage <= 1 || isActionInProgress,
            );
            prevButton.style.padding = theme.spacing.xsmall;
            prevButton.style.minWidth = "30px";
            prevButton.title = "Previous Page";
            prevButton.setAttribute("aria-label", "Previous Page");

            const pageIndicator = document.createElement("span");
            pageIndicator.textContent = `${this.currentPage} / ${this.totalPages}`;
            Object.assign(pageIndicator.style, {
                fontSize: theme.typography.fontSize.small,
                color: theme.colors.textSecondary,
                minWidth: "40px",
                textAlign: "center",
                whiteSpace: "nowrap",
            });

            const nextButton = this.createButton(
                ">",
                () => this.changePage(this.currentPage + 1),
                this.currentPage >= this.totalPages || isActionInProgress,
            );
            nextButton.style.padding = theme.spacing.xsmall;
            nextButton.style.minWidth = "30px";
            nextButton.title = "Next Page";
            nextButton.setAttribute("aria-label", "Next Page");

            this.paginationContainer.appendChild(prevButton);
            this.paginationContainer.appendChild(pageIndicator);
            this.paginationContainer.appendChild(nextButton);
        } else if (this.totalPages <= 1) {

            this.paginationContainer.innerHTML = "";
        }

        if (this.refreshButton) {
            this.refreshButton.disabled = isActionInProgress;
            this.refreshButton.style.opacity = isActionInProgress ? "0.6" : "1";
            this.refreshButton.style.cursor = isActionInProgress
                ? "not-allowed"
                : "pointer";
            if (isActionInProgress) {
                this.refreshButton.style.backgroundColor = "transparent";
                this.refreshButton.style.color = theme.colors.textSecondary;
                this.refreshButton.style.borderColor =
                    theme.colors.borderSecondary;
            }
        }

        this.toggleSelectAllEnabled(
            !isActionInProgress && this.conversations.length > 0,
        );
    }

    private createButton(
        textOrHtml: string,
        onClick: () => void,
        disabled: boolean = false,
        type: "default" | "danger" = "default",
    ): HTMLButtonElement {
        const button = document.createElement("button");
        if (textOrHtml.includes("<svg") || textOrHtml.includes("<span")) {
            button.innerHTML = textOrHtml;
        } else {
            button.textContent = textOrHtml;
        }
        button.disabled = disabled;
        button.addEventListener("click", onClick);

        const baseStyles: Partial<CSSStyleDeclaration> = {
            padding: `${theme.spacing.small} ${theme.spacing.medium}`,
            border: `1px solid ${theme.colors.borderPrimary}`,
            borderRadius: theme.borderRadius.small,
            fontSize: theme.typography.fontSize.small,
            fontWeight: theme.typography.fontWeight.medium,
            cursor: disabled ? "not-allowed" : "pointer",
            transition: `all ${theme.transitions.duration.fast} ${theme.transitions.easing}`,
            backgroundColor: theme.colors.backgroundSecondary,
            color: theme.colors.textPrimary,
            opacity: disabled ? "0.6" : "1",
            whiteSpace: "nowrap",
            lineHeight: "1.3",
            height: "32px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: theme.spacing.xsmall,
            boxShadow: "none",
        };

        let hoverBgColor = theme.colors.backgroundHover;
        let activeBgColor = theme.colors.backgroundActive;
        let hoverTextColor = theme.colors.textPrimary;
        let activeTextColor = theme.colors.textPrimary;
        let hoverBorderColor = theme.colors.accentPrimary;
        let activeBorderColor = theme.colors.accentActive;

        if (type === "danger") {
            baseStyles.color = theme.colors.error;
            baseStyles.borderColor = theme.colors.error;
            hoverBgColor = `${theme.colors.error}1A`;
            activeBgColor = `${theme.colors.error}33`;
            hoverTextColor = theme.colors.error;
            activeTextColor = theme.colors.error;
            hoverBorderColor = theme.colors.error;
            activeBorderColor = theme.colors.error;
        }

        Object.assign(button.style, baseStyles);

        if (!disabled) {
            button.addEventListener("mouseenter", () => {
                button.style.backgroundColor = hoverBgColor;
                button.style.color = hoverTextColor;
                button.style.borderColor = hoverBorderColor;
            });
            button.addEventListener("mouseleave", () => {
                Object.assign(button.style, baseStyles);
            });
            button.addEventListener("mousedown", () => {
                button.style.backgroundColor = activeBgColor;
                button.style.color = activeTextColor;
                button.style.borderColor = activeBorderColor;
            });
            button.addEventListener("mouseup", () => {
                if (button.matches(":hover")) {
                    button.style.backgroundColor = hoverBgColor;
                    button.style.color = hoverTextColor;
                    button.style.borderColor = hoverBorderColor;
                } else {
                    Object.assign(button.style, baseStyles);
                }
            });
        }

        return button;
    }

    private async fetchDataForCurrentPage(): Promise<void> {
        if (this.isLoading || this.isDeleting) return;

        this.isLoading = true;
        this.error = null;
        this.renderConversationList();
        this.renderPagination();
        this.updateDeleteButtonState();

        try {
            const offset = (this.currentPage - 1) * ITEMS_PER_PAGE;
            const response = await fetchConversations(
                { offset, limit: ITEMS_PER_PAGE, order: "updated" },
                this.sendMessage,
            );

            this.conversations = response.items.map((item) => ({
                id: item.id,
                title: item.title,
            }));
            this.totalConversations = response.total;
            this.totalPages = Math.ceil(response.total / ITEMS_PER_PAGE) || 1;
            this.error = null;

            if (this.currentPage > this.totalPages) {
                this.currentPage = this.totalPages;
            }
            this.selectedConversationIds.clear();
        } catch (err: unknown) {
            console.error("Failed to fetch conversations:", err);
            if (err instanceof Error) {
                this.error = err.message;
            } else {
                this.error = "An unknown error occurred while fetching.";
            }
            this.conversations = [];
            this.totalConversations = 0;
            this.totalPages = 1;
            this.currentPage = 1;
        } finally {
            this.isLoading = false;
            this.renderConversationList();
            this.renderPagination();
            this.updateDeleteButtonState();
            this.updateSelectAllState();
        }
    }

    private changePage(newPage: number): void {
        if (
            newPage >= 1 &&
            newPage <= this.totalPages &&
            newPage !== this.currentPage &&
            !this.isLoading &&
            !this.isDeleting
        ) {
            this.currentPage = newPage;
            this.selectedConversationIds.clear();
            if (this.selectAllCheckbox) this.selectAllCheckbox.checked = false;
            this.fetchDataForCurrentPage();
        }
    }

    private handleSelectAllChange(event: Event): void {
        const isChecked = (event.target as HTMLInputElement).checked;
        const currentConversationIds = this.conversations.map(
            (c: ConversationSummary) => c.id,
        );

        if (isChecked) {
            currentConversationIds.forEach((id: string) =>
                this.selectedConversationIds.add(id),
            );
        } else {
            currentConversationIds.forEach((id: string) =>
                this.selectedConversationIds.delete(id),
            );
        }

        this.listContainer
            .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
            .forEach((checkbox) => {
                checkbox.checked = this.selectedConversationIds.has(
                    checkbox.value,
                );
            });

        this.updateDeleteButtonState();
    }

    private handleConversationCheckboxChange(
        conversationId: string,
        isChecked: boolean,
        checkboxElement: HTMLInputElement,
    ): void {
        checkboxElement.checked = isChecked;

        if (isChecked) {
            this.selectedConversationIds.add(conversationId);
        } else {
            this.selectedConversationIds.delete(conversationId);
        }

        this.updateSelectAllState();
        this.updateDeleteButtonState();
    }

    private updateSelectAllState(): void {
        if (!this.selectAllCheckbox || this.conversations.length === 0) {
            if (this.selectAllCheckbox) this.selectAllCheckbox.checked = false;
            this.toggleSelectAllEnabled(false);
            return;
        }
        const allVisibleSelected = this.conversations.every(
            (conv: ConversationSummary) =>
                this.selectedConversationIds.has(conv.id),
        );
        this.selectAllCheckbox.checked = allVisibleSelected;

        this.toggleSelectAllEnabled(true);
    }

    private toggleSelectAllEnabled(enabled: boolean): void {
        if (this.selectAllCheckbox && this.selectAllLabel) {
            this.selectAllCheckbox.disabled = !enabled;
            this.selectAllLabel.style.cursor = enabled ? "pointer" : "default";
            this.selectAllLabel.style.opacity = enabled ? "1" : "0.6";
        }
    }

    private updateDeleteButtonState(): void {
        const count = this.selectedConversationIds.size;
        const isActionInProgress = this.isLoading || this.isDeleting;

        const textSpan = this.deleteButton.querySelector("span");
        if (textSpan) {
            textSpan.textContent = `Delete Selected (${count})`;
        }

        this.deleteButton.disabled = count === 0 || isActionInProgress;
        this.deleteButton.style.opacity = this.deleteButton.disabled
            ? "0.6"
            : "1";
    }

    private async handleDeleteSelected(): Promise<void> {
        if (
            this.isDeleting ||
            this.isLoading ||
            this.selectedConversationIds.size === 0
        ) {
            return;
        }
        const countToDelete = this.selectedConversationIds.size;
        if (!confirm(`Delete ${countToDelete} conversation(s)?`)) {
            return;
        }

        this.isDeleting = true;
        this.error = null;
        this.renderPagination();
        this.updateDeleteButtonState();
        this.displayFeedback(`Deleting ${countToDelete} items...`, "loading");

        const idsToDelete = Array.from(this.selectedConversationIds);
        let successCount = 0;
        let failureCount = 0;

        const deletePromises = idsToDelete.map(async (id) => {
            try {
                await deleteConversationById(id, this.sendMessage);
                return { id, success: true };
            } catch (err: unknown) {
                console.error(`Failed to delete conversation ${id}:`, err);
                return { id, success: false };
            }
        });

        const results = await Promise.all(deletePromises);

        results.forEach((result) => {
            if (result.success) {
                successCount++;
            } else {
                failureCount++;
            }
            this.selectedConversationIds.delete(result.id);
        });

        this.isDeleting = false;

        let feedbackMessage = "";
        let feedbackType: "success" | "error" | "warning" = "success";
        if (failureCount === 0) {
            feedbackMessage = `✅ Successfully deleted ${successCount} conversation(s).`;
        } else if (successCount === 0) {
            feedbackMessage = `❌ Failed to delete ${failureCount} conversation(s).`;
            feedbackType = "error";
        } else {
            feedbackMessage = `⚠️ Completed: ${successCount} deleted, ${failureCount} failed.`;
            feedbackType = "warning";
        }
        this.displayFeedback(feedbackMessage, feedbackType, 8000);

        await this.fetchDataForCurrentPage();
    }

    private displayFeedback(
        message: string,
        type: "success" | "error" | "loading" | "info" | "warning",
        autoHideDelay?: number,
    ): void {
        if (!this.feedbackArea) return;

        this.feedbackArea.textContent = message;
        this.feedbackArea.style.display = message ? "block" : "none";

        this.feedbackArea.style.borderColor = "transparent";
        this.feedbackArea.style.backgroundColor = "transparent";
        this.feedbackArea.style.color = theme.colors.textSecondary;

        switch (type) {
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
            case "warning":
                this.feedbackArea.style.color = theme.colors.warning;
                this.feedbackArea.style.borderColor = theme.colors.warning;
                this.feedbackArea.style.backgroundColor = `${theme.colors.warning}1A`;
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
                    this.feedbackArea.textContent === message
                ) {
                    this.feedbackArea.style.display = "none";
                }
            }, autoHideDelay);
            this.feedbackArea.dataset.hideTimeoutId = String(timeoutId);
        } else if (type === "loading") {

        }
    }
}
