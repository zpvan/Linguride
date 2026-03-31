import * as vscode from 'vscode';
import { ILLMProvider, BaseProvider } from './ILLMProvider';
import { ProviderConfig } from '../types';
import { ConfigurationManager } from '../utils/configuration';

/**
 * 提供商工厂类
 * 负责创建和管理LLM提供商实例
 */
export class ProviderFactory {
	private static instances: Map<string, ILLMProvider> = new Map();
	private static configChangeDisposable: vscode.Disposable | undefined;

	/**
	 * 根据提供商ID创建或获取提供商实例
	 * @param providerId 提供商ID ('openai', 'claude', 'deepseek')
	 * @returns 提供商实例，如果配置无效则返回null
	 */
	static async createProvider(providerId?: string): Promise<ILLMProvider | null> {
		try {
			// 确保配置监听器已初始化
			this.initializeConfigListener();

			// 如果没有指定提供商，使用默认配置
			const config = ConfigurationManager.getConfig();
			const targetProviderId = providerId || config.defaultProvider;

			// 检查是否已有实例（使用安全获取避免竞态条件）
			const cachedInstance = this.instances.get(targetProviderId);
			if (cachedInstance) {
				return cachedInstance;
			}

			// 获取提供商配置
			const providerConfig = ConfigurationManager.getProviderConfig(targetProviderId);
			if (!providerConfig) {
				vscode.window.showWarningMessage(
					`未找到 ${targetProviderId} 的配置，请先配置API密钥`
				);
				return null;
			}

			// 验证配置
			if (!providerConfig.apiKey || providerConfig.apiKey.trim().length === 0) {
				vscode.window.showWarningMessage(
					`${targetProviderId} API密钥未配置，请先设置`
				);
				return null;
			}

			// 创建提供商实例
			let provider: ILLMProvider;
			switch (targetProviderId) {
				case 'openai':
					const { OpenAIProvider } = await import('./OpenAIProvider');
					provider = new OpenAIProvider(providerConfig);
					break;
				case 'claude':
					const { ClaudeProvider } = await import('./ClaudeProvider');
					provider = new ClaudeProvider(providerConfig);
					break;
				case 'deepseek':
					const { DeepSeekProvider } = await import('./DeepSeekProvider');
					provider = new DeepSeekProvider(providerConfig);
					break;
				default:
					throw new Error(`不支持的LLM提供商: ${targetProviderId}`);
			}

			// 验证提供商配置
			if (!provider.validateConfig(providerConfig)) {
				vscode.window.showErrorMessage(
					`${targetProviderId} 配置无效，请检查配置`
				);
				return null;
			}

			// 测试连接（可选，可以注释掉以加快启动速度）
			// const connected = await provider.testConnection();
			// if (!connected) {
			// 	vscode.window.showWarningMessage(
			// 		`无法连接到 ${targetProviderId} 服务，请检查网络和API密钥`
			// 	);
			// 	return null;
			// }

			// 缓存实例
			this.instances.set(targetProviderId, provider);
			return provider;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : '未知错误';
			vscode.window.showErrorMessage(`创建LLM提供商失败: ${errorMessage}`);
			console.error('提供商创建错误:', error);
			return null;
		}
	}

	/**
	 * 获取所有可用的提供商信息
	 * @returns 提供商信息列表
	 */
	static getAvailableProviders(): Array<{
		id: string;
		name: string;
		description: string;
		configured: boolean;
	}> {
		const config = ConfigurationManager.getConfig();
		const providers = [
			{
				id: 'openai',
				name: 'OpenAI',
				description: '使用GPT模型进行英文难度分析',
				configured: !!config.providers.openai?.apiKey
			},
			{
				id: 'claude',
				name: 'Claude',
				description: '使用Claude模型进行英文难度分析',
				configured: !!config.providers.claude?.apiKey
			},
			{
				id: 'deepseek',
				name: 'DeepSeek',
				description: '使用DeepSeek模型进行英文难度分析',
				configured: !!config.providers.deepseek?.apiKey
			}
		];

		return providers;
	}

	/**
	 * 清除缓存的提供商实例
	 * @param providerId 可选的提供商ID，如果未提供则清除所有
	 */
	static clearCache(providerId?: string): void {
		if (providerId) {
			const instance = this.instances.get(providerId);
			if (instance) {
				// 如果实例有dispose方法，调用它以清理资源
				if (typeof (instance as any).dispose === 'function') {
					try {
						(instance as any).dispose();
					} catch (error) {
						console.error(`清理提供商 ${providerId} 资源时出错:`, error);
					}
				}
				this.instances.delete(providerId);
			}
		} else {
			// 清理所有实例
			for (const [id, instance] of this.instances.entries()) {
				if (instance && typeof (instance as any).dispose === 'function') {
					try {
						(instance as any).dispose();
					} catch (error) {
						console.error(`清理提供商 ${id} 资源时出错:`, error);
					}
				}
			}
			this.instances.clear();
		}
	}

	/**
	 * 初始化配置变更监听器
	 * 当VS Code配置变更时自动清除缓存
	 */
	private static initializeConfigListener(): void {
		if (this.configChangeDisposable) {
			return;
		}

		this.configChangeDisposable = ConfigurationManager.onDidChangeConfiguration((event) => {
			try {
				if (event.affectsConfiguration('linguride')) {
					this.clearCache();
					console.log(`[Linguride] 配置已变更，清除${this.instances.size}个缓存实例`);
				}
			} catch (error) {
				console.error('[Linguride] 配置变更处理失败:', error);
			}
		});
	}

	/**
	 * 获取当前活跃的提供商ID
	 * @returns 当前活跃的提供商ID
	 */
	static getActiveProviderId(): string {
		const config = ConfigurationManager.getConfig();
		return config.defaultProvider;
	}

	/**
	 * 清理工厂资源
	 * 扩展停用时调用此方法释放所有资源
	 */
	static dispose(): void {
		if (this.configChangeDisposable) {
			this.configChangeDisposable.dispose();
			this.configChangeDisposable = undefined;
		}
		this.clearCache();
	}
}

/**
 * 便捷函数：创建默认提供商
 * @returns 默认提供商实例
 */
export async function createProvider(): Promise<ILLMProvider | null> {
	return ProviderFactory.createProvider();
}

/**
 * 便捷函数：创建指定提供商
 * @param providerId 提供商ID
 * @returns 指定提供商实例
 */
export async function createProviderById(providerId: string): Promise<ILLMProvider | null> {
	return ProviderFactory.createProvider(providerId);
}