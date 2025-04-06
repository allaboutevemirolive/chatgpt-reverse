// packages/content-script/src/components/ActionSidebar.ts
import { theme } from "@shared";

export class ActionSidebar {
    private sidebar: HTMLDivElement;

    constructor() {
        console.log("ActionSidebar initialized");
        this.sidebar = this.createSidebar();
    }

    private createSidebar(): HTMLDivElement {
        const sidebar = document.createElement("div");

        Object.assign(sidebar.style, {
            width: "260px",
            borderRight: `1px solid ${theme.colors.borderPrimary}`,
            backgroundColor: theme.colors.backgroundPrimary,
            padding: theme.spacing.small,
            display: "flex",
            flexDirection: "column",
            gap: theme.spacing.xsmall,
            overflowY: "auto",
            boxShadow: theme.shadows.small,
            flexShrink: "0",
        });

        return sidebar;
    }

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
                color: theme.colors.backgroundPrimary,
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

            hoverBgColor = `${theme.colors.error}1A`;
            activeBgColor = `${theme.colors.error}33`;
        }

        Object.assign(button.style, baseStyles);
        button.textContent = text;
        button.addEventListener("click", handler);

        button.addEventListener("mouseenter", () => {
            button.style.backgroundColor = hoverBgColor;
            if (type === "danger") button.style.color = theme.colors.error;
            else if (type !== "primary")
                button.style.color = theme.colors.textPrimary;
            button.style.transform = "translateY(-1px)";
            button.style.boxShadow = theme.shadows.medium;
        });

        button.addEventListener("mouseleave", () => {
            Object.assign(button.style, baseStyles);
            button.style.transform = "translateY(0)";
            button.style.boxShadow = "none";
        });

        button.addEventListener("focus", () => {
            button.style.outline = `2px solid ${theme.colors.accentPrimary}`;
            button.style.outlineOffset = "2px";
        });
        button.addEventListener("blur", () => {
            button.style.outline = "none";
        });

        button.addEventListener("mousedown", () => {
            button.style.backgroundColor = activeBgColor;
            button.style.transform = "translateY(0)";
            button.style.boxShadow = theme.shadows.small;
        });
        button.addEventListener("mouseup", () => {
            if (button.matches(":hover")) {
                button.style.backgroundColor = hoverBgColor;
                button.style.transform = "translateY(-1px)";
                button.style.boxShadow = theme.shadows.medium;
            } else {
                Object.assign(button.style, baseStyles);
                button.style.transform = "translateY(0)";
                button.style.boxShadow = "none";
            }
        });

        return button;
    }

    public addAction(
        text: string,
        handler: () => void,
        type: "primary" | "danger" | "default" = "default",
    ): void {
        const button = this.createActionButton(text, handler, type);
        this.sidebar.appendChild(button);
    }

    public getElement(): HTMLDivElement {
        return this.sidebar;
    }
}
