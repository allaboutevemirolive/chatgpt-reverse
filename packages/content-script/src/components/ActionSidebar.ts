// Import theme - make sure the path is correct relative to the new file location
import { theme } from "@shared";

export class ActionSidebar {
    private sidebar: HTMLDivElement;

    constructor() {
        console.log("ActionSidebar initialized"); // Log new name
        this.sidebar = this.createSidebar();
    }

    private createSidebar(): HTMLDivElement {
        const sidebar = document.createElement("div");
        // Styling remains the same
        Object.assign(sidebar.style, {
            width: "260px", // Consider if this width is appropriate or should be configurable
            borderRight: `1px solid ${theme.colors.borderPrimary}`,
            backgroundColor: theme.colors.backgroundPrimary,
            padding: theme.spacing.small,
            display: "flex",
            flexDirection: "column",
            gap: theme.spacing.xsmall,
            overflowY: "auto",
            boxShadow: theme.shadows.small,
            flexShrink: "0", // Prevent shrinking if space is tight
        });

        const title = document.createElement("h2");
        // Styling remains the same
        Object.assign(title.style, {
            margin: 0,
            fontSize: theme.typography.fontSize.medium,
            fontWeight: theme.typography.fontWeight.bold,
            color: theme.colors.textPrimary,
            padding: `${theme.spacing.small} ${theme.spacing.xsmall}`,
            borderBottom: `1px solid ${theme.colors.borderSecondary}`,
            letterSpacing: "0.3px",
            textAlign: "center", // Center the title
        });
        title.textContent = "Actions"; // Title specific to this sidebar's purpose
        sidebar.appendChild(title);

        return sidebar;
    }

    // createActionButton logic remains the same
    private createActionButton(
        text: string,
        handler: () => void,
        type: "primary" | "danger" | "default" = "default",
    ): HTMLButtonElement {
        const button = document.createElement("button");
        const baseStyles = {
            width: "100%",
            padding: `${theme.spacing.small} ${theme.spacing.medium}`,
            border: `1px solid ${theme.colors.borderPrimary}`,
            borderRadius: theme.borderRadius.small,
            fontSize: theme.typography.fontSize.small,
            fontWeight: theme.typography.fontWeight.medium,
            cursor: "pointer",
            transition: `all ${theme.transitions.duration.fast} ${theme.transitions.easing}`,
            textAlign: "left" as const,
            backgroundColor: theme.colors.backgroundSecondary,
            color: theme.colors.textPrimary,
            letterSpacing: "0.2px",
            margin: `${theme.spacing.xxsmall} 0`,
            display: "flex",
            alignItems: "center",
            gap: theme.spacing.xsmall,
            minHeight: "32px",
            lineHeight: theme.typography.lineHeight.small,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
        };

        let hoverBgColor = theme.colors.backgroundHover;
        let activeBgColor = theme.colors.backgroundActive;

        if (type === "primary") {
            Object.assign(baseStyles, {
                backgroundColor: theme.colors.accentPrimary,
                color: theme.colors.backgroundPrimary, // Ensure contrast
                border: "none",
                fontWeight: theme.typography.fontWeight.semibold,
            });
            hoverBgColor = theme.colors.accentHover;
            activeBgColor = theme.colors.accentActive;
        } else if (type === "danger") {
            Object.assign(baseStyles, {
                color: theme.colors.error,
                borderColor: theme.colors.error,
            });
            // Use semi-transparent error color for hover/active backgrounds
            hoverBgColor = `${theme.colors.error}1A`; // ~10% opacity
            activeBgColor = `${theme.colors.error}33`; // ~20% opacity
        }

        Object.assign(button.style, baseStyles);
        button.textContent = text;
        button.addEventListener("click", handler);

        // Hover/Focus States
        button.addEventListener("mouseenter", () => {
            button.style.backgroundColor = hoverBgColor;
            if (type === "danger") button.style.color = theme.colors.error; // Keep text red
            else if (type !== "primary") button.style.color = theme.colors.textPrimary; // Default/Danger hover text
            button.style.transform = "translateY(-1px)";
            button.style.boxShadow = theme.shadows.medium; // Add subtle shadow on hover
        });

        button.addEventListener("mouseleave", () => {
            Object.assign(button.style, baseStyles); // Reset to original styles
            button.style.transform = "translateY(0)";
            button.style.boxShadow = 'none';
        });

        button.addEventListener("focus", () => { // Add focus state for accessibility
            button.style.outline = `2px solid ${theme.colors.accentPrimary}`;
            button.style.outlineOffset = '2px';
        });
        button.addEventListener("blur", () => {
            button.style.outline = 'none';
        });


        // Active State
        button.addEventListener("mousedown", () => {
            button.style.backgroundColor = activeBgColor;
            button.style.transform = "translateY(0)"; // Remove hover lift
            button.style.boxShadow = theme.shadows.small; // Slightly less shadow when pressed
        });
        button.addEventListener("mouseup", () => { // Reset background on mouse up if still hovering
            if (button.matches(':hover')) {
                button.style.backgroundColor = hoverBgColor;
                button.style.transform = "translateY(-1px)"; // Re-apply hover lift
                button.style.boxShadow = theme.shadows.medium;
            } else {
                Object.assign(button.style, baseStyles); // Reset fully if mouse left
                button.style.transform = "translateY(0)";
                button.style.boxShadow = 'none';
            }
        });

        return button;
    }

    /**
     * Adds an action button to the sidebar.
     * @param text - The text label for the button.
     * @param handler - The function to execute when the button is clicked.
     * @param type - The visual style of the button ('primary', 'danger', 'default').
     */
    public addAction(
        text: string,
        handler: () => void,
        type: "primary" | "danger" | "default" = "default",
    ): void {
        const button = this.createActionButton(text, handler, type);
        this.sidebar.appendChild(button);
    }

    /**
     * Returns the root sidebar HTML element.
     */
    public getElement(): HTMLDivElement {
        return this.sidebar;
    }
}
