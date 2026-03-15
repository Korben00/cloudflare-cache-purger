document.addEventListener('DOMContentLoaded', () => {
  const purgeCurrentPage = document.getElementById('purgeCurrentPage');
  const purgePageResources = document.getElementById('purgePageResources');
  const purgeAll = document.getElementById('purgeAll');
  const purgeByTag = document.getElementById('purgeByTag');
  const tagInput = document.getElementById('tagInput');
  const messageDiv = document.getElementById('message');
  const allButtons = [purgeCurrentPage, purgePageResources, purgeAll, purgeByTag];

  function showMessage(text, isError = false, details = null) {
    messageDiv.innerHTML = '';
    messageDiv.className = 'message ' + (isError ? 'error' : 'success');

    const textNode = document.createElement('span');
    textNode.textContent = text;
    messageDiv.appendChild(textNode);

    if (details && details.length > 0) {
      const list = document.createElement('ul');
      list.className = 'purge-details';
      details.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        li.title = item;
        list.appendChild(li);
      });
      messageDiv.appendChild(list);
    }
  }

  function validateUrl(url) {
    if (url.length > 2048) {
      throw new Error('URL is too long');
    }
    let urlObj;
    try {
      urlObj = new URL(url);
    } catch (error) {
      throw new Error('Invalid URL format: ' + error.message);
    }
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('Only HTTP and HTTPS URLs are supported');
    }
    return true;
  }

  // Normalise les URLs avant purge :
  // - /cdn-cgi/image/<params>/path → /path (Image Resizing : purger l'originale)
  // - /cdn-cgi/* (RUM, challenges...) → null (endpoints internes non purgeables)
  function normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      if (urlObj.pathname.startsWith('/cdn-cgi/')) {
        const imageMatch = urlObj.pathname.match(/^\/cdn-cgi\/image\/[^\/]+\/(.+)$/);
        if (imageMatch) {
          urlObj.pathname = '/' + imageMatch[1];
          return urlObj.toString();
        }
        return null;
      }
    } catch {
      // URL invalide → retournée telle quelle
    }
    return url;
  }

  function setButtonsLoading(loading) {
    allButtons.forEach(btn => {
      btn.disabled = loading;
      if (loading) {
        if (!btn.dataset.originalText) {
          btn.dataset.originalText = btn.textContent;
        }
        btn.textContent = 'Purging...';
      } else {
        btn.textContent = btn.dataset.originalText || btn.textContent;
      }
    });
  }

  async function getConfig() {
    const config = await browser.storage.local.get(['zoneId', 'apiToken']);
    if (!config.zoneId || !config.apiToken) {
      throw new Error('Missing configuration. Please configure the extension in the options.');
    }
    if (!/^[a-f0-9]{32}$/i.test(config.zoneId)) {
      throw new Error('Invalid Zone ID format in configuration');
    }
    if (!config.apiToken.match(/^[A-Za-z0-9_-]{40,}$/)) {
      throw new Error('Invalid API token format in configuration');
    }
    return config;
  }

  async function getActiveTab() {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      throw new Error('No active tab found');
    }
    return tabs[0];
  }

  // Appel centralisé à l'API Cloudflare purge_cache
  async function callPurgeApi(config, body) {
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/purge_cache`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiToken}`
      },
      body: JSON.stringify(body)
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      const errorDetail = result?.errors?.[0]?.message || `HTTP error! status: ${response.status}`;
      throw new Error(errorDetail);
    }

    if (!result || !result.success) {
      const errorMessage = result?.errors?.[0]?.message || 'Unknown error occurred';
      throw new Error(errorMessage);
    }

    return result;
  }

  async function purgeUrls(urls) {
    const config = await getConfig();
    urls.forEach(validateUrl);
    await callPurgeApi(config, { files: urls });
  }

  // Purge par batch de 30 URLs max (limite API Cloudflare)
  const BATCH_SIZE = 30;

  async function purgeBatch(urls) {
    const config = await getConfig();
    urls.forEach(validateUrl);

    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      const batch = urls.slice(i, i + BATCH_SIZE);
      await callPurgeApi(config, { files: batch });
    }

    return urls.length;
  }

  async function purgeByTags(tags) {
    const config = await getConfig();
    await callPurgeApi(config, { tags });
    return tags.length;
  }

  async function purgeEverything() {
    const config = await getConfig();
    await callPurgeApi(config, { purge_everything: true });
  }

  // Injecte un content script pour collecter toutes les ressources de la page
  async function getPageResources(tabId) {
    const results = await browser.tabs.executeScript(tabId, {
      code: `
        (function() {
          const urls = new Set();
          urls.add(window.location.href);
          performance.getEntriesByType('resource').forEach(entry => {
            if (entry.name && entry.name.startsWith('http')) {
              urls.add(entry.name);
            }
          });
          return Array.from(urls);
        })();
      `
    });

    if (!results || !results[0]) {
      throw new Error('Failed to collect page resources');
    }

    return results[0];
  }

  purgeCurrentPage.addEventListener('click', async () => {
    try {
      setButtonsLoading(true);
      const tab = await getActiveTab();
      const currentUrl = normalizeUrl(tab.url);
      if (!currentUrl) {
        throw new Error('This URL is a Cloudflare internal endpoint and cannot be purged');
      }
      await purgeUrls([currentUrl]);
      showMessage('Cache successfully purged!');
    } catch (error) {
      showMessage(error.message, true);
      console.error('Purge current page error:', error);
    } finally {
      setButtonsLoading(false);
    }
  });

  purgePageResources.addEventListener('click', async () => {
    try {
      setButtonsLoading(true);
      const tab = await getActiveTab();
      const resources = await getPageResources(tab.id);
      // Normaliser les URLs (cdn-cgi/image → originale), exclure les cdn-cgi non purgeables
      const validUrls = [...new Set(resources.map(normalizeUrl).filter(Boolean))].filter(url => {
        try {
          const u = new URL(url);
          return ['http:', 'https:'].includes(u.protocol);
        } catch { return false; }
      });

      if (validUrls.length === 0) {
        throw new Error('No resources found on this page');
      }

      const count = await purgeBatch(validUrls);
      showMessage(`${count} resource(s) purged successfully!`, false, validUrls);
    } catch (error) {
      showMessage(error.message, true);
      console.error('Purge page resources error:', error);
    } finally {
      setButtonsLoading(false);
    }
  });

  purgeByTag.addEventListener('click', async () => {
    try {
      const rawInput = tagInput.value.trim();
      if (!rawInput) {
        throw new Error('Please enter at least one cache tag');
      }

      const tags = rawInput.split(',').map(t => t.trim()).filter(t => t.length > 0);

      if (tags.length === 0) {
        throw new Error('Please enter at least one valid cache tag');
      }

      if (tags.length > BATCH_SIZE) {
        throw new Error(`Maximum ${BATCH_SIZE} tags per request`);
      }

      const invalidTag = tags.find(t => t.length > 1024);
      if (invalidTag) {
        throw new Error(`Tag too long (max 1024 chars): "${invalidTag.substring(0, 50)}..."`);
      }

      setButtonsLoading(true);
      const count = await purgeByTags(tags);
      showMessage(`Cache purged for ${count} tag(s): ${tags.join(', ')}`);
    } catch (error) {
      showMessage(error.message, true);
      console.error('Purge by tag error:', error);
    } finally {
      setButtonsLoading(false);
    }
  });

  purgeAll.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to purge the entire cache? This will affect all cached resources.')) {
      return;
    }
    setButtonsLoading(true);
    try {
      await purgeEverything();
      showMessage('Cache successfully purged!');
    } catch (error) {
      showMessage(error.message, true);
      console.error('Purge all error:', error);
    } finally {
      setButtonsLoading(false);
    }
  });
});
