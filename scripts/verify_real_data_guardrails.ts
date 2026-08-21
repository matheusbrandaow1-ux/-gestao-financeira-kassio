import assert from 'node:assert/strict';
import { DEFAULT_CATEGORIES } from '../src/context/ClientContext';
import { getDefaultPortfolios } from '../src/lib/investmentData';

const categoryNames = DEFAULT_CATEGORIES.map(c => c.name);
assert(categoryNames.includes('Supermercado & Alimentação') || categoryNames.includes('Supermercado'), 'Expected client categories to include real-world spend categories.');
assert(categoryNames.includes('Streaming') || categoryNames.includes('Software / Apps') || categoryNames.includes('Restaurantes'), 'Expected personalized spending categories to be preserved.');
assert(getDefaultPortfolios('kassio-pf').length === 0, 'Default portfolio fallback must not invent financial data.');

console.log('real data guardrails ok');
