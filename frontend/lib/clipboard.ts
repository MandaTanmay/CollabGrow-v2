/**
 * Copy text to clipboard with fallback support for non-HTTPS contexts
 * @param text - The text to copy to clipboard
 * @returns Promise<boolean> - Returns true if successful, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        // Try modern Clipboard API first (requires HTTPS or localhost)
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text)
            return true
        } else {
            // Fallback for browsers that don't support Clipboard API or non-secure contexts
            const textArea = document.createElement("textarea")
            textArea.value = text

            // Make the textarea invisible and positioned off-screen
            textArea.style.position = "fixed"
            textArea.style.left = "-999999px"
            textArea.style.top = "-999999px"
            textArea.setAttribute('readonly', '')

            document.body.appendChild(textArea)
            textArea.focus()
            textArea.select()

            // Try to copy using the old execCommand method
            const successful = document.execCommand('copy')
            textArea.remove()

            return successful
        }
    } catch (err) {
        console.error('Copy to clipboard error:', err)
        return false
    }
}
