-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "logoUrl" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'MG',
    "phone" TEXT,
    "email" TEXT,
    "fiscalNumber" TEXT,
    "statNumber" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'MGA',
    "timezone" TEXT NOT NULL DEFAULT 'Indian/Antananarivo',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "store_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MANAGER',
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "canManageAll" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "store_members_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "store_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceAr" DECIMAL NOT NULL,
    "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "maxUsers" INTEGER NOT NULL DEFAULT 1,
    "maxProducts" INTEGER NOT NULL DEFAULT 50,
    "maxWarehouses" INTEGER NOT NULL DEFAULT 1,
    "maxCustomers" INTEGER NOT NULL DEFAULT 100,
    "maxSalesPerMonth" INTEGER,
    "featuresJson" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TRIALING',
    "trialEndsAt" DATETIME,
    "currentPeriodStart" DATETIME NOT NULL,
    "currentPeriodEnd" DATETIME NOT NULL,
    "priceAr" DECIMAL NOT NULL,
    "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "subscriptions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "categories_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "brands_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "categoryId" TEXT,
    "brandId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sku" TEXT,
    "barcode" TEXT,
    "imageUrl" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'piece',
    "costPriceAr" DECIMAL NOT NULL,
    "sellingPriceAr" DECIMAL NOT NULL,
    "wholesalePriceAr" DECIMAL,
    "taxRatePct" DECIMAL NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "trackStock" BOOLEAN NOT NULL DEFAULT true,
    "sellByWeight" BOOLEAN NOT NULL DEFAULT false,
    "hasVariants" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "products_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "costPriceAr" DECIMAL,
    "sellingPriceAr" DECIMAL,
    "optionsJson" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "warehouses_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stocks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "quantityAr" DECIMAL NOT NULL DEFAULT 0,
    "reservedQty" DECIMAL NOT NULL DEFAULT 0,
    "minStock" DECIMAL NOT NULL DEFAULT 0,
    "maxStock" DECIMAL,
    "location" TEXT,
    "expiryDate" DATETIME,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "stocks_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stocks_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stocks_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "movementType" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "unitCostAr" DECIMAL,
    "reason" TEXT,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stock_movements_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stock_movements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "tinNumber" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "suppliers_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "birthDate" DATETIME,
    "gender" TEXT,
    "isVip" BOOLEAN NOT NULL DEFAULT false,
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "debtAr" DECIMAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "customers_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "paymentStatus" TEXT NOT NULL DEFAULT 'PAID',
    "subtotalAr" DECIMAL NOT NULL,
    "discountAr" DECIMAL NOT NULL DEFAULT 0,
    "taxAr" DECIMAL NOT NULL DEFAULT 0,
    "totalAr" DECIMAL NOT NULL,
    "amountPaidAr" DECIMAL NOT NULL DEFAULT 0,
    "changeAr" DECIMAL NOT NULL DEFAULT 0,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "notes" TEXT,
    "isWholesale" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "cancelledAt" DATETIME,
    "cancelledById" TEXT,
    "cancelReason" TEXT,
    CONSTRAINT "sales_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "sales_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "sales_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "sales_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "quantityAr" DECIMAL NOT NULL,
    "unitPriceAr" DECIMAL NOT NULL,
    "costPriceAr" DECIMAL NOT NULL,
    "discountAr" DECIMAL NOT NULL DEFAULT 0,
    "taxAr" DECIMAL NOT NULL DEFAULT 0,
    "lineTotalAr" DECIMAL NOT NULL,
    CONSTRAINT "sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sale_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "sale_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "supplierId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "referenceNo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ORDERED',
    "subtotalAr" DECIMAL NOT NULL,
    "discountAr" DECIMAL NOT NULL DEFAULT 0,
    "taxAr" DECIMAL NOT NULL DEFAULT 0,
    "shippingAr" DECIMAL NOT NULL DEFAULT 0,
    "totalAr" DECIMAL NOT NULL,
    "amountPaidAr" DECIMAL NOT NULL DEFAULT 0,
    "expectedAt" DATETIME,
    "receivedAt" DATETIME,
    "notes" TEXT,
    "createdById" TEXT,
    "saleId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "purchases_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "purchases_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "purchases_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchases_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "purchase_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseId" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "quantityAr" DECIMAL NOT NULL,
    "unitCostAr" DECIMAL NOT NULL,
    "discountAr" DECIMAL NOT NULL DEFAULT 0,
    "taxAr" DECIMAL NOT NULL DEFAULT 0,
    "lineTotalAr" DECIMAL NOT NULL,
    "receivedQtyAr" DECIMAL NOT NULL DEFAULT 0,
    CONSTRAINT "purchase_items_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "purchase_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "purchase_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "amountAr" DECIMAL NOT NULL,
    "incurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "receiptUrl" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "expenses_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cash_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "openingBalanceAr" DECIMAL NOT NULL DEFAULT 0,
    "closingBalanceAr" DECIMAL,
    "expectedCloseAr" DECIMAL,
    "differenceAr" DECIMAL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "closedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cash_sessions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cash_sessions_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cash_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cashSessionId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "amountAr" DECIMAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'DEPOSIT',
    "method" TEXT NOT NULL DEFAULT 'CASH',
    "description" TEXT,
    "saleId" TEXT,
    "expenseId" TEXT,
    "purchaseId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cash_transactions_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cash_transactions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cash_transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "dataJson" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "beforeJson" TEXT,
    "afterJson" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "vin" TEXT,
    "color" TEXT,
    "engineNo" TEXT,
    "mileageKm" INTEGER,
    "fuelType" TEXT NOT NULL DEFAULT 'PETROL',
    "vehicleType" TEXT NOT NULL DEFAULT 'CAR',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "vehicles_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "vehicles_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mechanics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "userId" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "specialty" TEXT,
    "hourlyRateAr" DECIMAL,
    "commissionPct" DECIMAL,
    "colorHex" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "mechanics_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mechanics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "mechanicId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUOTED',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "complaint" TEXT,
    "diagnosis" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "estimatedDeliveryAt" DATETIME,
    "completedAt" DATETIME,
    "deliveryAt" DATETIME,
    "laborCostAr" DECIMAL NOT NULL DEFAULT 0,
    "partsCostAr" DECIMAL NOT NULL DEFAULT 0,
    "discountAr" DECIMAL NOT NULL DEFAULT 0,
    "taxAr" DECIMAL NOT NULL DEFAULT 0,
    "totalAr" DECIMAL NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "amountPaidAr" DECIMAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "work_orders_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "work_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "work_orders_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "work_orders_mechanicId_fkey" FOREIGN KEY ("mechanicId") REFERENCES "mechanics" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "work_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "work_order_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workOrderId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PART',
    "description" TEXT NOT NULL,
    "productId" TEXT,
    "quantityAr" DECIMAL NOT NULL DEFAULT 1,
    "unitPriceAr" DECIMAL NOT NULL,
    "discountAr" DECIMAL NOT NULL DEFAULT 0,
    "taxAr" DECIMAL NOT NULL DEFAULT 0,
    "lineTotalAr" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "work_order_items_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "work_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "mechanicId" TEXT,
    "workOrderId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'REPAIR',
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" DATETIME NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "title" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "appointments_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "appointments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "appointments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "appointments_mechanicId_fkey" FOREIGN KEY ("mechanicId") REFERENCES "mechanics" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "appointments_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "appointments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "source" TEXT NOT NULL DEFAULT 'WALK_IN',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "valueAr" DECIMAL,
    "notes" TEXT,
    "assignedToId" TEXT,
    "nextFollowUpAt" DATETIME,
    "firstContactAt" DATETIME,
    "lastContactAt" DATETIME,
    "convertedCustomerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "leads_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "leads_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "leads_convertedCustomerId_fkey" FOREIGN KEY ("convertedCustomerId") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "interactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'NOTE',
    "subject" TEXT,
    "body" TEXT,
    "customerId" TEXT,
    "leadId" TEXT,
    "workOrderId" TEXT,
    "performedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "interactions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "interactions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "interactions_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "interactions_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "interactions_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "remindAt" DATETIME NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "customerId" TEXT,
    "leadId" TEXT,
    "vehicleId" TEXT,
    "workOrderId" TEXT,
    "invoiceId" TEXT,
    "assignedToId" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "reminders_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reminders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "reminders_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "reminders_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "reminders_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "reminders_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "reminders_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "docType" TEXT NOT NULL DEFAULT 'INVOICE',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "workOrderId" TEXT,
    "issueDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME,
    "validUntil" DATETIME,
    "subtotalAr" DECIMAL NOT NULL,
    "discountAr" DECIMAL NOT NULL DEFAULT 0,
    "taxAr" DECIMAL NOT NULL DEFAULT 0,
    "totalAr" DECIMAL NOT NULL,
    "amountPaidAr" DECIMAL NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "invoices_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "invoices_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "invoices_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PART',
    "description" TEXT NOT NULL,
    "productId" TEXT,
    "quantityAr" DECIMAL NOT NULL DEFAULT 1,
    "unitPriceAr" DECIMAL NOT NULL,
    "discountAr" DECIMAL NOT NULL DEFAULT 0,
    "taxAr" DECIMAL NOT NULL DEFAULT 0,
    "lineTotalAr" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invoice_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "stores_slug_key" ON "stores"("slug");

-- CreateIndex
CREATE INDEX "stores_name_idx" ON "stores"("name");

-- CreateIndex
CREATE INDEX "store_members_userId_idx" ON "store_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "store_members_storeId_userId_key" ON "store_members"("storeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "plans_name_key" ON "plans"("name");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_storeId_key" ON "subscriptions"("storeId");

-- CreateIndex
CREATE INDEX "subscriptions_planId_idx" ON "subscriptions"("planId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_storeId_name_key" ON "categories"("storeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "brands_storeId_name_key" ON "brands"("storeId", "name");

-- CreateIndex
CREATE INDEX "products_storeId_categoryId_idx" ON "products"("storeId", "categoryId");

-- CreateIndex
CREATE INDEX "products_storeId_brandId_idx" ON "products"("storeId", "brandId");

-- CreateIndex
CREATE INDEX "products_storeId_name_idx" ON "products"("storeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "products_storeId_slug_key" ON "products"("storeId", "slug");

-- CreateIndex
CREATE INDEX "product_variants_productId_idx" ON "product_variants"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_storeId_name_key" ON "warehouses"("storeId", "name");

-- CreateIndex
CREATE INDEX "stocks_storeId_idx" ON "stocks"("storeId");

-- CreateIndex
CREATE INDEX "stocks_productId_idx" ON "stocks"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "stocks_warehouseId_productId_variantId_key" ON "stocks"("warehouseId", "productId", "variantId");

-- CreateIndex
CREATE INDEX "stock_movements_storeId_idx" ON "stock_movements"("storeId");

-- CreateIndex
CREATE INDEX "stock_movements_productId_idx" ON "stock_movements"("productId");

-- CreateIndex
CREATE INDEX "stock_movements_warehouseId_idx" ON "stock_movements"("warehouseId");

-- CreateIndex
CREATE INDEX "stock_movements_createdAt_idx" ON "stock_movements"("createdAt");

-- CreateIndex
CREATE INDEX "suppliers_storeId_idx" ON "suppliers"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_storeId_name_key" ON "suppliers"("storeId", "name");

-- CreateIndex
CREATE INDEX "customers_storeId_idx" ON "customers"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_receiptNumber_key" ON "sales"("receiptNumber");

-- CreateIndex
CREATE INDEX "sales_storeId_idx" ON "sales"("storeId");

-- CreateIndex
CREATE INDEX "sales_customerId_idx" ON "sales"("customerId");

-- CreateIndex
CREATE INDEX "sales_createdAt_idx" ON "sales"("createdAt");

-- CreateIndex
CREATE INDEX "sales_status_idx" ON "sales"("status");

-- CreateIndex
CREATE INDEX "sale_items_saleId_idx" ON "sale_items"("saleId");

-- CreateIndex
CREATE INDEX "sale_items_productId_idx" ON "sale_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_referenceNo_key" ON "purchases"("referenceNo");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_saleId_key" ON "purchases"("saleId");

-- CreateIndex
CREATE INDEX "purchases_storeId_idx" ON "purchases"("storeId");

-- CreateIndex
CREATE INDEX "purchases_supplierId_idx" ON "purchases"("supplierId");

-- CreateIndex
CREATE INDEX "purchases_status_idx" ON "purchases"("status");

-- CreateIndex
CREATE INDEX "purchases_createdAt_idx" ON "purchases"("createdAt");

-- CreateIndex
CREATE INDEX "purchase_items_purchaseId_idx" ON "purchase_items"("purchaseId");

-- CreateIndex
CREATE INDEX "expenses_storeId_idx" ON "expenses"("storeId");

-- CreateIndex
CREATE INDEX "expenses_incurredAt_idx" ON "expenses"("incurredAt");

-- CreateIndex
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

-- CreateIndex
CREATE INDEX "cash_sessions_storeId_idx" ON "cash_sessions"("storeId");

-- CreateIndex
CREATE INDEX "cash_sessions_openedAt_idx" ON "cash_sessions"("openedAt");

-- CreateIndex
CREATE INDEX "cash_transactions_cashSessionId_idx" ON "cash_transactions"("cashSessionId");

-- CreateIndex
CREATE INDEX "cash_transactions_storeId_idx" ON "cash_transactions"("storeId");

-- CreateIndex
CREATE INDEX "cash_transactions_createdAt_idx" ON "cash_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_storeId_idx" ON "notifications"("storeId");

-- CreateIndex
CREATE INDEX "audit_logs_storeId_createdAt_idx" ON "audit_logs"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "vehicles_storeId_customerId_idx" ON "vehicles"("storeId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_storeId_plateNumber_key" ON "vehicles"("storeId", "plateNumber");

-- CreateIndex
CREATE INDEX "mechanics_storeId_idx" ON "mechanics"("storeId");

-- CreateIndex
CREATE INDEX "work_orders_storeId_status_idx" ON "work_orders"("storeId", "status");

-- CreateIndex
CREATE INDEX "work_orders_customerId_idx" ON "work_orders"("customerId");

-- CreateIndex
CREATE INDEX "work_orders_vehicleId_idx" ON "work_orders"("vehicleId");

-- CreateIndex
CREATE INDEX "work_orders_storeId_receivedAt_idx" ON "work_orders"("storeId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_storeId_orderNumber_key" ON "work_orders"("storeId", "orderNumber");

-- CreateIndex
CREATE INDEX "work_order_items_workOrderId_idx" ON "work_order_items"("workOrderId");

-- CreateIndex
CREATE INDEX "appointments_storeId_scheduledAt_idx" ON "appointments"("storeId", "scheduledAt");

-- CreateIndex
CREATE INDEX "appointments_storeId_mechanicId_idx" ON "appointments"("storeId", "mechanicId");

-- CreateIndex
CREATE INDEX "appointments_storeId_status_idx" ON "appointments"("storeId", "status");

-- CreateIndex
CREATE INDEX "leads_storeId_status_idx" ON "leads"("storeId", "status");

-- CreateIndex
CREATE INDEX "leads_storeId_assignedToId_idx" ON "leads"("storeId", "assignedToId");

-- CreateIndex
CREATE INDEX "interactions_storeId_createdAt_idx" ON "interactions"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "interactions_customerId_idx" ON "interactions"("customerId");

-- CreateIndex
CREATE INDEX "interactions_leadId_idx" ON "interactions"("leadId");

-- CreateIndex
CREATE INDEX "reminders_storeId_status_remindAt_idx" ON "reminders"("storeId", "status", "remindAt");

-- CreateIndex
CREATE INDEX "reminders_storeId_type_idx" ON "reminders"("storeId", "type");

-- CreateIndex
CREATE INDEX "reminders_customerId_idx" ON "reminders"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_workOrderId_key" ON "invoices"("workOrderId");

-- CreateIndex
CREATE INDEX "invoices_storeId_docType_status_idx" ON "invoices"("storeId", "docType", "status");

-- CreateIndex
CREATE INDEX "invoices_customerId_idx" ON "invoices"("customerId");

-- CreateIndex
CREATE INDEX "invoices_storeId_issueDate_idx" ON "invoices"("storeId", "issueDate");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_storeId_number_key" ON "invoices"("storeId", "number");

-- CreateIndex
CREATE INDEX "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");
