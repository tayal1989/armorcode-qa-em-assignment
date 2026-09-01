import { test, expect } from '@playwright/test';
import testData from '../../testdata.json';
import logger from '../../helpers/logger';

test.describe('E2E Checkout Flow', () => {
  test.beforeEach(async ({ page }) => {
    logger.info('[START] Navigating to storefront homepage');
    await page.goto('/');
  });

  test('Should successfully checkout a product with valid billing and card details', async ({ page }, testInfo) => {
    logger.info('[EXECUTE] Selecting first product from catalog list');
    // 1. Browse and select the first product
    const firstProduct = page.locator('[data-cy="product-card"]').first();
    await expect(firstProduct).toBeVisible();
    await firstProduct.click();

    // 2. Add product to cart (which redirects to /cart)
    const addToCartBtn = page.locator('[data-cy="product-add-to-cart"]');
    await expect(addToCartBtn).toBeVisible();
    logger.info('[ACTION] Adding item to cart and waiting for redirect');
    await Promise.all([
      page.waitForURL(/\/cart/),
      addToCartBtn.click()
    ]);
    logger.info('[REDIRECT] Switched to Cart page for checkout');

    const c = testData.ui.checkout;

    // 3. Fill in the Checkout Form
    logger.info(`[FORM] Typing shipping details (Email: ${c.email}, Zip: ${c.zipCode})`);
    await page.fill('#email', c.email);
    await page.fill('#street_address', c.streetAddress);
    await page.fill('#zip_code', c.zipCode);
    await page.fill('#city', c.city);
    await page.fill('#state', c.state);
    await page.fill('#country', c.country);
    
    logger.info(`[FORM] Typing billing details (Card: ${c.creditCardNumber.substring(0, 4)}... CVV: ${c.creditCardCvv})`);
    await page.fill('#credit_card_number', c.creditCardNumber);
    await page.selectOption('#credit_card_expiration_month', c.creditCardExpirationMonth);
    
    const futureYear = (new Date().getFullYear() + 2).toString();
    await page.selectOption('#credit_card_expiration_year', futureYear);
    await page.fill('#credit_card_cvv', c.creditCardCvv);

    // Capture screenshot right before submitting checkout form
    const formScreenshot = await page.screenshot({ path: `reports/screenshots/${testInfo.project.name}-checkout-form.png` });
    await testInfo.attach('Checkout Form Filled', { body: formScreenshot, contentType: 'image/png' });
    logger.debug('[SCREENSHOT] Attached filled checkout form');

    // 4. Submit Order
    const placeOrderBtn = page.locator('[data-cy="checkout-place-order"], button[type="submit"]:has-text("Place Order")');
    await expect(placeOrderBtn).toBeEnabled();
    logger.info('[ACTION] Clicking Place Order button and waiting for checkout redirect');
    await Promise.all([
      page.waitForURL(/\/cart\/checkout\/.+/, { timeout: 15000 }),
      placeOrderBtn.click()
    ]);

    // 5. Verify Checkout Confirmation screen is displayed
    await expect(page.locator('text=Your order is complete!')).toBeVisible({ timeout: 10000 });
    logger.info('[ASSERT] Verified checkout confirmation message');
    
    // Verify that the Order ID is present on the confirmation screen
    const orderIdLabel = page.locator('text=Order ID:');
    await expect(orderIdLabel).toBeVisible();

    // Extract Order ID
    const orderIdText = await page.locator('span:has-text("Order ID:") + span').first().textContent();
    logger.info(`[CHECKOUT SUCCESS] Generated Order ID: ${orderIdText}`);

    // Capture screenshot on successful order completion
    const successScreenshot = await page.screenshot({ path: `reports/screenshots/${testInfo.project.name}-checkout-success.png` });
    await testInfo.attach('Checkout Success Screenshot', { body: successScreenshot, contentType: 'image/png' });
    logger.info('[SUCCESS] End-to-end checkout UI flow completed successfully');
  });
});
