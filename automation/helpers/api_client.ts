import { APIRequestContext, APIResponse } from '@playwright/test';

/**
 * Interface representing Product structure from Astronomy Shop API.
 */
export interface Product {
  id: string;
  name: string;
  description: string;
  picture: string;
  priceUsd: {
    currencyCode: string;
    units: number;
    nanos: number;
  };
  categories: string[];
}

/**
 * Interface representing a Cart Item from Astronomy Shop API.
 */
export interface CartItem {
  productId: string;
  quantity: number;
}

/**
 * Interface representing the Cart response structure.
 */
export interface CartResponse {
  userId: string;
  items: Array<{
    productId: string;
    quantity: number;
    product?: Product;
  }>;
}

/**
 * Interface representing Address for checkout.
 */
export interface Address {
  streetAddress: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
}

/**
 * Interface representing Credit Card details.
 */
export interface CreditCard {
  creditCardNumber: string;
  creditCardCvv: string;
  creditCardExpirationMonth: number;
  creditCardExpirationYear: number;
}

/**
 * Interface representing Checkout Order request payload.
 */
export interface PlaceOrderRequest {
  userId: string;
  email: string;
  address: Address;
  creditCard: CreditCard;
  userCurrency: string;
}

/**
 * High-quality client wrapper for interacting with the OpenTelemetry Astronomy Shop REST API.
 */
export class ApiClient {
  constructor(private request: APIRequestContext) {}

  /**
   * Fetch all products from the catalog.
   */
  async getProducts(currencyCode = 'USD'): Promise<APIResponse> {
    return this.request.get('/api/products', {
      params: { currencyCode },
    });
  }

  /**
   * Fetch a single product by ID.
   */
  async getProductById(productId: string, currencyCode = 'USD'): Promise<APIResponse> {
    return this.request.get(`/api/products/${productId}`, {
      params: { currencyCode },
    });
  }

  /**
   * Fetch the current cart for a user/session.
   */
  async getCart(sessionId: string, currencyCode = 'USD'): Promise<APIResponse> {
    return this.request.get('/api/cart', {
      params: {
        sessionId,
        currencyCode,
      },
    });
  }

  /**
   * Add a product item to the user's cart.
   */
  async addItemToCart(
    userId: string,
    productId: string,
    quantity: number,
    currencyCode = 'USD'
  ): Promise<APIResponse> {
    return this.request.post('/api/cart', {
      params: { currencyCode },
      data: {
        userId,
        item: {
          productId,
          quantity,
        },
      },
    });
  }

  /**
   * Clear all items in the user's cart.
   */
  async emptyCart(userId: string): Promise<APIResponse> {
    return this.request.delete('/api/cart', {
      data: { userId },
    });
  }

  /**
   * Submit an order for checkout.
   */
  async placeOrder(order: PlaceOrderRequest, currencyCode = 'USD'): Promise<APIResponse> {
    return this.request.post('/api/checkout', {
      params: { currencyCode },
      data: order,
    });
  }
}
