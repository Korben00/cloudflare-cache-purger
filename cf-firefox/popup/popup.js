document.addEventListener('DOMContentLoaded', () => {
  const purgeCurrentPage = document.getElementById('purgeCurrentPage');
  const purgeAll = document.getElementById('purgeAll');
  const messageDiv = document.getElementById('message');

  function showMessage(text, isError = false) {
    messageDiv.textContent = text;
    messageDiv.className = 'message ' + (isError ? 'error' : 'success');
  }

  function validateUrl(url) {
    try {
      const urlObj = new URL(url);
      // Vérifier que c'est une URL HTTP(S)
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('Only HTTP and HTTPS URLs are supported');
      }
      // Vérifier la longueur maximale de l'URL
      if (url.length > 2048) {
        throw new Error('URL is too long');
      }
      return true;
    } catch (error) {
      throw new Error('Invalid URL format: ' + error.message);
    }
  }

  async function getConfig() {
    const config = await browser.storage.local.get(['zoneId', 'apiToken']);
    if (!config.zoneId || !config.apiToken) {
      throw new Error('Missing configuration. Please configure the extension in the options.');
    }
    // Vérifier le format des données de configuration
    if (!/^[a-f0-9]{32}$/i.test(config.zoneId)) {
      throw new Error('Invalid Zone ID format in configuration');
    }
    if (!config.apiToken.match(/^[A-Za-z0-9_-]{40,}$/)) {
      throw new Error('Invalid API token format in configuration');
    }
    return config;
  }

  async function purgeCache(urls = null) {
    try {
      const config = await getConfig();
      
      // Valider les URLs si fournies
      if (urls) {
        if (!Array.isArray(urls)) {
          throw new Error('URLs must be provided as an array');
        }
        urls.forEach(validateUrl);
      }

      const data = urls ? { files: urls } : { purge_everything: true };
      
      const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/purge_cache`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiToken}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        showMessage('Cache successfully purged!');
      } else {
        const errorMessage = result.errors?.[0]?.message || 'Unknown error occurred';
        throw new Error(errorMessage);
      }
    } catch (error) {
      showMessage(error.message, true);
      console.error('Purge cache error:', error);
    }
  }

  purgeCurrentPage.addEventListener('click', async () => {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) {
        throw new Error('No active tab found');
      }
      const currentUrl = tabs[0].url;
      await purgeCache([currentUrl]);
    } catch (error) {
      showMessage(error.message, true);
      console.error('Purge current page error:', error);
    }
  });

  purgeAll.addEventListener('click', async () => {
    try {
      await purgeCache();
    } catch (error) {
      showMessage(error.message, true);
      console.error('Purge all error:', error);
    }
  });
});
