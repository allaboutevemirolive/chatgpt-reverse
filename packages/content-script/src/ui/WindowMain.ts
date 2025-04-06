// packages/content-script/src/ui/WindowMain.ts
import { theme } from "@shared";
import {
    MarkdownExport,
    Advances,
    AudioCapture,
    ConversationCleanup,
    tabsConfig,
    TabName,
} from "../constants/tabConfig";
import { MarkdownExportTab } from "../components/tabs/MarkdownExportTab";
import { AudioCaptureTab } from "../components/tabs/AudioCaptureTab";
import { AdvanceTab } from "../components/tabs/AdvanceTab";
import { ConversationCleanupTab } from "../components/tabs/ConversationCleanupTab";
import { sendMessageToSW, SendMessageToSW } from "../utils/swMessenger";

const WINDOW_MAIN_ID = "chrome-ext-window-main";
const WINDOW_MAIN_OVERLAY_ID = "chrome-ext-window-main-overlay";

export class WindowMain {
    private modal!: HTMLDivElement;
    private content!: HTMLDivElement;
    private sidebar!: HTMLDivElement;
    private mainContent!: HTMLDivElement;
    private overlay!: HTMLDivElement;

    private advanceTab!: AdvanceTab;
    private markdownTab!: MarkdownExportTab;
    private audioTab!: AudioCaptureTab;
    private cleanupTab!: ConversationCleanupTab;

    private tabs: Map<
        TabName,
        { button: HTMLButtonElement; container: HTMLDivElement }
    > = new Map();
    private activeTabName: TabName = Advances.name;
    private isVisible: boolean = false;
    private currentConversationId: string | null = null;

    private static instance: WindowMain | null = null;

    private constructor() {
        if (document.getElementById(WINDOW_MAIN_ID)) {
            if (WindowMain.instance) {
                console.warn(
                    "WindowMain already initialized. Returning existing instance.",
                );
                return WindowMain.instance;
            }
            throw new Error(
                "WindowMain DOM element exists but instance is null. Potential script conflict or error.",
            );
        }

        this.overlay = this.createOverlay();
        this.modal = this.createModal();
        this.content = this.createContent();
        this.sidebar = this.createSidebar();
        this.mainContent = this.createMainContent();

        const sharedSendMessageFn: SendMessageToSW = sendMessageToSW;
        this.advanceTab = new AdvanceTab();
        this.markdownTab = new MarkdownExportTab(sharedSendMessageFn);
        this.audioTab = new AudioCaptureTab(sharedSendMessageFn);
        this.cleanupTab = new ConversationCleanupTab(sharedSendMessageFn);

        this.initializeLayout();
        this.initializeTabs();
        this.hide();

        document.body.appendChild(this.overlay);
        document.body.appendChild(this.modal);

        this.setupKeyboardListener();
        this.setupUrlChangeListener();

        WindowMain.instance = this;
        console.log("WindowMain initialized.");
    }

    private initializeLayout(): void {
        this.content.appendChild(this.sidebar);
        this.content.appendChild(this.mainContent);
        this.modal.appendChild(this.content);
    }

    private initializeTabs(): void {
        this.currentConversationId = this.detectConversationIdFromUrl();
        this.activeTabName = this.currentConversationId
            ? AudioCapture.name
            : Advances.name;

        tabsConfig.forEach(({ name, icon, label }) => {
            this.createTab(name, icon, label);
        });

        this.switchTab(this.activeTabName);
    }

    private createTab(name: TabName, icon: string, label: string): void {
        const tabButton = this.createTabButton(name, icon, label);
        this.sidebar.appendChild(tabButton);

        const tabContentContainer = document.createElement("div");
        Object.assign(tabContentContainer.style, {
            display: "none",
            flexDirection: "column",
            height: "100%",
            width: "100%",
            overflow: "hidden",
            position: "relative",
        });

        let contentElement: HTMLElement | null = null;
        let allowContainerScroll = false;

        switch (name) {
            case Advances.name:
                contentElement = this.advanceTab.getElement();
                Object.assign(contentElement.style, {
                    width: "100%",
                    height: "100%",
                    boxShadow: "none",
                    border: "none",
                    borderRadius: "0",
                });
                allowContainerScroll = true;
                break;
            case MarkdownExport.name:
                contentElement = this.markdownTab.getElement();
                Object.assign(contentElement.style, {
                    width: "100%",
                    height: "100%",
                });
                allowContainerScroll = true;
                break;
            case AudioCapture.name:
                contentElement = this.audioTab.getElement();
                Object.assign(contentElement.style, {
                    width: "100%",
                    height: "100%",
                });
                allowContainerScroll = false;
                break;

            case ConversationCleanup.name:
                contentElement = this.cleanupTab.getElement();
                Object.assign(contentElement.style, {
                    width: "100%",
                    height: "100%",
                });
                allowContainerScroll = true;
                break;
            default:
                const knownTab = tabsConfig.find((t) => t.name === name);
                if (knownTab) {
                    console.warn(
                        `No specific component class instance found for tab: ${name}. Using placeholder.`,
                    );
                    contentElement = this.createPlaceholderContent(
                        knownTab.label,
                    );
                    allowContainerScroll = true;
                } else {
                    console.error(
                        `Unknown tab name encountered during creation: ${name}`,
                    );

                    return;
                }
                break;
        }

        if (contentElement) {
            if (allowContainerScroll) {
                tabContentContainer.style.overflowY = "auto";
                Object.assign(contentElement.style, { minHeight: "100%" });
            } else {
                tabContentContainer.style.overflowY = "hidden";
            }

            tabContentContainer.appendChild(contentElement);
            this.mainContent.appendChild(tabContentContainer);
            this.tabs.set(name, {
                button: tabButton,
                container: tabContentContainer,
            });
        }
    }

    private switchTab(tabNameToActivate: TabName): void {
        if (!this.tabs.has(tabNameToActivate)) {
            console.warn(
                `Attempted to switch to non-existent tab: ${tabNameToActivate}`,
            );
            return;
        }
        this.activeTabName = tabNameToActivate;

        this.updateTabConversationContext();

        this.tabs.forEach((tabData, name) => {
            const isActive = name === this.activeTabName;
            tabData.container.style.display = isActive ? "flex" : "none";
            this.updateTabButtonStyle(tabData.button, isActive);
        });

        console.log(`Switched to tab: ${this.activeTabName}`);
    }

    private updateTabConversationContext(): void {
        const activeTabInstance = this.getActiveTabInstance();
        if (
            activeTabInstance &&
            typeof activeTabInstance.updateConversationId === "function"
        ) {
            activeTabInstance.updateConversationId(this.currentConversationId);
        }
    }

    private getActiveTabInstance(): {
        updateConversationId?: (id: string | null) => void;
    } | null {
        switch (this.activeTabName) {
            case MarkdownExport.name:
                return this.markdownTab;
            case AudioCapture.name:
                return this.audioTab;
            case Advances.name:
                return this.advanceTab;
            case ConversationCleanup.name:
                return this.cleanupTab;

            default:
                return null;
        }
    }

    private createModal(): HTMLDivElement {
        const modal = document.createElement("div");
        modal.id = WINDOW_MAIN_ID;
        Object.assign(modal.style, {
            position: "fixed",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%) scale(0.95)",
            width: "min(1200px, 95vw)",
            height: "min(750px, 90vh)",
            backgroundColor: theme.colors.backgroundPrimary,
            borderRadius: theme.borderRadius.medium,
            boxShadow: theme.shadows.xlarge,
            zIndex: "9999",
            opacity: "0",
            display: "none",
            overflow: "hidden",
            flexDirection: "column",
            border: `1px solid ${theme.colors.borderPrimary}`,
            transition: `opacity ${theme.transitions.duration.normal} ${theme.transitions.easing}, transform ${theme.transitions.duration.normal} ${theme.transitions.easing}`,
        });
        return modal;
    }

    private createContent(): HTMLDivElement {
        const content = document.createElement("div");
        Object.assign(content.style, {
            display: "flex",
            flex: "1",
            overflow: "hidden",
            backgroundColor: theme.colors.backgroundSecondary,
        });
        return content;
    }

    private createSidebar(): HTMLDivElement {
        const sidebar = document.createElement("div");
        Object.assign(sidebar.style, {
            width: "220px",
            flexShrink: "0",
            borderRight: `1px solid ${theme.colors.borderPrimary}`,
            backgroundColor: theme.colors.backgroundPrimary,
            display: "flex",
            flexDirection: "column",
            padding: theme.spacing.medium,
            gap: theme.spacing.xsmall,
            overflowY: "auto",
        });

        return sidebar;
    }

    private createMainContent(): HTMLDivElement {
        const mainContent = document.createElement("div");
        Object.assign(mainContent.style, {
            flex: "1",
            overflow: "hidden",
            position: "relative",
            backgroundColor: theme.colors.backgroundSecondary,
        });
        return mainContent;
    }

    private createOverlay(): HTMLDivElement {
        const overlay = document.createElement("div");
        overlay.id = WINDOW_MAIN_OVERLAY_ID;
        Object.assign(overlay.style, {
            position: "fixed",
            inset: "0",
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(3px)",
            zIndex: "9998",
            opacity: "0",
            display: "none",
            transition: `opacity ${theme.transitions.duration.normal} ${theme.transitions.easing}`,
        });
        overlay.addEventListener("click", () => this.hide());
        return overlay;
    }

    private createTabButton(
        name: TabName,
        icon: string,
        label: string,
    ): HTMLButtonElement {
        const button = document.createElement("button");
        Object.assign(button.style, {
            width: "100%",
            padding: `${theme.spacing.small} ${theme.spacing.medium}`,
            border: "none",
            borderRadius: theme.borderRadius.small,
            fontSize: theme.typography.fontSize.small,
            fontWeight: theme.typography.fontWeight.medium,
            cursor: "pointer",
            transition: `all ${theme.transitions.duration.fast} ${theme.transitions.easing}`,
            textAlign: "left" as const,
            backgroundColor: "transparent",
            color: theme.colors.textSecondary,
            letterSpacing: "0.2px",
            margin: `${theme.spacing.xxsmall} 0`,
            display: "flex",
            alignItems: "center",
            gap: theme.spacing.small,
            minHeight: "36px",
            lineHeight: theme.typography.lineHeight.small,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
        });
        const iconSpan = document.createElement("span");
        iconSpan.innerHTML = icon;
        Object.assign(iconSpan.style, {
            fontSize: theme.typography.fontSize.medium,
            width: "20px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: "0",
        });
        const labelSpan = document.createElement("span");
        labelSpan.textContent = label;
        button.appendChild(iconSpan);
        button.appendChild(labelSpan);
        this.setupTabButtonListeners(button, name);
        return button;
    }

    private createPlaceholderContent(label: string): HTMLDivElement {
        const container = document.createElement("div");
        Object.assign(container.style, {
            height: "100%",
            display: "flex",
            flexDirection: "column",
            gap: theme.spacing.large,
            padding: theme.spacing.large,
            boxSizing: "border-box",
            color: theme.colors.textSecondary,
        });
        const header = document.createElement("h2");
        Object.assign(header.style, {
            margin: 0,
            fontSize: theme.typography.fontSize.large,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.textPrimary,
            borderBottom: `1px solid ${theme.colors.borderPrimary}`,
            paddingBottom: theme.spacing.medium,
        });
        header.textContent = label;
        const content = document.createElement("div");
        Object.assign(content.style, {
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: theme.typography.fontSize.medium,
        });
        content.textContent = `${label} content area placeholder.`;
        container.appendChild(header);
        container.appendChild(content);
        return container;
    }

    private detectConversationIdFromUrl(): string | null {
        try {
            const url = new URL(window.location.href);
            if (url.hostname.includes("chatgpt.com")) {
                const match = url.pathname.match(/^\/c\/([a-fA-F0-9-]+)/);
                if (match && match[1]) {
                    return match[1];
                }
            }
        } catch (e) {
            console.error("WindowMain: Error parsing current URL:", e);
        }
        return null;
    }

    private handleUrlChange(): void {
        const newId = this.detectConversationIdFromUrl();
        if (newId !== this.currentConversationId) {
            console.log(
                `WindowMain: Conversation ID changed from ${this.currentConversationId} to ${newId}`,
            );
            this.currentConversationId = newId;
            this.updateTabConversationContext();
        }
    }

    private setupUrlChangeListener(): void {
        if ("navigation" in window) {
            (window as any).navigation.addEventListener("navigate", () => {
                setTimeout(() => this.handleUrlChange(), 100);
            });
        } else {
            window.addEventListener("popstate", () => this.handleUrlChange());
            console.warn(
                "WindowMain: Navigation API not supported, URL detection relies on popstate.",
            );
        }
        this.handleUrlChange();
    }

    private setupTabButtonListeners(
        button: HTMLButtonElement,
        tabName: TabName,
    ): void {
        button.addEventListener("click", () => this.switchTab(tabName));
        button.addEventListener("mouseover", () => {
            if (this.activeTabName !== tabName)
                this.updateTabButtonStyle(button, false, true);
        });
        button.addEventListener("mouseout", () =>
            this.updateTabButtonStyle(button, this.activeTabName === tabName),
        );
    }

    private updateTabButtonStyle(
        button: HTMLButtonElement,
        isActive: boolean,
        isHovering: boolean = false,
    ): void {
        if (isActive) {
            Object.assign(button.style, {
                backgroundColor: theme.colors.backgroundActive,
                color: theme.colors.accentPrimary,
                fontWeight: theme.typography.fontWeight.semibold,
            });
        } else if (isHovering) {
            Object.assign(button.style, {
                backgroundColor: theme.colors.backgroundHover,
                color: theme.colors.textPrimary,
                fontWeight: theme.typography.fontWeight.medium,
            });
        } else {
            Object.assign(button.style, {
                backgroundColor: "transparent",
                color: theme.colors.textSecondary,
                fontWeight: theme.typography.fontWeight.medium,
            });
        }
    }

    private setupKeyboardListener(): void {
        document.addEventListener(
            "keydown",
            (e: KeyboardEvent) => {
                if (e.ctrlKey && e.code === "KeyG") {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggle();
                } else if (e.code === "Escape" && this.isVisible) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.hide();
                }
            },
            true,
        );
    }

    private toggle(): void {
        this.isVisible ? this.hide() : this.show();
    }

    public show(): void {
        if (this.isVisible) return;
        this.modal.style.display = "flex";
        this.overlay.style.display = "block";
        requestAnimationFrame(() => {
            this.modal.style.opacity = "1";
            this.overlay.style.opacity = "1";
            this.modal.style.transform = "translate(-50%, -50%) scale(1)";
        });
        this.isVisible = true;
        this.handleUrlChange();
        console.log("WindowMain shown.");
    }

    public hide(): void {
        if (!this.isVisible) return;
        const modalElement = this.modal;
        const overlayElement = this.overlay;
        const handleTransitionEnd = (event: TransitionEvent) => {
            if (
                event.propertyName === "opacity" &&
                (event.target === modalElement ||
                    event.target === overlayElement)
            ) {
                if (
                    modalElement.style.opacity === "0" &&
                    overlayElement.style.opacity === "0"
                ) {
                    modalElement.style.display = "none";
                    overlayElement.style.display = "none";
                    modalElement.removeEventListener(
                        "transitionend",
                        handleTransitionEnd,
                    );
                    overlayElement.removeEventListener(
                        "transitionend",
                        handleTransitionEnd,
                    );
                    console.log("WindowMain hidden after transition.");
                }
            }
        };
        this.modal.style.opacity = "0";
        this.overlay.style.opacity = "0";
        this.modal.style.transform = "translate(-50%, -50%) scale(0.95)";
        this.modal.addEventListener("transitionend", handleTransitionEnd);
        this.overlay.addEventListener("transitionend", handleTransitionEnd);
        this.isVisible = false;
        setTimeout(
            () => {
                if (!this.isVisible) {
                    modalElement.style.display = "none";
                    overlayElement.style.display = "none";
                    modalElement.removeEventListener(
                        "transitionend",
                        handleTransitionEnd,
                    );
                    overlayElement.removeEventListener(
                        "transitionend",
                        handleTransitionEnd,
                    );
                }
            },
            theme.transitions.duration.normal
                ? parseInt(theme.transitions.duration.normal) + 50
                : 500,
        );
    }

    public static initialize(): WindowMain {
        if (!WindowMain.instance) {
            if (document.getElementById(WINDOW_MAIN_ID)) {
                console.warn(
                    "WindowMain.initialize() called but DOM element already exists.",
                );
                throw new Error(
                    "WindowMain DOM exists but instance wasn't found.",
                );
            }
            WindowMain.instance = new WindowMain();
        }
        return WindowMain.instance;
    }
}
