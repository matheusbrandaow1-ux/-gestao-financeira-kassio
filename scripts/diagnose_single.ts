import 'dotenv/config';
import { categorizationEngine } from '../server/ai/categorizationEngine';
import { LunchMoneyClient } from '../server/integrations/lunchmoney/client';
import { AssignableCategoryInfo } from '../server/ai/types';
import { GoogleGenAI } from '@google/genai';

async function diagnose() {
  const apiKey = process.env.LUNCH_MONEY_API_KEY;
  const client = new LunchMoneyClient();
  const categoriesRes = await client.getCategories({ format: 'flattened' });
  const rawCategories = categoriesRes.categories || [];
  const assignableCategories: AssignableCategoryInfo[] = rawCategories
    .filter((c: any) => !c.is_group && !c.archived)
    .map((c: any) => {
      const parentGroup = c.group_id ? rawCategories.find((g: any) => g.id === c.group_id) : null;
      return {
        id: String(c.id),
        name: c.name,
        groupName: parentGroup ? parentGroup.name : 'Geral',
        type: c.is_income ? 'RECEITA' : 'DESPESA'
      };
    });

  const tx = {
    id: 'test-1',
    merchant: 'Débit TWINT 0287 - Lidl La Chaux de Fonds 0400004593698748',
    payee: 'Débit TWINT 0287 - Lidl La Chaux de Fonds 0400004593698748',
    description: 'Débit TWINT 0287 - Lidl La Chaux de Fonds 0400004593698748',
    amount: 6.09,
    currency: 'CHF',
    date: '2026-06-16',
    country: 'Suíça'
  };

  console.log('Testing classification for:', tx.payee);
  
  // Test raw Gemini call directly
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    console.log('Calling Gemini directly with googleSearch tool...');
    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Identifique o estabelecimento "${tx.payee}" na Suíça. Categorias permitidas: ${JSON.stringify(assignableCategories.slice(0, 15))}`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    console.log('Raw Gemini text:', res.text);
    console.log('Grounding metadata:', res.candidates?.[0]?.groundingMetadata);
  } catch (err: any) {
    console.error('Gemini error:', err);
  }

  const result = await categorizationEngine.classifyTransaction(
    tx,
    assignableCategories,
    [],
    'kassio-pf'
  );
  console.log('\nEngine Result:', result);
}

diagnose();
