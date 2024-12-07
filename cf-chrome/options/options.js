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
    // Nettoyer les entrées de caractères dangereux
    return input.trim().replace(/[<>'"]/g, '');
  }
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
      const zoneId = sanitizeInput(document.getElementById('zoneId').value);
      const apiToken = sanitizeInput(document.getElementById('apiToken').value);

      // Validation des entrées
      validateZoneId(zoneId);
      validateApiToken(apiToken);

      // Vérifier que les champs ne sont pas vides
      if (!zoneId || !apiToken) {
        throw new Error('All fields are required');
      }

      // Verify token validity with rate limiting
      const response = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`
        }
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.errors?.[0]?.message || 'Invalid API token');
      }

      // Vérifier la validité du Zone ID
      const zoneResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`
        }
      });

      const zoneResult = await zoneResponse.json();
      if (!zoneResult.success) {
        throw new Error('Invalid Zone ID or insufficient permissions');
      }
      
      await chrome.storage.local.set({ zoneId, apiToken });
      showMessage('Settings saved successfully!');
    } catch (error) {
      showMessage('Error saving settings: ' + error.message, true);
    }
  });
});
