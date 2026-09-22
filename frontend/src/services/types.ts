export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paged<T> {
  data: T[];
  pagination: Pagination;
}

export interface Single<T> {
  data: T[];
}

export type VehicleType = 'CAR' | 'MOTORCYCLE' | 'TRUCK' | 'VAN' | 'TAXI' | 'BUS' | 'OTHER';
export type FuelType = 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID' | 'LPG' | 'OTHER';
export type WorkOrderStatus = 'QUOTED' | 'IN_PROGRESS' | 'WAITING_PART' | 'PAUSED' | 'COMPLETED' | 'COLLECTED' | 'CANCELLED';
export type WorkOrderPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type LineItemType = 'LABOR' | 'PART' | 'OTHER';
export type AppointmentType = 'REPAIR' | 'MAINTENANCE' | 'INSPECTION' | 'DIAGNOSIS' | 'PICKUP' | 'OTHER';
export type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type LeadSource = 'REFERRAL' | 'WALK_IN' | 'ONLINE' | 'PHONE' | 'SOCIAL_MEDIA' | 'OTHER';
export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'FOLLOW_UP' | 'WON' | 'LOST';
export type InteractionType = 'CALL' | 'EMAIL' | 'WHATSAPP' | 'SMS' | 'VISIT' | 'MEETING' | 'NOTE';
export type ReminderType = 'SERVICE_DUE' | 'FOLLOW_UP' | 'PAYMENT' | 'APPOINTMENT' | 'OTHER';
export type ReminderStatus = 'PENDING' | 'SENT' | 'DONE' | 'CANCELLED';
export type InvoiceDocType = 'QUOTE' | 'INVOICE';
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'ISSUED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'PARTIALLY_PAID' | 'CANCELLED' | 'REFUNDED';
export type PaymentMethod = 'CASH' | 'MOBILE_MONEY' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';

export interface MechanicRef {
  id: string;
  fullName: string;
  colorHex?: string | null;
}

export interface CustomerRef {
  id: string;
  fullName: string;
  phone?: string | null;
}

export interface VehicleRef {
  id: string;
  plateNumber: string;
  label?: string;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  gender: string | null;
  isVip: boolean;
  loyaltyPoints: number;
  debtAr: number;
  notes: string | null;
  vehiclesCount: number;
  workOrdersCount: number;
  invoicesCount: number;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  make: string | null;
  model: string | null;
  label: string;
  year: number | null;
  vin: string | null;
  color: string | null;
  engineNo: string | null;
  mileageKm: number | null;
  fuelType: FuelType;
  vehicleType: VehicleType;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  customer: CustomerRef | null;
  workOrdersCount?: number;
}

export interface WorkOrderListItem {
  id: string;
  orderNumber: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  complaint: string | null;
  receivedAt: string;
  estimatedDeliveryAt: string | null;
  laborCostAr: number;
  partsCostAr: number;
  totalAr: number;
  paymentStatus: PaymentStatus;
  itemsCount: number;
  customer: CustomerRef | null;
  vehicle: VehicleRef | null;
  mechanic: MechanicRef | null;
}

export interface WorkOrderItem {
  id: string;
  type: LineItemType;
  description: string;
  productId: string | null;
  product: { id: string; name: string; sku: string | null } | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  lineTotal: number;
}

export interface AppointmentListItem {
  id: string;
  type: AppointmentType;
  status: AppointmentStatus;
  scheduledAt: string;
  durationMin: number;
  title: string | null;
  notes: string | null;
  customer: CustomerRef | null;
  vehicle: VehicleRef | null;
  mechanic: MechanicRef | null;
  workOrder: { id: string; orderNumber: string; status: WorkOrderStatus } | null;
}

export interface WorkOrderDetail extends Omit<WorkOrderListItem, 'itemsCount'> {
  diagnosis: string | null;
  completedAt: string | null;
  discountAr: number;
  taxAr: number;
  paymentMethod: PaymentMethod | null;
  amountPaidAr: number;
  notes: string | null;
  createdAt: string;
  items: WorkOrderItem[];
  appointments?: AppointmentListItem[];
  invoice?: InvoiceListItem | null;
  interactions?: Interaction[];
  reminders?: Reminder[];
}

export interface Mechanic {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  specialty: string | null;
  hourlyRateAr: number | null;
  commissionPct: number | null;
  colorHex: string | null;
  isActive: boolean;
  workOrdersCount: number;
  appointmentsCount: number;
  activeJobs: { id: string; orderNumber: string; status: WorkOrderStatus; completedAt: string | null }[];
}

export interface Lead {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  source: LeadSource;
  status: LeadStatus;
  valueAr: number | null;
  notes: string | null;
  nextFollowUpAt: string | null;
  firstContactAt: string | null;
  lastContactAt: string | null;
  createdAt: string;
  assignedTo: MechanicRef | null;
  convertedCustomer: { id: string; firstName: string; lastName: string } | null;
}

export interface Interaction {
  id: string;
  type: InteractionType;
  subject: string | null;
  body: string | null;
  createdAt: string;
  performedBy: { id: string; fullName: string } | null;
  customer: CustomerRef | null;
  lead: { id: string; fullName: string } | null;
  workOrder: { id: string; orderNumber: string } | null;
}

export interface Reminder {
  id: string;
  type: ReminderType;
  status: ReminderStatus;
  remindAt: string;
  title: string;
  message: string | null;
  completedAt: string | null;
  createdAt: string;
  customer: CustomerRef | null;
  lead: { id: string; fullName: string; phone?: string | null } | null;
  vehicle: VehicleRef | null;
  workOrder: { id: string; orderNumber: string } | null;
  invoice: { id: string; number: string } | null;
  assignedTo?: { id: string; fullName: string } | null;
}

export interface InvoiceListItem {
  id: string;
  number: string;
  docType: InvoiceDocType;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string | null;
  subtotalAr: number;
  discountAr: number;
  taxAr: number;
  totalAr: number;
  amountPaidAr: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  itemsCount: number;
  customer: CustomerRef | null;
  vehicle: VehicleRef | null;
  workOrder: { id: string; orderNumber: string } | null;
}

export interface InvoiceItem {
  id: string;
  type: LineItemType;
  description: string;
  productId: string | null;
  product: { id: string; name: string; sku: string | null } | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  lineTotal: number;
}

export interface InvoiceDetail extends Omit<InvoiceListItem, 'itemsCount'> {
  validUntil: string | null;
  notes: string | null;
  createdAt: string;
  items: InvoiceItem[];
  reminders?: Reminder[];
}

export interface CustomerDetail extends Customer {
  outstandingAr: number;
  counts: { workOrders: number; invoices: number; vehicles: number };
  vehicles: Vehicle[];
  workOrders: WorkOrderListItem[];
  invoices: InvoiceListItem[];
  interactions: Interaction[];
  reminders: Reminder[];
}

export interface VehicleDetail extends Vehicle {
  workOrders: WorkOrderListItem[];
  appointments: AppointmentListItem[];
}

export interface LeadDetail extends Lead {
  interactions: Interaction[];
  reminders: Reminder[];
}

export interface GarageStats {
  counts: {
    vehicles: number;
    customers: number;
    activeWorkOrders: number;
    todayWorkOrders: number;
    completedToday: number;
    todayAppointments: number;
    leads: number;
    openLeads: number;
    mechanics: number;
    pendingReminders: number;
  };
  finance: {
    outstandingInvoices: number;
    outstandingAr: number;
    totalRevenueAr: number;
    revenueTodayAr: number;
  };
  statusBreakdown: Partial<Record<WorkOrderStatus, number>>;
  recentWorkOrders: {
    id: string;
    orderNumber: string;
    status: WorkOrderStatus;
    priority: WorkOrderPriority;
    totalAr: number;
    receivedAt: string;
    customer: CustomerRef | null;
    vehicle: VehicleRef | null;
  }[];
  upcomingAppointments: AppointmentListItem[];
  reminders: Reminder[];
}

export interface WorkOrderItemInput {
  type?: LineItemType;
  description: string;
  productId?: string | null;
  quantity?: number;
  unitPrice?: number;
  discount?: number;
  tax?: number;
}

export interface InvoiceItemInput {
  type?: LineItemType;
  description: string;
  productId?: string | null;
  quantity?: number;
  unitPrice?: number;
  discount?: number;
  tax?: number;
}

export interface LeadFunnel {
  total: number;
  stats: Record<LeadStatus, number>;
}
