/**
 * WhatsApp helpers.
 *
 * We intentionally use wa.me deep links instead of sending through a server:
 * the boutique owner reviews and sends the message from their own WhatsApp
 * number, which is safer and works without any bridge infrastructure.
 */

/** Normalize an Indian phone number into wa.me format (91XXXXXXXXXX). */
export function formatPhoneNumber(phone: string): string {
  let cleaned = (phone || '').replace(/[^0-9]/g, '');

  if (cleaned.startsWith('00')) {
    cleaned = cleaned.slice(2);
  }
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  if (cleaned.length === 10) {
    cleaned = `91${cleaned}`;
  }

  return cleaned;
}

/** Build a WhatsApp click-to-chat URL. Returns an empty string for invalid numbers. */
export function buildWhatsAppLink(phone: string, message: string): string {
  const normalized = formatPhoneNumber(phone);
  if (!normalized) return '';
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function buildPaymentReminderMessage({
  customerName,
  amount,
  orderNumber
}: {
  customerName: string;
  amount: number;
  orderNumber?: string | null;
}): string {
  const orderPart = orderNumber ? ` for order ${orderNumber}` : '';
  return `Namaste ${customerName}, this is a gentle reminder that ₹${amount.toLocaleString('en-IN')} is pending${orderPart}. Kindly settle at your convenience. Thank you!`;
}

export function buildOrderStatusMessage({
  customerName,
  orderNumber,
  description,
  status
}: {
  customerName: string;
  orderNumber: string;
  description?: string | null;
  status: string;
}): string {
  const friendlyStatusMap: Record<string, string> = {
    pending: 'Pending Receipt',
    in_progress: 'In Production',
    ready: 'Ready for Trial',
    delivered: 'Delivered & Closed',
    cancelled: 'Cancelled'
  };

  const friendlyStatus = friendlyStatusMap[status] || status;
  const itemDesc = description ? ` (${description})` : '';
  return `Hello ${customerName}, your order ${orderNumber}${itemDesc} is now *${friendlyStatus}*. Thank you!`;
}

export function buildPaymentReceiptMessage({
  customerName,
  amount,
  paymentMethod,
  orderNumber,
  outstandingBalance
}: {
  customerName: string;
  amount: number;
  paymentMethod: string;
  orderNumber: string;
  outstandingBalance: number;
}): string {
  return `Dear ${customerName}, we have received your payment of ₹${amount.toLocaleString('en-IN')} via ${paymentMethod || 'UPI'} for order ${orderNumber}. Outstanding balance: ₹${outstandingBalance.toLocaleString('en-IN')}. Thank you!`;
}

export function buildAppointmentMessage({
  customerName,
  title,
  date,
  time,
  status
}: {
  customerName: string;
  title: string;
  date: string;
  time?: string | null;
  status?: string;
}): string {
  const when = `${date}${time ? ` at ${time}` : ''}`;
  if (status === 'scheduled') {
    return `Namaste ${customerName}, your appointment '${title}' is confirmed for ${when}. See you at the studio!`;
  }
  return `Namaste ${customerName}, this is a reminder for your appointment '${title}' on ${when}. See you at the studio!`;
}
