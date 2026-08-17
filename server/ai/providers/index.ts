import { AIProvider } from '../interfaces/AIProvider';
import { GeminiProvider } from './GeminiProvider';

let currentProvider: AIProvider | null = null;

/**
 * Returns the active AI Provider.
 * Modular design: Defaults to GeminiProvider; additional providers can be registered here.
 */
export function getAIProvider(): AIProvider {
  if (!currentProvider) {
    currentProvider = new GeminiProvider();
  }
  return currentProvider;
}

export function setAIProvider(provider: AIProvider) {
  currentProvider = provider;
}
