# Contributing to Cloudflare Cache Purger

First off, thank you for considering contributing to Cloudflare Cache Purger! It's people like you that make it such a great tool.

## Development Process

1. Fork the repository
2. Create a new branch for your feature or bugfix (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run the linter to ensure code quality (`npm run lint`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Building the Extensions

1. Install dependencies:
```bash
npm install
```

2. Build the extensions:
```bash
npm run build
```

This will create the extension packages in the `web-ext-artifacts` directory of each browser's folder.

## Code Style

- Follow the existing code style
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused
- Use ES6+ features when appropriate

## Testing

Before submitting your changes:

1. Test the extension in both Firefox and Chrome
2. Verify all features work as expected
3. Check for any console errors
4. Run the linter (`npm run lint`)

## Questions?

Feel free to open an issue for any questions or concerns.
