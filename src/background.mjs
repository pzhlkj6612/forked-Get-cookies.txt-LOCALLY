import getAllCookies from './modules/get_all_cookies.mjs';

/**
 * Update icon badge counter on active page
 */
const updateBadgeCounter = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    return;
  }
  const { id: tabId, url: urlString } = tab;
  if (!urlString) {
    chrome.action.setBadgeText({ tabId, text: '' });
    return;
  }
  const url = new URL(urlString);
  const cookies = await getAllCookies({
    url: url.href,
    partitionKey: { topLevelSite: url.origin },
  });
  const text = cookies.length.toFixed();
  chrome.action.setBadgeText({ tabId, text });
};

chrome.cookies.onChanged.addListener(updateBadgeCounter);
chrome.tabs.onUpdated.addListener(updateBadgeCounter);
chrome.tabs.onActivated.addListener(updateBadgeCounter);
chrome.windows.onFocusChanged.addListener(updateBadgeCounter);

// Update notification
chrome.runtime.onInstalled.addListener(({ previousVersion, reason }) => {
  if (reason === 'update') {
    const currentVersion = chrome.runtime.getManifest().version;
    chrome.notifications.create('updated', {
      type: 'basic',
      title: 'Get cookies.txt LOCALLY',
      message: `Updated from ${previousVersion} to ${currentVersion}`,
      iconUrl: '/images/icon128.png',
      buttons: [{ title: 'Github Releases' }, { title: 'Uninstall' }],
    });
  }
});

// Update notification's button handler
chrome.notifications.onButtonClicked.addListener(
  (notificationId, buttonIndex) => {
    console.log(notificationId, buttonIndex);
    if (notificationId === 'updated') {
      switch (buttonIndex) {
        case 0:
          chrome.tabs.create({
            url: 'https://github.com/kairi003/Get-cookies.txt-LOCALLY/releases',
          });
          break;
        case 1:
          chrome.management.uninstallSelf({ showConfirmDialog: true });
          break;
      }
    }
  },
);

const isFirefox =
  chrome.runtime.getManifest().browser_specific_settings !== undefined;

/**
 * Set up the offscreen document for creating Blob URLs (Chrome only)
 */
const setupOffscreenDocument = async () => {
  const offscreenUrl = chrome.runtime.getURL('offscreen/offscreen.html');
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl],
  });
  if (contexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: offscreenUrl,
    reasons: ['BLOBS'],
    justification: 'Create Blob URL for file download',
  });
};

/**
 * Save text content to a file
 */
const saveToFile = async (text, name, { ext, mimeType }, saveAs = false) => {
  const filename = name + ext;
  if (isFirefox) {
    // Firefox background page has DOM access
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const id = await chrome.downloads.download({ url, filename, saveAs });
    /** @param {chrome.downloads.DownloadDelta} delta */
    const onChange = (delta) => {
      if (delta.id === id && delta.state?.current !== 'in_progress') {
        chrome.downloads.onChanged.removeListener(onChange);
        URL.revokeObjectURL(url);
      }
    };
    chrome.downloads.onChanged.addListener(onChange);
  } else {
    // Chrome service worker: use offscreen document for Blob URL
    await setupOffscreenDocument();
    const { url } = await chrome.runtime.sendMessage({
      type: 'create-blob-url',
      target: 'offscreen',
      data: { text, mimeType },
    });
    const id = await chrome.downloads.download({ url, filename, saveAs });
    /** @param {chrome.downloads.DownloadDelta} delta */
    const onChange = (delta) => {
      if (delta.id === id && delta.state?.current !== 'in_progress') {
        chrome.downloads.onChanged.removeListener(onChange);
        chrome.runtime.sendMessage({
          type: 'revoke-blob-url',
          target: 'offscreen',
          data: { url },
        });
      }
    };
    chrome.downloads.onChanged.addListener(onChange);
  }
};

// Handle save file messages from the popup
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  const { type, target, data } = message || {};
  if (target !== 'background') return;
  if (type === 'save') {
    const { text, name, format, saveAs } = data || {};
    await saveToFile(text, name, format, saveAs);
    sendResponse('done');
    return true;
  }
  return true;
});
