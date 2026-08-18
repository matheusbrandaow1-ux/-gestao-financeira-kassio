async function testRealUpdate() {
  const apiKey = process.env.LUNCH_MONEY_API_KEY?.trim();
  const id = 2461845636;
  const category_id = 3220542; // Supermercado

  console.log(`Updating tx ${id} to category ${category_id}...`);
  
  // Test v1
  const res1 = await fetch(`https://api.lunchmoney.dev/v1/transactions/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      transaction: { category_id }
    })
  });
  console.log('v1 update response status:', res1.status);
  const data1 = await res1.json();
  console.log('v1 response:', data1);

  // Check if updated in getTransactions
  const resGet = await fetch(`https://api.lunchmoney.dev/v2/transactions?start_date=2026-06-01&end_date=2026-06-30`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  const dataGet = await resGet.json();
  const tx = dataGet.transactions?.find((t: any) => t.id === id);
  console.log('Verified updated tx:', { id: tx?.id, payee: tx?.payee, category_id: tx?.category_id });
}

testRealUpdate();
