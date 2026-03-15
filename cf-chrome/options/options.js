document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('options-form');
  const messageDiv = document.getElementById('message');
  
  // Load existing configuration
  const config = await chrome.storage.local.get(['zoneId', 'apiToken']);
  
  if (config.zoneId) document.getElementById('zoneId').value = config.zoneId;
  if (config.apiToken) document.getElementById('apiToken').value = config.apiToken;
  
  function showMessage(text, isError = false) {
    messageDiv.textContent = text;
    messageDiv.className = isError ? 'error' : 'success';
  }

  function validateZoneId(zoneId) {
    // Zone ID doit être une chaîne hexadécimale de 32 caractères
    const zoneIdRegex = /^[a-f0-9]{32}$/i;
    if (!zoneIdRegex.test(zoneId)) {
      throw new Error('Invalid Zone ID format. It should be a 32-character hexadecimal string.');
    }
  }

  function validateApiToken(apiToken) {
    // Token doit commencer par un préfixe valide et avoir une longueur minimale
    if (!apiToken.match(/^[A-Za-z0-9_-]{40,}$/)) {
      throw new Error('Invalid API token format.');
    }
  }

  function sanitizeInput(input) {
    // Nettoyer les entrées de caractères dangereux (pour Zone ID uniquement)
    return input.trim().replace(/[<>'"]/g, '');
  }

  function sanitizeToken(input) {
    // Le token API ne doit pas être altéré — on se contente de trim
    return input.trim();
  }
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
      const zoneId = sanitizeInput(document.getElementById('zoneId').value);
      const apiToken = sanitizeToken(document.getElementById('apiToken').value);

      // Validation des entrées
      validateZoneId(zoneId);
      validateApiToken(apiToken);

      // Verify token validity
      let response;
      try {
        response = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiToken}`
          }
        });
      } catch (e) {
        throw new Error('Network error: unable to reach Cloudflare API. Check your connection.');
      }
      
      const result = await response.json().catch(() => null);
      
      if (!result || !result.success) {
        throw new Error(result?.errors?.[0]?.message || 'Invalid API token');
      }

      // Vérifier la validité du Zone ID
      let zoneResponse;
      try {
        zoneResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiToken}`
          }
        });
      } catch (e) {
        throw new Error('Network error: unable to verify Zone ID. Check your connection.');
      }

      const zoneResult = await zoneResponse.json().catch(() => null);
      if (!zoneResult || !zoneResult.success) {
        throw new Error('Invalid Zone ID or insufficient permissions');
      }
      
      await chrome.storage.local.set({ zoneId, apiToken });
      showMessage('Settings saved successfully!');
    } catch (error) {
      showMessage('Error saving settings: ' + error.message, true);
    }
  });
});
