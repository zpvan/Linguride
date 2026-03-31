# Linguride English Difficulty Analyzer

A VS Code extension that analyzes the difficulty of English articles using AI. The extension combines prompt text with portions of the article and sends them to LLM APIs (OpenAI, Claude, or DeepSeek) to assess the article's difficulty.

## Features

- **AI-Powered Analysis**: Uses advanced LLM models to analyze English text difficulty
- **Multi-LLM Support**: Works with OpenAI GPT, Anthropic Claude, and DeepSeek models
- **Multiple Interaction Methods**:
  - Right-click context menu on selected text
  - Command palette (`Ctrl+Shift+P`)
  - Sidebar panel for history and detailed results
- **Detailed Analysis Results**:
  - Difficulty level (Beginner, Intermediate, Advanced, Expert)
  - CEFR level (A1, A2, B1, B2, C1, C2)
  - Comprehensive score (0-100)
  - Vocabulary complexity analysis
  - Sentence structure analysis
  - Reading time estimation
  - Improvement suggestions
- **History Tracking**: Keeps track of previous analyses
- **Export Results**: Export analysis to JSON or CSV format
- **Configurable**: Easy configuration of API keys and preferences

## Installation

### From VSIX (Local Installation)

1. Package the extension:
   ```bash
   npm run package
   ```

2. Install the VSIX file:
   ```bash
   code --install-extension linguride-english-difficulty-analyzer-0.1.0.vsix
   ```

### Development Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd <repository-root>
   ```

2. Install workspace dependencies from the repository root:
   ```bash
   npm install
   ```

3. Compile the extension:
   ```bash
   npm run compile:vscode
   ```

4. Press F5 to launch the extension in a new VS Code window.

You can also work inside the extension directory after the root install:

```bash
cd apps/vscode-extension
npm run compile
```

## Configuration

### API Keys Setup

1. Open VS Code Settings (`Ctrl+,` on Windows/Linux, `Cmd+,` on macOS)
2. Search for "Linguride"
3. Configure at least one LLM provider:

#### OpenAI Configuration
```json
"linguride.providers.openai": {
  "apiKey": "your-openai-api-key-here",
  "model": "gpt-4-turbo-preview"
}
```

#### Claude Configuration
```json
"linguride.providers.claude": {
  "apiKey": "your-claude-api-key-here",
  "model": "claude-3-sonnet-20240229"
}
```

#### DeepSeek Configuration
```json
"linguride.providers.deepseek": {
  "apiKey": "your-deepseek-api-key-here",
  "model": "deepseek-chat"
}
```

### Default Provider

Set your preferred default provider:
```json
"linguride.defaultProvider": "deepseek"
```

## Usage

### Basic Usage

1. **Select English text** in any editor (Markdown, plain text, etc.)
2. **Right-click** and select "Analyze English Difficulty"
3. **View results** in the sidebar panel

### Alternative Methods

- **Command Palette**: Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS) and type "Analyze English Difficulty"
- **Sidebar**: Click the "English Analysis" icon in the activity bar to open the sidebar panel

### Analysis Results

The analysis panel shows:

1. **Difficulty Summary**: Visual badge showing the overall difficulty level
2. **Score**: Numerical score (0-100) with progress bar visualization
3. **Text Statistics**: Character count, word count, estimated reading time
4. **Vocabulary Analysis**: Rare words, academic vocabulary, word length, readability
5. **Sentence Analysis**: Average sentence length, complex sentence ratio, passive voice usage
6. **Improvement Suggestions**: Actionable tips to simplify or improve the text

### Exporting Results

1. Click the "Export Result" button in the analysis panel
2. Choose format (JSON or CSV)
3. Select save location

## Development

### Project Structure

``` 
apps/vscode-extension/
├── src/                          # TypeScript source code
│   ├── extension.ts             # Extension entry point
│   ├── providers/               # LLM provider implementations
│   │   ├── ILLMProvider.ts      # Provider interface
│   │   ├── OpenAIProvider.ts    # OpenAI implementation
│   │   ├── ClaudeProvider.ts    # Claude implementation
│   │   └── DeepSeekProvider.ts  # DeepSeek implementation
│   ├── analysis/                # Analysis engine
│   │   └── DifficultyAnalyzer.ts
│   ├── ui/                      # UI components
│   │   └── AnalysisPanel.ts     # Sidebar panel
│   ├── utils/                   # Utility functions
│   │   ├── configuration.ts     # Configuration management
│   │   ├── textUtils.ts         # Text processing utilities
│   │   └── logger.ts            # Logging utilities
│   └── types/                   # TypeScript type definitions
│       └── index.ts
├── media/                       # Static resources
│   ├── icon.png                 # Extension icon
│   ├── style.css                # Webview styles
│   └── main.js                  # Webview JavaScript
├── .vscode/                     # VS Code configuration
├── package.json                 # Extension manifest
└── tsconfig.json                # TypeScript configuration
```

### Building and Testing

```bash
# Install dependencies once from the repository root
npm install

# Compile TypeScript for the VS Code extension
npm run compile:vscode

# Watch mode (auto-compile on changes)
npm run watch:vscode

# Run linter
npm run lint:vscode

# Package extension for distribution
npm run package:vscode

# Run extension in development mode
# Press F5 in VS Code
```

### Debugging

1. Open the project in VS Code
2. Set breakpoints in TypeScript files
3. Press F5 to launch the extension in debug mode
4. Use VS Code's debug tools to inspect variables and step through code

## Architecture

### LLM Provider System

The extension uses a plugin architecture for LLM providers:

- **Base Interface**: All providers implement `ILLMProvider`
- **Strategy Pattern**: Providers can be swapped at runtime
- **Factory Pattern**: Provider instances created based on configuration
- **Error Handling**: Consistent error handling across all providers

### Data Flow

```
User selects text → Extension captures text → Configuration check →
Select LLM provider → Construct prompt → Call API → Parse response →
Display results → Store in history
```

### Configuration Management

- Uses VS Code's built-in settings API
- Supports workspace and user-level configuration
- Validates API keys and configuration before use
- Provides sensible defaults

## Requirements

- VS Code 1.85.0 or higher
- Node.js 20.0.0 or higher
- API keys for at least one LLM provider (OpenAI, Claude, or DeepSeek)

## API Integration

### Supported LLM Providers

1. **OpenAI**: GPT-4 Turbo, GPT-3.5 Turbo
2. **Claude**: Claude 3 Sonnet, Claude 3 Haiku
3. **DeepSeek**: DeepSeek Chat

### API Rate Limits and Costs

Each provider has different rate limits and pricing:

- **OpenAI**: ~$0.01 per analysis (varies by model)
- **Claude**: ~$0.005 per analysis (varies by model)
- **DeepSeek**: ~$0.001 per analysis (most cost-effective)

The extension includes cost estimation before sending requests.

## Troubleshooting

### Common Issues

1. **"No API key configured"**
   - Solution: Configure at least one LLM provider in settings

2. **"Analysis failed: API error"**
   - Solution: Check your API key validity and network connection
   - Check the extension logs for detailed error messages

3. **"Text too long"**
   - Solution: The extension automatically splits long texts
   - For very long texts, consider analyzing sections separately

4. **"Sidebar panel not showing"**
   - Solution: Click the "English Analysis" icon in the activity bar
   - Ensure the extension is properly activated

### Viewing Logs

1. Open the Output panel (`Ctrl+Shift+U` or `Cmd+Shift+U`)
2. Select "Linguride English Analyzer" from the dropdown
3. Check for error messages and debugging information

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linter
5. Submit a pull request

### Code Style

- TypeScript with strict type checking
- ESLint for code quality
- Prettier for code formatting
- Follow VS Code extension best practices

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Built with the VS Code Extension API
- Uses Axios for HTTP requests
- Inspired by language learning and readability analysis tools

## Support

For issues, feature requests, or questions:

1. Check the [GitHub Issues](https://github.com/linguride/linguride-english-difficulty-analyzer/issues)
2. Review the documentation
3. Contact the maintainers

---

*Made with ❤️ by the Linguride team*
