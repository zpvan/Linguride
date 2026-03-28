# Changelog

All notable changes to the "Linguride English Difficulty Analyzer" extension will be documented in this file.

## [0.1.0] - 2026-01-17

### Added
- Initial release of Linguride English Difficulty Analyzer
- Support for three LLM providers: OpenAI, Claude, and DeepSeek
- Right-click context menu for text analysis
- Command palette integration
- Sidebar panel for results and history
- Detailed analysis including:
  - Difficulty level (Beginner, Intermediate, Advanced, Expert)
  - CEFR level assessment (A1-C2)
  - Vocabulary complexity analysis
  - Sentence structure analysis
  - Reading time estimation
  - Improvement suggestions
- Configuration management via VS Code settings
- Export functionality (JSON and CSV formats)
- History tracking of previous analyses
- Cost estimation for API usage
- Comprehensive error handling and logging
- Development environment setup with debugging support

### Technical Features
- TypeScript implementation with strict type checking
- Plugin architecture for LLM providers
- Strategy pattern for provider selection
- Factory pattern for provider instantiation
- VS Code Webview API for UI components
- Axios for HTTP requests
- ESLint and Prettier for code quality
- Complete development and build tooling

## [0.0.1] - Development Phase

### Development Milestones
- Project structure and architecture design
- Core provider interface and base classes
- DeepSeek provider implementation (priority provider)
- OpenAI and Claude provider implementations
- Analysis engine and text processing utilities
- Configuration management system
- User interface components (sidebar, webview)
- Static resources (CSS, JavaScript, icons)
- Documentation and developer tools
- Testing and debugging setup

---

## Planned Features

### Short-term (Next Release)
- Batch analysis of multiple files
- Custom prompt templates
- Advanced visualization (charts, graphs)
- Integration with Linguride main application
- Performance optimization and caching
- Unit and integration tests

### Medium-term
- Additional LLM provider support
- Offline analysis mode
- Collaborative features
- Plugin system for custom analyzers
- Advanced text segmentation and processing
- Multi-language support (beyond English)

### Long-term
- Machine learning model integration
- Real-time analysis as you type
- Educational content recommendations
- Gamification and progress tracking
- Classroom and team collaboration features
- Advanced analytics and reporting

---

## Notes

- This extension is part of the larger Linguride ecosystem
- Prioritizes user privacy - API keys and text content are not stored
- Designed with extensibility in mind for future features
- Follows VS Code extension best practices and guidelines

For detailed technical documentation, see the README.md file.