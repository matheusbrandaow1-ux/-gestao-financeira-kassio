import { LunchMoneyClient } from '../server/integrations/lunchmoney/client';

async function listAllCategories() {
  const apiKey = process.env.LUNCH_MONEY_API_KEY;
  const client = new LunchMoneyClient();
  const res = await client.getCategories({ format: 'flattened' });
  console.log('--- CATEGORIAS DO LUNCH MONEY ---');
  res.categories?.forEach((c: any) => {
    console.log(`ID: ${c.id} | Name: "${c.name}" | is_group: ${c.is_group} | group_id: ${c.group_id}`);
  });
}

listAllCategories();
