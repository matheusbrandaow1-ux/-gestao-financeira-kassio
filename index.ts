import { AIProvider } from '../interfaces/AIProvider';
import { GeminiProvider } from './GeminiProvider';
import { OpenAIProvider } from './OpenAIProvider';

let currentProvider: AIProvider | null = null;

/**
 * Provider selection is server-side only.
 * AI_PROVIDER=OPENAI forces OpenAI; AI_PROVIDER=GEMINI forces Gemini.
 * Without an explicit choice, prefer OpenAI when configured and otherwise keep Gemini.
 */
export function getAIProvider(): AIProvider {
  if (currentProvider) return currentProvider;
  const requested = (process.env.AI_PROVIDER || '').trim().toUpperCase();
  const openai = new OpenAIProvider();
  const gemini = new GeminiProvider();
  if (requested === 'OPENAI') {
    currentProvider = openai.isAvailable() ? openai : (gemini.isAvailable() ? gemini : openai);
  } else if (requested === 'GEMINI') {
    currentProvider = gemini.isAvailable() ? gemini : (openai.isAvailable() ? openai : gemini);
  } else {
    currentProvider = openai.isAvailable() ? openai : gemini;
  }
  return currentProvider;
}

export function setAIProvider(provider: AIProvider) {
  currentProvider = provider;
}
