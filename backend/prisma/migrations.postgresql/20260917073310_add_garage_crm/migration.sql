-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('CAR', 'MOTORCYCLE', 'TRUCK', 'VAN', 'TAXI', 'BUS', 'OTHER');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'LPG', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('QUOTED', 'IN_PROGRESS', 'WAITING_PART', 'PAUSED', 'COMPLETED', 'COLLECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkOrderPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "LineItemType" AS ENUM ('LABOR', 'PART', 'OTHER');

-- CreateEnum
CREATE TYPE "AppointmentType" AS ENUM ('REPAIR', 'MAINTENANCE', 'INSPECTION', 'DIAGNOSIS', 'PICKUP', 'OTHER');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('REFERRAL', 'WALK_IN', 'ONLINE', 'PHONE', 'SOCIAL_MEDIA', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'FOLLOW_UP', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('CALL', 'EMAIL', 'WHATSAPP', 'SMS', 'VISIT', 'MEETING', 'NOTE');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('SERVICE_DUE', 'FOLLOW_UP', 'PAYMENT', 'APPOINTMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceDocType" AS ENUM ('QUOTE', 'INVOICE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED');

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
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
    "fuelType" "FuelType" NOT NULL DEFAULT 'PETROL',
    "vehicleType" "VehicleType" NOT NULL DEFAULT 'CAR',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mechanics" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "specialty" TEXT,
    "hourlyRateAr" DECIMAL(12,2),
    "commissionPct" DECIMAL(5,2),
    "colorHex" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mechanics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "mechanicId" TEXT,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'QUOTED',
    "priority" "WorkOrderPriority" NOT NULL DEFAULT 'NORMAL',
    "complaint" TEXT,
    "diagnosis" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "estimatedDeliveryAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "deliveryAt" TIMESTAMP(3),
    "laborCostAr" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "partsCostAr" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAr" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAr" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAr" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "PaymentMethod",
    "amountPaidAr" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_items" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "type" "LineItemType" NOT NULL DEFAULT 'PART',
    "description" TEXT NOT NULL,
    "productId" TEXT,
    "quantityAr" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "unitPriceAr" DECIMAL(12,2) NOT NULL,
    "discountAr" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAr" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineTotalAr" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "mechanicId" TEXT,
    "workOrderId" TEXT,
    "type" "AppointmentType" NOT NULL DEFAULT 'REPAIR',
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "title" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "source" "LeadSource" NOT NULL DEFAULT 'WALK_IN',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "valueAr" DECIMAL(12,2),
    "notes" TEXT,
    "assignedToId" TEXT,
    "nextFollowUpAt" TIMESTAMP(3),
    "firstContactAt" TIMESTAMP(3),
    "lastContactAt" TIMESTAMP(3),
    "convertedCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interactions" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "type" "InteractionType" NOT NULL DEFAULT 'NOTE',
    "subject" TEXT,
    "body" TEXT,
    "customerId" TEXT,
    "leadId" TEXT,
    "workOrderId" TEXT,
    "performedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "type" "ReminderType" NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "remindAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "customerId" TEXT,
    "leadId" TEXT,
    "vehicleId" TEXT,
    "workOrderId" TEXT,
    "invoiceId" TEXT,
    "assignedToId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "docType" "InvoiceDocType" NOT NULL DEFAULT 'INVOICE',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "workOrderId" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "subtotalAr" DECIMAL(12,2) NOT NULL,
    "discountAr" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAr" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAr" DECIMAL(12,2) NOT NULL,
    "amountPaidAr" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "PaymentMethod",
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "type" "LineItemType" NOT NULL DEFAULT 'PART',
    "description" TEXT NOT NULL,
    "productId" TEXT,
    "quantityAr" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "unitPriceAr" DECIMAL(12,2) NOT NULL,
    "discountAr" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAr" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineTotalAr" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

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

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mechanics" ADD CONSTRAINT "mechanics_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mechanics" ADD CONSTRAINT "mechanics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_mechanicId_fkey" FOREIGN KEY ("mechanicId") REFERENCES "mechanics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_mechanicId_fkey" FOREIGN KEY ("mechanicId") REFERENCES "mechanics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_convertedCustomerId_fkey" FOREIGN KEY ("convertedCustomerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
