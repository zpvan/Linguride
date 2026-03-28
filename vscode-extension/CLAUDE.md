# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Linguride English Difficulty Analyzer** is a VS Code extension that analyzes English text difficulty using AI. The extension supports multiple LLM providers (OpenAI, Claude, DeepSeek) and provides detailed analysis including difficulty level, CEFR rating, vocabulary complexity, and improvement suggestions.

## Common Development Commands

### Building and Compilation
```bash
# Install dependencies
npm install

# Compile TypeScript to JavaScript (outputs to ./out/)
npm run compile

# Watch mode - automatically recompile on changes
npm run watch

# Package extension into VSIX file for distribution
npm run package

# Run ESLint for code quality checks
npm run lint

# Run tests (requires compiled code)
npm run test
```

### Development and Debugging
- **F5**: Launch extension in debug mode (uses "Run Extension" configuration)
- **Debug Configurations**:
  - "Run Extension": Standard debug with extension development host
  - "Run Extension (no debug)": Launch without debugger, disables other extensions
  - "Run Tests": Execute test suite
- **Pre-launch Task**: All debug configurations run `npm: compile` task before launching

### Extension Testing
```bash
# Run the test suite (compiles first, then runs tests)
npm test
```

## Architecture Overview

### Core Components

1. **Extension Entry Point** (`src/extension.ts`)
   - Registers commands and providers
   - Manages extension lifecycle
   - Initializes analysis view

2. **LLM Provider System** (`src/providers/`)
   - **Base Interface**: `ILLMProvider.ts` defines provider contract
   - **Implementations**:
     - `OpenAIProvider.ts`: OpenAI GPT API integration
     - `ClaudeProvider.ts`: Anthropic Claude API integration
     - `DeepSeekProvider.ts`: DeepSeek API integration
   - **Factory Pattern**: `providerFactory.ts` creates provider instances based on configuration
   - **Strategy Pattern**: Providers can be swapped at runtime

3. **Analysis Engine** (`src/analysis/DifficultyAnalyzer.ts`)
   - Orchestrates the analysis workflow
   - Handles text preprocessing and post-processing
   - Manages provider selection and API calls

4. **UI Components** (`src/ui/AnalysisPanel.ts`)
   - Sidebar panel for displaying analysis results
   - Webview-based interface with React/Vue-like components
   - History tracking and export functionality

5. **Utilities** (`src/utils/`)
   - `configuration.ts`: Manages VS Code settings and API configuration
   - `textUtils.ts`: Text processing and analysis utilities
   - `logger.ts`: Consistent logging across the extension
   - `promptBuilder.ts`: Constructs LLM prompts for difficulty analysis

6. **Type Definitions** (`src/types/index.ts`)
   - Centralized TypeScript interfaces and types
   - Analysis result types, provider configurations, etc.

7. **Constants** (`src/constants/defaults.ts`)
   - Default configuration values
   - Prompt templates and API endpoints

### Data Flow

1. **User Interaction** → Text selection + command activation
2. **Extension Activation** → `extension.ts` receives command
3. **Configuration Check** → `configuration.ts` validates API settings
4. **Provider Selection** → `providerFactory.ts` creates appropriate provider
5. **Analysis Execution** → `DifficultyAnalyzer.ts` orchestrates:
   - Text preprocessing via `textUtils.ts`
   - Prompt construction via `promptBuilder.ts`
   - API call via selected provider
   - Response parsing and validation
6. **Result Presentation** → `AnalysisPanel.ts` displays structured results
7. **History Management** → Results stored for later reference

### Configuration Management

- **VS Code Settings API**: Uses `workspace.getConfiguration()` for settings
- **Hierarchical Configuration**: Supports user, workspace, and folder-level settings
- **Provider-Specific Configs**: Each LLM provider has its own configuration schema
- **Validation**: Configuration is validated before API calls

### Key Design Patterns

1. **Plugin Architecture**: LLM providers are pluggable components
2. **Dependency Injection**: Providers are instantiated via factory
3. **Separation of Concerns**: Clear boundaries between UI, business logic, and API integration
4. **Error Resilience**: Graceful handling of API failures and network issues

## Build System

### TypeScript Configuration (`tsconfig.json`)
- **Target**: ES2020
- **Module**: CommonJS (VS Code extension requirement)
- **Output**: `./out/` directory
- **Strict Mode**: Enabled with full type checking
- **Source Maps**: Enabled for debugging TypeScript source

### VS Code Integration
- **`.vscode/launch.json`**: Debug configurations for extension development
- **`.vscode/tasks.json`**: Build tasks integrated with VS Code
- **`.vscode/settings.json`**: Workspace-specific VS Code settings

### Linting and Code Quality
- **ESLint**: TypeScript-specific rules with `@typescript-eslint` plugin
- **Prettier**: Code formatting configuration in `.prettierrc`
- **VS Code Integration**: Linting runs as build task and on save

## Development Workflow

### Typical Development Session
1. **Start Watch Mode**: `npm run watch` (auto-compiles on changes)
2. **Launch Debug Session**: Press F5 to open extension development host
3. **Make Changes**: Edit TypeScript files in `src/`
4. **Test Changes**: Use the extension in the development host
5. **Run Tests**: `npm test` to ensure no regressions
6. **Package for Distribution**: `npm run package` when ready to release

### Testing Strategy
- Tests are compiled to `./out/test/` directory
- Test execution via `node ./out/test/runTest.js`
- Integration with VS Code extension test runner

### Configuration for Development
- Set up at least one LLM provider API key in VS Code settings
- Use test/development API keys to avoid production costs
- Configure `linguride.defaultProvider` to preferred provider

## Key Files and Their Roles

### Essential Files for Understanding the Codebase
1. `package.json:33-233` - Scripts and VS Code extension configuration
2. `src/extension.ts` - Entry point and command registration
3. `src/providers/ILLMProvider.ts` - Provider interface definition
4. `src/analysis/DifficultyAnalyzer.ts` - Core analysis logic
5. `src/ui/AnalysisPanel.ts` - User interface implementation
6. `src/utils/configuration.ts` - Settings management

### Configuration Files
1. `.vscode/launch.json:4-42` - Debug configurations
2. `.vscode/tasks.json:3-45` - Build task definitions
3. `tsconfig.json` - TypeScript compiler settings
4. `.eslintrc.json` - ESLint configuration
5. `.prettierrc` - Code formatting rules

## Extension-Specific Considerations

### VS Code API Usage
- Uses `vscode` namespace API (`^1.85.0`)
- Webview API for sidebar panel
- Workspace and configuration APIs for settings
- Status bar and command palette integration

### Activation Events
- `onStartupFinished`: Extension activates after VS Code starts
- `onCommand:linguride.analyzeDifficulty`: Command activation
- `onView:lingurideAnalysisView`: Sidebar view activation

### Provider Configuration Schema
Defined in `package.json:74-223` with:
- Provider-specific API keys and endpoints
- Model selection for each provider
- Custom prompt template support
- Default provider selection

## Troubleshooting Development Issues

### Common Development Problems
1. **Extension not loading**: Check `npm run compile` output for TypeScript errors
2. **API calls failing**: Verify provider configuration in VS Code settings
3. **UI not updating**: Ensure webview resources are properly referenced
4. **Debugger not connecting**: Check launch.json configuration

### Logging and Diagnostics
- Use `src/utils/logger.ts` for consistent logging
- Check "Linguride English Analyzer" output channel in VS Code
- Enable verbose logging for debugging API interactions

## Integration with Linguride Ecosystem

This VS Code extension is part of the larger Linguride language learning platform. While it operates independently, it shares:
- **Branding and UI patterns** with other Linguride products
- **Analysis methodology** based on the "Bicycle Method" pedagogy
- **Multi-LLM provider support** consistent with platform architecture