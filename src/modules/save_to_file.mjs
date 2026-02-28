/**
 * Save text data as a file
 * Firefox fails if revoked during download.
 * Firefox cannot use saveAs in a popup, so the background script handles it.
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
  let url;
  let needsRevoke = false;

  if (typeof URL.createObjectURL === 'function') {
    const blob = new Blob([text], { type: mimeType });
    url = URL.createObjectURL(blob);
    needsRevoke = true;
  } else {
    // Service worker context - use data URL
    const bytes = new TextEncoder().encode(text);
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join(
      '',
    );
    url = `data:${mimeType};base64,${btoa(binary)}`;
  }

  const id = await chrome.downloads.download({ url, filename, saveAs });

  if (needsRevoke) {
    /** @param {chrome.downloads.DownloadDelta} delta  */
    const onChange = (delta) => {
      if (delta.id === id && delta.state?.current !== 'in_progress') {
        chrome.downloads.onChanged.removeListener(onChange);
        URL.revokeObjectURL(url);
      }
    };

    chrome.downloads.onChanged.addListener(onChange);
  }
}
