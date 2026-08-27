import { LunchMoneyClient } from '../server/integrations/lunchmoney/client';

async function testUpdate() {
  const apiKey = process.env.LUNCH_MONEY_API_KEY;
  console.log('Testing Lunch Money updateTransaction...');
  
  // Let's test with both v2 and v1 and inspect the raw response
  const id = 2461845636;
  const urlV2 = `https://api.lunchmoney.dev/v2/transactions/${id}`;
  const urlV1 = `https://api.lunchmoney.dev/v1/transactions/${id}`;
  
  // First, get categories
  const client = new LunchMoneyClient();
  const cats = await client.getCategories();
  console.log('Available categories in Lunch Money:');
  cats.categories?.slice(0, 10).forEach((c: any) => console.log(`- ${c.name} (id: ${c.id})`));

  const testCatId = cats.categories?.[0]?.id;
  console.log(`Testing category ID: ${testCatId}`);

  // Test PUT to v2
  try {
    const resV2 = await fetch(urlV2, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${apiKey?.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transaction: {
          category_id: testCatId
        }
      })
    });
    console.log('v2 status:', resV2.status);
    const textV2 = await resV2.text();
    console.log('v2 response:', textV2);
  } catch (err: any) {
    console.error('v2 error:', err.message);
  }

  // Test PUT to v1
  try {
    const resV1 = await fetch(urlV1, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${apiKey?.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transaction: {
          category_id: testCatId
        }
      })
    });
    console.log('v1 status:', resV1.status);
    const textV1 = await resV1.text();
    console.log('v1 response:', textV1);
  } catch (err: any) {
    console.error('v1 error:', err.message);
  }
}

testUpdate();
