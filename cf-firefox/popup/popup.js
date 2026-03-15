document.addEventListener('DOMContentLoaded', () => {
  const purgeCurrentPage = document.getElementById('purgeCurrentPage');
  const purgePageResources = document.getElementById('purgePageResources');
  const purgeAll = document.getElementById('purgeAll');
  const purgeByTag = document.getElementById('purgeByTag');
  const tagInput = document.getElementById('tagInput');
  const messageDiv = document.getElementById('message');
  const allButtons = [purgeCurrentPage, purgePageResources, purgeAll, purgeByTag];

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

  // Transforme les URLs Cloudflare Image Resizing en URL d'image originale
  // Ex: /cdn-cgi/image/width=1920,f=avif/path/img.png → /path/img.png
  // Les images resizées ne peuvent pas être purgées directement via l'API
  function normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      const cdnCgiMatch = urlObj.pathname.match(/^\/cdn-cgi\/image\/[^\/]+\/(.+)$/);
      if (cdnCgiMatch) {
        urlObj.pathname = '/' + cdnCgiMatch[1];
        return urlObj.toString();
      }
    } catch {
      // Si l'URL est invalide, on la retourne telle quelle
    }
    return url;
  }

  function setButtonsLoading(loading) {
    allButtons.forEach(btn => {
      btn.disabled = loading;
      if (loading) {
        btn.dataset.originalText = btn.textContent;
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

  // Purge par batch de 30 URLs max (limite API Cloudflare)
  async function purgeCacheBatch(urls) {
    const config = await getConfig();
    const BATCH_SIZE = 30;
    let purgedCount = 0;

    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      const batch = urls.slice(i, i + BATCH_SIZE);
      const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/purge_cache`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiToken}`
        },
        body: JSON.stringify({ files: batch })
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

      purgedCount += batch.length;
    }

    return purgedCount;
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
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) {
        throw new Error('No active tab found');
      }
      const currentUrl = normalizeUrl(tabs[0].url);
      await purgeCache([currentUrl]);
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
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) {
        throw new Error('No active tab found');
      }

      const resources = await getPageResources(tabs[0].id);
      // Normaliser les URLs (cdn-cgi/image → originale) et filtrer les HTTP(S) valides
      const validUrls = [...new Set(resources.map(normalizeUrl))].filter(url => {
        try {
          const u = new URL(url);
          return ['http:', 'https:'].includes(u.protocol);
        } catch { return false; }
      });

      if (validUrls.length === 0) {
        throw new Error('No resources found on this page');
      }

      const count = await purgeCacheBatch(validUrls);
      showMessage(`${count} resource(s) purged successfully!`);
    } catch (error) {
      showMessage(error.message, true);
      console.error('Purge page resources error:', error);
    } finally {
      setButtonsLoading(false);
    }
  });

  // Purge par Cache-Tags via l'API Cloudflare
  async function purgeCacheByTags(tags) {
    const config = await getConfig();

    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/purge_cache`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiToken}`
      },
      body: JSON.stringify({ tags })
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

    return tags.length;
  }

  purgeByTag.addEventListener('click', async () => {
    try {
      const rawInput = tagInput.value.trim();
      if (!rawInput) {
        throw new Error('Please enter at least one cache tag');
      }

      // Parser les tags séparés par des virgules, supprimer les vides et espaces
      const tags = rawInput.split(',').map(t => t.trim()).filter(t => t.length > 0);

      if (tags.length === 0) {
        throw new Error('Please enter at least one valid cache tag');
      }

      // Validation : max 30 tags par appel, max 1024 chars par tag
      if (tags.length > 30) {
        throw new Error('Maximum 30 tags per request');
      }

      const invalidTag = tags.find(t => t.length > 1024);
      if (invalidTag) {
        throw new Error(`Tag too long (max 1024 chars): "${invalidTag.substring(0, 50)}..."`);
      }

      setButtonsLoading(true);
      const count = await purgeCacheByTags(tags);
      showMessage(`Cache purged for ${count} tag(s): ${tags.join(', ')}`);
    } catch (error) {
      showMessage(error.message, true);
      console.error('Purge by tag error:', error);
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
