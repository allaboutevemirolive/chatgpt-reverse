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

/**
 * Manages the main floating window UI for the extension within the content script.
 * Handles tab switching, visibility toggling, and communication setup for tab components.
 */
export class WindowMain {
    // Core UI Elements
    private modal!: HTMLDivElement;
    private content!: HTMLDivElement;
    private sidebar!: HTMLDivElement;
    private mainContent!: HTMLDivElement;
    private overlay!: HTMLDivElement;

    // Tab Component Instances
    private advanceTab!: AdvanceTab;
    private markdownTab!: MarkdownExportTab;
    private audioTab!: AudioCaptureTab;
    private cleanupTab!: ConversationCleanupTab;

    // State and Management
    private tabs: Map<
        TabName,
        { button: HTMLButtonElement; container: HTMLDivElement }
    > = new Map();
    private activeTabName: TabName = Advances.name; // Default tab
    private isVisible: boolean = false;
    private currentConversationId: string | null = null; // Track current ChatGPT convo ID

    // Singleton instance
    private static instance: WindowMain | null = null;

    private constructor() {
        // Singleton Check
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

        // Create Core UI Elements
        this.overlay = this.createOverlay();
        this.modal = this.createModal();
        this.content = this.createContent();
        this.sidebar = this.createSidebar();
        this.mainContent = this.createMainContent();

        // Instantiate Tab Components
        const sharedSendMessageFn: SendMessageToSW = sendMessageToSW;
        this.advanceTab = new AdvanceTab(/* sharedSendMessageFn */); // Pass fn if needed
        this.markdownTab = new MarkdownExportTab(sharedSendMessageFn);
        this.audioTab = new AudioCaptureTab(sharedSendMessageFn);
        this.cleanupTab = new ConversationCleanupTab(sharedSendMessageFn);

        // Assemble UI and Initialize State
        this.initializeLayout();
        this.initializeTabs();
        this.hide();

        // Append to DOM
        document.body.appendChild(this.overlay);
        document.body.appendChild(this.modal);

        // Setup Event Listeners
        this.setupKeyboardListener();
        this.setupUrlChangeListener();

        WindowMain.instance = this;
        console.log("WindowMain initialized.");
    }

    // --- Initialization Methods ---

    /** Assembles the main layout structure */
    private initializeLayout(): void {
        this.content.appendChild(this.sidebar);
        this.content.appendChild(this.mainContent);
        this.modal.appendChild(this.content);
    }

    /** Creates tab buttons and content areas, sets the initial active tab */
    private initializeTabs(): void {
        this.currentConversationId = this.detectConversationIdFromUrl();
        this.activeTabName = this.currentConversationId
            ? AudioCapture.name // Default to Audio if on a conversation page
            : Advances.name; // Default to Advances/Advance otherwise

        tabsConfig.forEach(({ name, icon, label }) => {
            this.createTab(name, icon, label);
        });

        this.switchTab(this.activeTabName);
    }

    // --- Tab Creation and Switching ---

    /** Creates the button and content container for a single tab */
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
            // *** ADD CASE for ConversationCleanup ***
            case ConversationCleanup.name:
                contentElement = this.cleanupTab.getElement();
                Object.assign(contentElement.style, {
                    width: "100%",
                    height: "100%",
                });
                allowContainerScroll = true; // Assume the cleanup tab's content might scroll
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
                    // Avoid adding an empty container for unknown tabs
                    return; // Exit createTab early
                }
                break;
        }

        // Only proceed if we have a valid content element
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
        // No else needed here due to the early return/error log in the default case for unknown tabs
    }

    /** Activates the specified tab and deactivates others */
    private switchTab(tabNameToActivate: TabName): void {
        if (!this.tabs.has(tabNameToActivate)) {
            console.warn(
                `Attempted to switch to non-existent tab: ${tabNameToActivate}`,
            );
            return;
        }
        this.activeTabName = tabNameToActivate;

        this.updateTabConversationContext(); // Update context based on the *new* active tab

        this.tabs.forEach((tabData, name) => {
            const isActive = name === this.activeTabName;
            tabData.container.style.display = isActive ? "flex" : "none";
            this.updateTabButtonStyle(tabData.button, isActive);
        });

        console.log(`Switched to tab: ${this.activeTabName}`);
    }

    /** Notifies active tab (if applicable) about the current conversation ID */
    private updateTabConversationContext(): void {
        // Call the update method only on the *currently active* tab instance
        const activeTabInstance = this.getActiveTabInstance();
        if (
            activeTabInstance &&
            typeof activeTabInstance.updateConversationId === "function"
        ) {
            activeTabInstance.updateConversationId(this.currentConversationId);
        }
    }

    /** Helper to get the instance of the currently active tab component */
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
            // Add other cases here
            default:
                return null;
        }
    }

    // --- Core UI Element Creation Methods ---

    /** Creates the main modal window element */
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
    /** Creates the inner container holding sidebar and main content */
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
    /** Creates the left sidebar for navigation tabs */
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
        const title = document.createElement("h2");
        Object.assign(title.style, {
            margin: `0 0 ${theme.spacing.medium} 0`,
            fontSize: theme.typography.fontSize.medium,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.textPrimary,
            paddingBottom: theme.spacing.small,
            borderBottom: `1px solid ${theme.colors.borderSecondary}`,
            textAlign: "center",
        });
        title.textContent = "Extension Tools";
        sidebar.appendChild(title);
        return sidebar;
    }
    /** Creates the main content area where tab content is displayed */
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
    /** Creates the background overlay */
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
    /** Creates a button element for the sidebar */
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
    /** Creates placeholder content for tabs without specific components */
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

    // --- URL Detection & Handling ---

    /** Extracts ChatGPT conversation ID from the current URL */
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
    /** Handles URL changes to update the current conversation ID and notify active tab */
    private handleUrlChange(): void {
        const newId = this.detectConversationIdFromUrl();
        if (newId !== this.currentConversationId) {
            console.log(
                `WindowMain: Conversation ID changed from ${this.currentConversationId} to ${newId}`,
            );
            this.currentConversationId = newId;
            this.updateTabConversationContext(); // Update the currently active tab
        }
    }
    /** Sets up listeners for URL changes (SPA navigation) */
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
        this.handleUrlChange(); // Initial check
    }

    // --- Event Listeners and Helpers ---

    /** Adds click and hover listeners to a tab button */
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
    // formatTabName is likely unused now with direct labels
    /** Finds the button element for a given tab name */
    private findTabButton(name: TabName): HTMLButtonElement | null {
        return this.tabs.get(name)?.button ?? null;
    }
    /** Updates the visual style of a tab button based on active/hover state */
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
    /** Sets up the global keyboard listener for toggling and closing the window */
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

    // --- Visibility Control ---

    /** Toggles the visibility of the modal window */
    private toggle(): void {
        this.isVisible ? this.hide() : this.show();
    }
    /** Shows the modal window with transitions */
    public show(): void {
        if (this.isVisible) return;
        this.modal.style.display = "flex";
        this.overlay.style.display = "block";
        const _ = this.modal.offsetHeight;
        requestAnimationFrame(() => {
            this.modal.style.opacity = "1";
            this.overlay.style.opacity = "1";
            this.modal.style.transform = "translate(-50%, -50%) scale(1)";
        });
        this.isVisible = true;
        this.handleUrlChange();
        console.log("WindowMain shown.");
    }
    /** Hides the modal window with transitions */
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

    // --- Singleton Accessor ---

    /** Gets the singleton instance, initializing it if necessary */
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
