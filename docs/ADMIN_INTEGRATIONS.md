# Admin Panel Integration System

## Overview
The SmartQR Code Generator admin panel features a comprehensive integration management system for payment gateways, webhooks, API monitoring, and third-party services.

## Integration Pages

### 1. All Integrations (`/admin/integrations`)
Central hub for managing all third-party integrations.

**Features:**
- Overview cards showing integration status
- Category filtering (Payment, Auth, Storage, Analytics)
- Quick access to configuration pages
- Real-time status indicators
- Documentation links

**Statistics:**
- Total integrations
- Active integrations
- Inactive integrations
- Error count

**Supported Integrations:**
- **Payment Gateways:**
  - Paystack (African payments)
  - Flutterwave V4 (Pan-African with customer management)
  - Stripe (Global payments)
  - PayPal (Global subscriptions)

- **Storage & Database:**
  - Supabase (PostgreSQL, Auth, Real-time)

- **Authentication:**
  - Firebase (Admin SDK, Auth)

### 2. Payment Gateways (`/admin/payment-settings`)
Configure payment provider credentials and settings.

**Features:**
- Multi-provider support with tabs
- Secure credential storage (password-masked inputs)
- Test connection functionality
- Enable/disable toggles for each provider
- V4 API integration for Flutterwave
- Real-time status indicators

**Flutterwave V4 Capabilities:**
- ✅ Automatic customer management
- ✅ Multiple payment methods (Card, Mobile Money, Bank Transfer, USSD)
- ✅ Transaction verification and fee calculation
- ✅ Customer search and update

**Required Credentials:**
- **Paystack:** Public Key, Secret Key, Plan Codes
- **Flutterwave V4:** Client ID, Client Secret, Encryption Key
- **Stripe:** Secret Key, Public Key, Webhook Secret, Price IDs
- **PayPal:** Client ID, Client Secret, Plan IDs

### 3. Flutterwave Customers (`/admin/flutterwave-customers`)
Manage Flutterwave V4 customer records.

**Features:**
- Paginated customer list (20 per page)
- Search by email or name
- View detailed customer information
- Customer metadata display
- Address and phone information
- Creation date tracking

**Customer Information:**
- Customer ID (Flutterwave)
- Full name (first, middle, last)
- Email address
- Phone number with country code
- Full address (line1, line2, city, state, postal code, country)
- Custom metadata
- Created timestamp

### 4. Webhooks (`/admin/integrations/webhooks`)
Configure and monitor webhook endpoints.

**Features:**
- Add/Edit/Delete webhooks
- Enable/disable individual webhooks
- Event subscription management
- Success rate tracking
- Last triggered timestamp
- Provider assignment

**Supported Events:**
- `payment.success`
- `payment.failed`
- `subscription.created`
- `subscription.cancelled`
- `subscription.updated`
- `refund.processed`
- `customer.created`
- `customer.updated`

**Security:**
- HTTPS-only endpoints
- Signature verification support
- POST request handling

### 5. API Logs (`/admin/integrations/logs`)
Monitor all API requests to external services.

**Features:**
- Real-time log display
- Filter by provider, status, method
- Request/response details
- Performance metrics (duration)
- Error tracking
- Request ID tracking

**Statistics:**
- Total requests
- Successful requests (2xx)
- Error count (4xx, 5xx)
- Average response time

**Log Details:**
- Timestamp
- HTTP method (GET, POST, PUT, DELETE, PATCH)
- Endpoint URL
- Provider name
- Status code
- Response duration (ms)
- Request ID
- Error messages (if any)

## Navigation Structure

```
Admin Panel
├── Dashboard
├── User Management
├── Subscriptions
├── Payments
├── Transactions
├── Settings
└── Integrations Section
    ├── All Integrations (Overview)
    ├── Payment Gateways (Configuration)
    ├── Flutterwave Customers (Customer Management)
    ├── Webhooks (Event Notifications)
    ├── API Logs (Monitoring)
    └── API Credentials (Keys & Secrets)
```

## API Endpoints

### Payment Settings
- `GET /api/admin/payment-settings` - Fetch all provider settings
- `POST /api/admin/payment-settings` - Save provider credentials
- `POST /api/admin/payment-settings/test` - Test provider connection

### Flutterwave Customers (V4 API)
- `GET /api/admin/flutterwave/customers` - List customers with pagination
  - Query params: `page`, `size`, `email`, `name`
- `POST /api/admin/flutterwave/customers` - Create new customer
- `GET /api/admin/flutterwave/customers/[id]` - Get customer details
- `PUT /api/admin/flutterwave/customers/[id]` - Update customer

### Authentication
All admin API endpoints require Firebase authentication:
```typescript
Headers: {
  'Authorization': 'Bearer <firebase_id_token>'
}
```

## Environment Variables

### Required Variables
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=your_client_email
FIREBASE_ADMIN_PRIVATE_KEY=your_private_key

# Payment Providers
PAYSTACK_PUBLIC_KEY=pk_live_xxx
PAYSTACK_SECRET_KEY=sk_live_xxx

FLUTTERWAVE_CLIENT_ID=FLWCLIENTID-xxx
FLUTTERWAVE_CLIENT_SECRET=FLWSECK-xxx
FLUTTERWAVE_ENCRYPTION_KEY=FLWSECK_TESTxxx

STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLIC_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

PAYPAL_CLIENT_ID=xxx
PAYPAL_CLIENT_SECRET=xxx
```

## Setup Instructions

### 1. Configure Payment Gateways
1. Navigate to `/admin/payment-settings`
2. Select provider tab (Paystack, Flutterwave, Stripe, PayPal)
3. Enter API credentials
4. Click "Test Connection" to verify
5. Click "Save Settings"
6. Toggle provider to "Active"

### 2. Set Up Webhooks
1. Navigate to `/admin/integrations/webhooks`
2. Click "Add Webhook"
3. Enter webhook details:
   - Name (descriptive)
   - URL (HTTPS endpoint)
   - Provider (select from list)
   - Events (select relevant events)
4. Click "Add Webhook"
5. Configure webhook URL in payment provider dashboard

### 3. Monitor API Activity
1. Navigate to `/admin/integrations/logs`
2. Filter by provider, status, or method
3. Review request details and error messages
4. Monitor performance metrics

## Security Best Practices

1. **Credential Storage:**
   - All credentials stored in Supabase with encryption
   - Password-masked input fields
   - Never expose secrets in client-side code

2. **Webhook Security:**
   - Verify signatures from payment providers
   - Use HTTPS-only endpoints
   - Validate request origin
   - Implement rate limiting

3. **API Authentication:**
   - All admin routes require Firebase authentication
   - Token verification on every request
   - Role-based access control (admin only)

4. **Error Handling:**
   - Sensitive data sanitized in error messages
   - Detailed logs for debugging (admin-only)
   - User-friendly error messages

## Troubleshooting

### Payment Gateway Connection Fails
- Verify API keys are correct
- Check if using test vs. live credentials
- Ensure provider API is not down
- Review API logs for detailed error messages

### Webhook Not Receiving Events
- Verify webhook URL is HTTPS
- Check if webhook is enabled
- Confirm event types are selected
- Review provider webhook logs
- Test endpoint manually

### Customer Management Issues
- Ensure Flutterwave V4 API is enabled
- Verify secret key has customer management permissions
- Check API logs for detailed errors

## Future Enhancements

- [ ] Real-time webhook event monitoring
- [ ] Webhook retry mechanism with exponential backoff
- [ ] API rate limiting dashboard
- [ ] Integration health checks and alerts
- [ ] Bulk customer operations
- [ ] Export customer data to CSV
- [ ] Integration marketplace
- [ ] Custom webhook transformations
- [ ] API usage analytics and billing

## Support

For integration issues or questions:
- Check API documentation links in each integration card
- Review API logs for detailed error messages
- Contact provider support for API-specific issues
- Refer to provider developer documentation

## Version History

- **v1.3.0** (2026-01-02)
  - Added Flutterwave V4 customer management
  - Created webhooks management page
  - Implemented API logs monitoring
  - Enhanced integration overview
  
- **v1.2.0** (2026-01-01)
  - Added Flutterwave V4 API support
  - Removed SDK dependencies
  - Direct REST API integration
  
- **v1.1.0** (2025-12-30)
  - Added payment gateway configuration
  - Multi-provider support
  - Test connection feature

- **v1.0.0** (2025-12-28)
  - Initial admin panel release
  - Basic CRUD operations
