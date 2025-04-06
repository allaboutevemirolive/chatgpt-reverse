// packages/content-script/src/utils/exportUtils.ts

/**
 * Generates a filename for the Markdown export based on creation time and title.
 * This function is intended to be called by the Content Script.
 * @param create_time - The conversation creation timestamp (in seconds).
 * @param title - Optional title to include in the filename.
 * @returns A formatted filename string.
 */
export function generateMarkdownFileName(
    create_time: number,
    title?: string, // Add optional title parameter
): string {
    const date = new Date(create_time * 1000);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");

    // Sanitize title part if provided
    const sanitizedTitle = title
        ? title
              .replace(/[/\\?%*:|"<>]/g, "-") // Remove illegal FS characters
              .replace(/\s+/g, "_") // Replace spaces with underscores
              .replace(/_+$/, "") // Remove trailing underscores
              .substring(0, 50) // Limit title part length
              .trim() // Trim leading/trailing whitespace just in case
        : "";

    const datePart = `${year}${month}${day}-${hours}${minutes}${seconds}`;

    // Construct filename, ensuring title part is used if valid
    const baseName =
        sanitizedTitle && sanitizedTitle.length > 0
            ? `ChatGPT_${sanitizedTitle}_${datePart}`
            : `ChatGPT_conv_${datePart}`;

    return `${baseName}.md`;
}
