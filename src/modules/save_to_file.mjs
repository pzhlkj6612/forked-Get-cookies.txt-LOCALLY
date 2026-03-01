/**
 * Save text data as a file
 * Called from the background script (service worker) context.
 * @param {string} text
 * @param {string} name
 * @param {Format} format
 * @param {boolean} saveAs
 */
export default async function saveToFile(
  text,
  name,
  { ext, mimeType },
  saveAs = false,
) {
  const filename = name + ext;
  const bytes = new TextEncoder().encode(text);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join(
    '',
  );
  const url = `data:${mimeType};base64,${btoa(binary)}`;
  await chrome.downloads.download({ url, filename, saveAs });
}
