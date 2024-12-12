# Cloudflare Cache Purger for Firefox

A Firefox extension that allows you to easily purge Cloudflare cache for the current page or your entire zone.

📥 Download the extension:
- [Firefox Add-on](https://addons.mozilla.org/en-US/firefox/addon/cloudflare-cache-purger/)
- [Chrome Extension](https://chromewebstore.google.com/detail/cloudflare-cache-purger/cbjaocichnocnadbjcpfajjnnnijmloe)

<img src="screenshots/main-interface.png" width="50%" alt="Main Interface">

## Features

- Purge cache for the currently viewed page
- Purge entire Cloudflare cache
- Simple and intuitive interface
- Easy Cloudflare credentials configuration
- Confirmation messages for each action

## Installation

1. Install the extension from your browser's store (links above)
2. Click on the extension icon in the toolbar
3. Go to the extension settings

<img src="screenshots/plugin-settings-access.png" width="50%" alt="Access Settings">

4. Configure your Cloudflare credentials:
   - Cloudflare Zone ID
   - API Token (Bearer token)

<img src="screenshots/plugin-settings.png" width="50%" alt="Settings Interface">

## How to get your credentials

1. Cloudflare Zone ID:
   - Log in to your Cloudflare dashboard
   - Select your domain
   - The Zone ID can be found in the right sidebar

2. API Token:
   - Go to "My Profile > API Tokens" on Cloudflare
   <img src="screenshots/create-token-step1.png" width="50%" alt="Create Token Step 1">
   
   - Create a new token with "Zone.Cache Purge" permissions
   <img src="screenshots/create-token-step2.png" width="50%" alt="Create Token Step 2">
   <img src="screenshots/create-token-step3.png" width="50%" alt="Create Token Step 3">
   
   - Copy the generated token
   <img src="screenshots/create-token-step4.png" width="50%" alt="Create Token Step 4">

## Usage

1. To purge the current page cache:
   - Navigate to the desired page
   - Click the extension icon
   - Click "Purge current page"

2. To purge the entire cache:
   - Click the extension icon
   - Click "Purge entire cache"

## Support

For any questions or issues:
- Open an issue on GitHub
- Contact the author at korben.info

## Privacy

This extension:
- Does not collect any personal data
- Stores your Cloudflare credentials locally in your browser
- Only communicates with the Cloudflare API

## License

MIT License

## Credits

- Extension author: Korben
- Visit [Korben.info](https://korben.info)
- Extension icon: [Fire icons created by Freepik - Flaticon](https://www.flaticon.com/free-icons/fire)
