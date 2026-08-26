# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api/cart_api.spec.ts >> Cart Operations API >> Validate invalid item quantity boundary rejection - Negative Quantity
- Location: tests/api/cart_api.spec.ts:118:7

# Error details

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 0
Received:    -5
```

# Test source

```ts
  42  |     const validInit = validateCart(cart);
  43  |     if (!validInit) {
  44  |       logger.error(`[SCHEMA ERROR] Initial cart schema validation failed: ${JSON.stringify(validateCart.errors)}`);
  45  |     }
  46  |     expect(validInit).toBe(true);
  47  | 
  48  |     logger.info(`[EXECUTE] Step 2: Adding Product ID ${productId} with quantity ${testData.api.quantityNormal}`);
  49  |     // 2. Add Item to Cart
  50  |     const addItem = await apiClient.addItemToCart(sessionId, productId, testData.api.quantityNormal);
  51  |     expect(addItem.status()).toBe(200);
  52  |     cart = await addItem.json();
  53  |     logger.debug(`[STATUS] Cart size after addition: ${cart.items.length}`);
  54  |     expect(cart.items.length).toBe(1);
  55  |     expect(cart.items[0].productId).toBe(productId);
  56  |     expect(cart.items[0].quantity).toBe(testData.api.quantityNormal);
  57  | 
  58  |     // Validate populated cart schema
  59  |     logger.info('[SCHEMA] Validating populated cart schema contract');
  60  |     const validAdd = validateCart(cart);
  61  |     if (!validAdd) {
  62  |       logger.error(`[SCHEMA ERROR] Populated cart schema validation failed: ${JSON.stringify(validateCart.errors)}`);
  63  |     }
  64  |     expect(validAdd).toBe(true);
  65  | 
  66  |     logger.info('[EXECUTE] Step 3: Getting cart again to verify persistence');
  67  |     // 3. Get Cart again to verify persistence
  68  |     const getSecond = await apiClient.getCart(sessionId);
  69  |     expect(getSecond.status()).toBe(200);
  70  |     cart = await getSecond.json();
  71  |     expect(cart.items.length).toBe(1);
  72  |     expect(cart.items[0].productId).toBe(productId);
  73  |     expect(cart.items[0].quantity).toBe(testData.api.quantityNormal);
  74  | 
  75  |     logger.info('[EXECUTE] Step 4: Deleting cart session contents');
  76  |     // 4. Empty Cart
  77  |     const deleteCart = await apiClient.emptyCart(sessionId);
  78  |     expect(deleteCart.status()).toBe(204);
  79  | 
  80  |     logger.info('[EXECUTE] Step 5: Getting final cart to verify empty state');
  81  |     // 5. Verify cart is empty again
  82  |     const getFinal = await apiClient.getCart(sessionId);
  83  |     expect(getFinal.status()).toBe(200);
  84  |     cart = await getFinal.json();
  85  |     logger.debug(`[STATUS] Final cart contains: ${cart.items.length} items`);
  86  |     expect(cart.items.length).toBe(0);
  87  | 
  88  |     // Validate final cart schema
  89  |     logger.info('[SCHEMA] Validating final empty cart schema contract');
  90  |     const validFinal = validateCart(cart);
  91  |     expect(validFinal).toBe(true);
  92  |     logger.info('[SUCCESS] Cart lifecycle verification completed successfully');
  93  |   });
  94  | 
  95  |   test('Validate invalid item quantity boundary rejection - Integer Overflow', async () => {
  96  |     logger.info(`[EXECUTE] Adding overflow quantity (${testData.api.quantityOverflow}) for Product ID ${productId}`);
  97  |     // Try to add a quantity that causes 32-bit integer overflow (2,147,483,648)
  98  |     // The backend should reject this payload or fail gracefully (returning HTTP 500 error)
  99  |     const response = await apiClient.addItemToCart(sessionId, productId, testData.api.quantityOverflow);
  100 |     
  101 |     logger.debug(`[RESPONSE] Rejection response status: ${response.status()}`);
  102 |     // We expect the server to reject the overflow request with an error status code
  103 |     expect(response.status()).not.toBe(200);
  104 |     expect(response.status()).toBe(500);
  105 | 
  106 |     // Verify the cart contents were not modified
  107 |     const getCart = await apiClient.getCart(sessionId);
  108 |     const cart = await getCart.json();
  109 |     logger.info(`[ASSERT] Cart size after overflow attempt: ${cart.items.length} items`);
  110 |     expect(cart.items.length).toBe(0);
  111 | 
  112 |     // Validate schema is still correct
  113 |     const valid = validateCart(cart);
  114 |     expect(valid).toBe(true);
  115 |     logger.info('[SUCCESS] Integer overflow quantity addition successfully rejected');
  116 |   });
  117 | 
  118 |   test('Validate invalid item quantity boundary rejection - Negative Quantity', async () => {
  119 |     test.fail(true, 'Known security vulnerability: C# CartService accepts negative quantities and decrements cart balance.');
  120 |     logger.info(`[EXECUTE] Adding negative quantity (${testData.api.quantityNegative}) for Product ID ${productId}`);
  121 |     // Try to add a negative quantity.
  122 |     // In a secure application, negative quantities must be rejected (400 Bad Request or similar).
  123 |     // If the API allows the request, the resulting cart item quantity must not be negative.
  124 |     const response = await apiClient.addItemToCart(sessionId, productId, testData.api.quantityNegative);
  125 | 
  126 |     logger.debug(`[RESPONSE] Response status: ${response.status()}`);
  127 |     if (response.status() === 200) {
  128 |       const cart = await response.json();
  129 |       
  130 |       // Perform Ajv JSON Schema validation (even under vulnerability status, structure must match contract)
  131 |       logger.info('[SCHEMA] Validating cart schema contract after negative addition vulnerability');
  132 |       const valid = validateCart(cart);
  133 |       if (!valid) {
  134 |         logger.error(`[SCHEMA ERROR] Vulnerable cart schema validation failed: ${JSON.stringify(validateCart.errors)}`);
  135 |       }
  136 |       expect(valid).toBe(true);
  137 | 
  138 |       const item = cart.items.find((i: any) => i.productId === productId);
  139 |       const quantity = item ? item.quantity : 0;
  140 |       
  141 |       logger.warn(`[SECURITY RISK] Negative quantity accepted. Cart quantity is now: ${quantity}`);
> 142 |       expect(quantity).toBeGreaterThanOrEqual(0);
      |                        ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
  143 |     } else {
  144 |       expect(response.status()).toBe(400);
  145 |     }
  146 |   });
  147 | });
  148 | 
```