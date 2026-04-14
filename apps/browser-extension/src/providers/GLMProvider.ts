import { DeepSeekProvider } from "./DeepSeekProvider";

export class GLMProvider extends DeepSeekProvider {
  readonly name = "GLM";

  protected getEndpointPath(): string {
    return "/chat/completions";
  }
}
