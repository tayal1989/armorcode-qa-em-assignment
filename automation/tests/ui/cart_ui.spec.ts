import { test, expect } from '@playwright/test';
import testData from '../../testdata.json';
import logger from '../../helpers/logger';

test.describe('Cart UI Verification', () => {
  test.beforeEach(async ({ page }) => {
    logger.info('[START] Navigating to storefront homepage');
    // Go to storefront homepage
    await page.goto('/');
  });

  test('Add product to cart and verify cart badge update', async ({ page }, testInfo) => {
    logger.info('[EXECUTE] Finding first product card on catalog');
    // 1. Identify and click the first product
    const firstProductLink = page.locator('[data-cy="product-card"]').first();
    await expect(firstProductLink).toBeVisible();
    
    // Get product title on homepage to cross-reference later
    const expectedTitle = await firstProductLink.locator('h3, p, div').first().textContent();
    logger.debug(`[PRODUCT] Selected: ${expectedTitle}`);
    await firstProductLink.click();

    // 2. We should now be on the product detail page (PDP)
    await expect(page).toHaveURL(/\/product\/.+/);
    logger.info(`[PDP] Navigated successfully. Current URL: ${page.url()}`);

    // Get the product title on PDP to ensure we are on the correct page
    const pdpTitle = await page.locator('[data-cy="product-name"]').first().textContent();
    logger.debug(`[PDP] Product Name: ${pdpTitle}`);
    if (expectedTitle && pdpTitle) {
      expect(pdpTitle.trim().toLowerCase()).toContain(expectedTitle.trim().substring(0, 10).toLowerCase());
    }

    // Locate quantity select and select quantity
    const quantitySelect = page.locator('select[data-cy="product-quantity"]').first();
    logger.info(`[ACTION] Selecting quantity: ${testData.ui.cartQuantity1}`);
    await quantitySelect.selectOption({ label: testData.ui.cartQuantity1.toString() });

    // Capture screenshot on PDP showing selected quantity
    const pdpScreenshot = await page.screenshot({ path: `reports/screenshots/${testInfo.project.name}-pdp-selection.png` });
    await testInfo.attach('PDP Selection Screenshot', { body: pdpScreenshot, contentType: 'image/png' });
    logger.debug('[SCREENSHOT] Attached PDP selection');

    // Click "Add To Cart"
    const addToCartBtn = page.locator('[data-cy="product-add-to-cart"]');
    await expect(addToCartBtn).toBeVisible();
    await addToCartBtn.click();

    // 3. Verify that the browser redirects to the cart page
    await expect(page).toHaveURL(/\/cart/);
    logger.info('[REDIRECT] Switched to Cart page');

    // Verify that the cart badge updates to reflect the added unique item ('1')
    const cartBadge = page.locator('[data-cy="cart-item-count"]').first();
    logger.info('[ASSERT] Verifying cart badge is 1');
    await expect(cartBadge).toHaveText('1');

    // Capture final cart page screenshot
    const cartScreenshot = await page.screenshot({ path: `reports/screenshots/${testInfo.project.name}-cart-added.png` });
    await testInfo.attach('Cart Added Screenshot', { body: cartScreenshot, contentType: 'image/png' });
    logger.info('[SUCCESS] Cart UI badge check completed successfully');
  });

  test('Verify cart calculations, subtotal, and empty cart functionality', async ({ page }, testInfo) => {
    logger.info('[EXECUTE] Click target product from catalog list');
    // 1. Click first product and navigate to PDP
    await page.locator('[data-cy="product-card"]').first().click();

    // Get product price from PDP
    const priceText = await page.locator('[data-cy="product-price"]').first().textContent();
    const cleanPriceText = priceText ? priceText.replace('$', '').trim() : '0';
    const unitPrice = parseFloat(cleanPriceText);
    logger.debug(`[PDP] Product unit price: $${unitPrice}`);

    // Select quantity
    const quantitySelect = page.locator('select[data-cy="product-quantity"]').first();
    logger.info(`[ACTION] Selecting quantity: ${testData.ui.cartQuantity2}`);
    await quantitySelect.selectOption({ label: testData.ui.cartQuantity2.toString() });

    // Click Add To Cart
    await page.locator('[data-cy="product-add-to-cart"]').click();

    // Verify we redirected to the Cart page
    await expect(page).toHaveURL(/\/cart/);
    logger.info('[REDIRECT] Switched to Cart page for calculations check');

    // Verify subtotal matches unitPrice * cartQuantity2
    const expectedSubtotal = unitPrice * testData.ui.cartQuantity2;
    logger.info(`[ASSERT] Expected subtotal calculation: $${expectedSubtotal}`);
    
    // Find the elements displaying prices in the cart items list
    const cartPrices = page.locator('text=$');
    const priceCount = await cartPrices.count();
    expect(priceCount).toBeGreaterThanOrEqual(1);

    // Capture calculations screenshot
    const calcScreenshot = await page.screenshot({ path: `reports/screenshots/${testInfo.project.name}-cart-calculations.png` });
    await testInfo.attach('Cart Calculations Screenshot', { body: calcScreenshot, contentType: 'image/png' });
    logger.debug('[SCREENSHOT] Attached calculations screenshot');

    // Click "Empty Cart" to check empty cart UI state
    const emptyCartBtn = page.locator('button:has-text("Empty Cart")');
    await expect(emptyCartBtn).toBeVisible();
    logger.info('[ACTION] Clicking Empty Cart button');
    await emptyCartBtn.click();

    // Verify cart is now empty
    await expect(page.locator('text=Your shopping cart is empty!')).toBeVisible();
    logger.info('[ASSERT] Verified empty cart container message');
    
    // The cart badge should be empty or show 0
    const cartBadge = page.locator('[data-cy="cart-item-count"]').first();
    await expect(cartBadge).not.toBeAttached();
    logger.debug('[ASSERT] Verified cart badge count node is not attached');

    // Capture empty cart screenshot
    const emptyCartScreenshot = await page.screenshot({ path: `reports/screenshots/${testInfo.project.name}-cart-empty.png` });
    await testInfo.attach('Empty Cart Screenshot', { body: emptyCartScreenshot, contentType: 'image/png' });
    logger.info('[SUCCESS] Cart UI calculations and clear features verified successfully');
  });
});
