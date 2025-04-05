// packages/content-script/src/utils/downloadUtils.ts

/**
 * Triggers the download of an audio file using a Data URL.
 * Intended for Content Script use after receiving the Data URL from the Service Worker.
 */
export function triggerAudioDownload(
    dataUrl: string, // Expect Data URL string
    messageId: string,
    format: string,
    customFilename?: string,
): void {
    // Determine the filename
    const filename = customFilename || `chatgpt_audio_${messageId}.${format}`;

    let anchor: HTMLAnchorElement | null = null;
    try {
        // Create a temporary anchor element
        anchor = document.createElement("a");
        anchor.href = dataUrl; // Use the Data URL directly
        anchor.download = filename;

        // Append, click, remove
        document.body.appendChild(anchor);
        anchor.click();

        console.log(`Audio download triggered via Data URL for: ${filename}`);
    } catch (error) {
        console.error("Error triggering audio download via Data URL:", error);
    } finally {
        // Clean up: Remove the anchor
        if (anchor) {
            document.body.removeChild(anchor);
        }
        // No need to revokeObjectURL for Data URLs
    }
}


/**
 * Triggers a browser download for text content.
 * @param content - The string content to download.
 * @param filename - The desired name for the downloaded file.
 * @param mimeType - The MIME type for the file (defaults to text/plain).
 */
export function downloadTextFile(
    content: string,
    filename: string,
    mimeType: string = "text/plain;charset=utf-8",
): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    let anchor: HTMLAnchorElement | null = null;

    try {
        anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor); // Needs to be in DOM to be clickable in Firefox
        anchor.click();
        console.log(`Text file download triggered: ${filename}`);
    } catch (error) {
        console.error("Error triggering text file download:", error);
    } finally {
        if (anchor) {
            document.body.removeChild(anchor);
        }
        // Revoke the object URL to free up memory
        URL.revokeObjectURL(url);
    }
}

// You could potentially add other download helpers here in the future
// e.g., downloadBlob(blob: Blob, filename: string)
