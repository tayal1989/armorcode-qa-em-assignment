import { test, expect } from '@playwright/test';
import { ApiClient } from '../../helpers/api_client';
import testData from '../../testdata.json';
import logger from '../../helpers/logger';
import Ajv from 'ajv';
import cartSchema from './schemas/cart.schema.json';

const ajv = new Ajv();
const validateCart = ajv.compile(cartSchema);

test.describe('Cart Operations API', () => {
  let apiClient: ApiClient;
  let sessionId: string;
  const productId = testData.api.productId;

  test.beforeEach(async ({ request }) => {
    apiClient = new ApiClient(request);
    // Generate a unique session ID for each test to run in isolation
    sessionId = `session-${Math.random().toString(36).substring(2, 15)}`;
    logger.info(`[START] Initializing Cart Operations API test with Session ID: ${sessionId}`);
    // Ensure cart is empty before each test
    await apiClient.emptyCart(sessionId);
  });

  test.afterEach(async () => {
    logger.info(`[CLEANUP] Clearing session cart for Session ID: ${sessionId}`);
    // Clean up cart after each test
    await apiClient.emptyCart(sessionId);
  });

  test('Validate cart lifecycle (Add, Get, and Empty)', async () => {
    logger.info('[EXECUTE] Step 1: Getting initial cart session status');
    // 1. Get Cart (Should be empty initially)
    const getInitial = await apiClient.getCart(sessionId);
    expect(getInitial.status()).toBe(200);
    let cart = await getInitial.json();
    logger.debug(`[STATUS] Initial cart contains: ${cart.items.length} items`);
    expect(cart.items.length).toBe(0);

    // Validate empty cart schema
    logger.info('[SCHEMA] Validating initial empty cart schema contract');
    const validInit = validateCart(cart);
    if (!validInit) {
      logger.error(`[SCHEMA ERROR] Initial cart schema validation failed: ${JSON.stringify(validateCart.errors)}`);
    }
    expect(validInit).toBe(true);

    logger.info(`[EXECUTE] Step 2: Adding Product ID ${productId} with quantity ${testData.api.quantityNormal}`);
    // 2. Add Item to Cart
    const addItem = await apiClient.addItemToCart(sessionId, productId, testData.api.quantityNormal);
    expect(addItem.status()).toBe(200);
    cart = await addItem.json();
    logger.debug(`[STATUS] Cart size after addition: ${cart.items.length}`);
    expect(cart.items.length).toBe(1);
    expect(cart.items[0].productId).toBe(productId);
    expect(cart.items[0].quantity).toBe(testData.api.quantityNormal);

    // Validate populated cart schema
    logger.info('[SCHEMA] Validating populated cart schema contract');
    const validAdd = validateCart(cart);
    if (!validAdd) {
      logger.error(`[SCHEMA ERROR] Populated cart schema validation failed: ${JSON.stringify(validateCart.errors)}`);
    }
    expect(validAdd).toBe(true);

    logger.info('[EXECUTE] Step 3: Getting cart again to verify persistence');
    // 3. Get Cart again to verify persistence
    const getSecond = await apiClient.getCart(sessionId);
    expect(getSecond.status()).toBe(200);
    cart = await getSecond.json();
    expect(cart.items.length).toBe(1);
    expect(cart.items[0].productId).toBe(productId);
    expect(cart.items[0].quantity).toBe(testData.api.quantityNormal);

    logger.info('[EXECUTE] Step 4: Deleting cart session contents');
    // 4. Empty Cart
    const deleteCart = await apiClient.emptyCart(sessionId);
    expect(deleteCart.status()).toBe(204);

    logger.info('[EXECUTE] Step 5: Getting final cart to verify empty state');
    // 5. Verify cart is empty again
    const getFinal = await apiClient.getCart(sessionId);
    expect(getFinal.status()).toBe(200);
    cart = await getFinal.json();
    logger.debug(`[STATUS] Final cart contains: ${cart.items.length} items`);
    expect(cart.items.length).toBe(0);

    // Validate final cart schema
    logger.info('[SCHEMA] Validating final empty cart schema contract');
    const validFinal = validateCart(cart);
    expect(validFinal).toBe(true);
    logger.info('[SUCCESS] Cart lifecycle verification completed successfully');
  });

  test('Validate invalid item quantity boundary rejection - Integer Overflow', async () => {
    logger.info(`[EXECUTE] Adding overflow quantity (${testData.api.quantityOverflow}) for Product ID ${productId}`);
    // Try to add a quantity that causes 32-bit integer overflow (2,147,483,648)
    // The backend should reject this payload or fail gracefully (returning HTTP 500 error)
    const response = await apiClient.addItemToCart(sessionId, productId, testData.api.quantityOverflow);
    
    logger.debug(`[RESPONSE] Rejection response status: ${response.status()}`);
    // We expect the server to reject the overflow request with an error status code
    expect(response.status()).not.toBe(200);
    expect(response.status()).toBe(500);

    // Verify the cart contents were not modified
    const getCart = await apiClient.getCart(sessionId);
    const cart = await getCart.json();
    logger.info(`[ASSERT] Cart size after overflow attempt: ${cart.items.length} items`);
    expect(cart.items.length).toBe(0);

    // Validate schema is still correct
    const valid = validateCart(cart);
    expect(valid).toBe(true);
    logger.info('[SUCCESS] Integer overflow quantity addition successfully rejected');
  });

  test('Validate invalid item quantity boundary rejection - Negative Quantity', async () => {
    test.fail(true, 'Known security vulnerability: C# CartService accepts negative quantities and decrements cart balance.');
    logger.info(`[EXECUTE] Adding negative quantity (${testData.api.quantityNegative}) for Product ID ${productId}`);
    // Try to add a negative quantity.
    // In a secure application, negative quantities must be rejected (400 Bad Request or similar).
    // If the API allows the request, the resulting cart item quantity must not be negative.
    const response = await apiClient.addItemToCart(sessionId, productId, testData.api.quantityNegative);

    logger.debug(`[RESPONSE] Response status: ${response.status()}`);
    if (response.status() === 200) {
      const cart = await response.json();
      
      // Perform Ajv JSON Schema validation (even under vulnerability status, structure must match contract)
      logger.info('[SCHEMA] Validating cart schema contract after negative addition vulnerability');
      const valid = validateCart(cart);
      if (!valid) {
        logger.error(`[SCHEMA ERROR] Vulnerable cart schema validation failed: ${JSON.stringify(validateCart.errors)}`);
      }
      expect(valid).toBe(true);

      const item = cart.items.find((i: any) => i.productId === productId);
      const quantity = item ? item.quantity : 0;
      
      logger.warn(`[SECURITY RISK] Negative quantity accepted. Cart quantity is now: ${quantity}`);
      expect(quantity).toBeGreaterThanOrEqual(0);
    } else {
      expect(response.status()).toBe(400);
    }
  });
});
