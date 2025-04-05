/**
 * Generates a filename for the Markdown export based on creation time.
 * This function is intended to be called by the Content Script.
 * @param create_time - The conversation creation timestamp (in seconds).
 * @returns A formatted filename string.
 */
export function generateMarkdownFileName(create_time: number): string {
    const date = new Date(create_time * 1000);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");

    const sanitizedBase = `chatgpt-${year}-${month}-${day}-${hours}${minutes}${seconds}`;
    const finalFilename = sanitizedBase.replace(/[/\\?%*:|"<>]/g, "-") + ".md";

    return finalFilename;
}
