import { test, expect } from '@playwright/test';
import { ApiClient } from '../../helpers/api_client';
import logger from '../../helpers/logger';
import Ajv from 'ajv';
import productSchema from './schemas/product.schema.json';

const ajv = new Ajv();
const validateProduct = ajv.compile(productSchema);
// Schema for an array of products
const validateProductList = ajv.compile({
  type: 'array',
  items: productSchema
});

test.describe('Product Catalog API', () => {
  let apiClient: ApiClient;

  test.beforeEach(({ request }) => {
    logger.info('[START] Setting up Product Catalog API test client');
    apiClient = new ApiClient(request);
  });

  test('Validate product catalog list response structure and values', async () => {
    logger.info('[EXECUTE] GET /api/products request initiated');
    const response = await apiClient.getProducts('USD');
    logger.debug(`[RESPONSE] Status received: ${response.status()}`);
    expect(response.status()).toBe(200);

    const products = await response.json();
    logger.info(`[ASSERT] Product catalog size: ${products.length} items`);
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);

    // Perform Ajv JSON Schema validation
    logger.info('[SCHEMA] Validating product catalog list JSON Schema contract');
    const valid = validateProductList(products);
    if (!valid) {
      logger.error(`[SCHEMA ERROR] Catalog schema validation failed: ${JSON.stringify(validateProductList.errors)}`);
    }
    expect(valid).toBe(true);
    logger.info('[SUCCESS] Product list JSON Schema checks completed successfully');
  });

  test('Validate single product retrieval by ID', async () => {
    logger.info('[EXECUTE] Fetching products list to select a target product ID');
    const listResponse = await apiClient.getProducts('USD');
    const products = await listResponse.json();
    const targetProduct = products[0];
    logger.info(`[EXECUTE] GET /api/products/${targetProduct.id} request initiated`);

    const singleResponse = await apiClient.getProductById(targetProduct.id, 'USD');
    logger.debug(`[RESPONSE] Status received: ${singleResponse.status()}`);
    expect(singleResponse.status()).toBe(200);

    const product = await singleResponse.json();
    
    // Perform Ajv JSON Schema validation on single product
    logger.info(`[SCHEMA] Validating product detail JSON Schema contract for target ID: ${targetProduct.id}`);
    const valid = validateProduct(product);
    if (!valid) {
      logger.error(`[SCHEMA ERROR] Product detail validation failed: ${JSON.stringify(validateProduct.errors)}`);
    }
    expect(valid).toBe(true);

    logger.info(`[ASSERT] Checking retrieved product fields for target ID: ${targetProduct.id}`);
    expect(product.id).toBe(targetProduct.id);
    expect(product.name).toBe(targetProduct.name);
    expect(product.description).toBe(targetProduct.description);
    expect(product.picture).toBe(targetProduct.picture);
    expect(product.priceUsd.units).toBe(targetProduct.priceUsd.units);
    expect(product.priceUsd.nanos).toBe(targetProduct.priceUsd.nanos);
    logger.info('[SUCCESS] Single product detail extraction verified successfully');
  });
});
