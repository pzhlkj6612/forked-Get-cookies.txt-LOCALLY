chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, target, data } = message || {};
  if (target !== 'offscreen') return;
  if (type === 'create-blob-url') {
    const blob = new Blob([data.text], { type: data.mimeType });
    const url = URL.createObjectURL(blob);
    sendResponse({ url });
    return true;
  }
  if (type === 'revoke-blob-url') {
    URL.revokeObjectURL(data.url);
  }
});
