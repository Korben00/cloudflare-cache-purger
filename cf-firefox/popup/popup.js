document.addEventListener('DOMContentLoaded', () => {
  const purgeCurrentPage = document.getElementById('purgeCurrentPage');
  const purgeAll = document.getElementById('purgeAll');
  const messageDiv = document.getElementById('message');

  function showMessage(text, isError = false) {
    messageDiv.textContent = text;
    messageDiv.className = 'message ' + (isError ? 'error' : 'success');
  }

  function validateUrl(url) {
    // Vérifier la longueur maximale de l'URL avant le parsing
    if (url.length > 2048) {
      throw new Error('URL is too long');
    }
    let urlObj;
    try {
      urlObj = new URL(url);
    } catch (error) {
      throw new Error('Invalid URL format: ' + error.message);
    }
    // Vérifier que c'est une URL HTTP(S) — en dehors du try/catch
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('Only HTTP and HTTPS URLs are supported');
    }
    return true;
  }

  function setButtonsLoading(loading) {
    purgeCurrentPage.disabled = loading;
    purgeAll.disabled = loading;
    if (loading) {
      purgeCurrentPage.dataset.originalText = purgeCurrentPage.textContent;
      purgeAll.dataset.originalText = purgeAll.textContent;
      purgeCurrentPage.textContent = 'Purging...';
      purgeAll.textContent = 'Purging...';
    } else {
      purgeCurrentPage.textContent = purgeCurrentPage.dataset.originalText || 'Purge Current Page';
      purgeAll.textContent = purgeAll.dataset.originalText || 'Purge Entire Cache';
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

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        const errorDetail = result?.errors?.[0]?.message || `HTTP error! status: ${response.status}`;
        throw new Error(errorDetail);
      }

      if (!result) {
        throw new Error('Invalid response from Cloudflare API');
      }
      
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
      setButtonsLoading(true);
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) {
        throw new Error('No active tab found');
      }
      const currentUrl = tabs[0].url;
      await purgeCache([currentUrl]);
    } catch (error) {
      showMessage(error.message, true);
      console.error('Purge current page error:', error);
    } finally {
      setButtonsLoading(false);
    }
  });

  purgeAll.addEventListener('click', async () => {
    // Confirmation avant purge total — action destructrice
    if (!confirm('Are you sure you want to purge the entire cache? This will affect all cached resources.')) {
      return;
    }
    try {
      setButtonsLoading(true);
      await purgeCache();
    } catch (error) {
      showMessage(error.message, true);
      console.error('Purge all error:', error);
    } finally {
      setButtonsLoading(false);
    }
  });
});
