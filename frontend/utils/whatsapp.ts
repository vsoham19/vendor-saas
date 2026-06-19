const BRIDGE_URL = process.env.WHATSAPP_BRIDGE_URL || '';
const BRIDGE_API_KEY = process.env.WHATSAPP_BRIDGE_API_KEY || '';

/**
 * Format a phone number to standard international structure without spaces, hyphens or plus.
 * If 10 digits are provided, prefixes with the country code '91' (India).
 */
export function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

/**
 * Dispatches a raw text message to the WhatsApp bridge API.
 */
export async function sendWhatsAppMessage(phone: string, text: string): Promise<boolean> {
  if (!BRIDGE_URL || !BRIDGE_API_KEY) {
    console.warn('WhatsApp API bridge details not configured. Set WHATSAPP_BRIDGE_URL and WHATSAPP_BRIDGE_API_KEY.');
    return false;
  }

  const cleanedPhone = formatPhoneNumber(phone);
  if (!cleanedPhone) {
    console.error('Invalid phone number provided:', phone);
    return false;
  }

  try {
    const response = await fetch(`${BRIDGE_URL.replace(/\/+$/, '')}/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRIDGE_API_KEY}`
      },
      body: JSON.stringify({
        phone: cleanedPhone,
        message: text
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`WhatsApp Bridge API returned error status ${response.status}: ${errorText}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Failed to communicate with WhatsApp bridge:', err);
    return false;
  }
}

/**
 * Format and send an appointment reminder.
 */
export async function sendAppointmentReminder(
  customerName: string,
  title: string,
  dateStr: string,
  timeStr: string,
  phone: string
): Promise<boolean> {
  const message = `Namaste ${customerName}, this is a reminder for your fitting/trial appointment '${title}' at Sanskriti Couture scheduled on ${dateStr}${timeStr ? ` at ${timeStr}` : ''}. We look forward to seeing you!`;
  return sendWhatsAppMessage(phone, message);
}

/**
 * Format and send an order status update.
 */
export async function sendOrderStatusUpdate(
  customerName: string,
  orderNumber: string,
  description: string | null,
  status: string,
  phone: string
): Promise<boolean> {
  // Map internal status tags to friendly customer labels
  const friendlyStatusMap: Record<string, string> = {
    pending: 'Pending Receipt',
    in_progress: 'In Production',
    ready: 'Ready for Trial 🎉',
    delivered: 'Delivered & Closed 👗',
    cancelled: 'Cancelled'
  };
  
  const friendlyStatus = friendlyStatusMap[status] || status;
  const itemDesc = description ? ` (${description})` : '';
  const message = `Hello ${customerName}, your order ${orderNumber}${itemDesc} status is now updated to: *${friendlyStatus}*. Thank you!`;
  return sendWhatsAppMessage(phone, message);
}

/**
 * Format and send a payment confirmation receipt.
 */
export async function sendPaymentReceipt(
  customerName: string,
  amount: number,
  paymentMethod: string,
  orderNumber: string,
  outstandingBalance: number,
  phone: string
): Promise<boolean> {
  const message = `Dear ${customerName}, we have received your payment of ₹${amount.toLocaleString('en-IN')} via ${paymentMethod || 'UPI'} for order ${orderNumber}. Outstanding balance: ₹${outstandingBalance.toLocaleString('en-IN')}. Thank you!`;
  return sendWhatsAppMessage(phone, message);
}
