import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendAppointmentReminder } from '@/utils/whatsapp';

export async function GET(request: Request) {
  // This job runs without a user session and needs to cross tenant boundaries,
  // so it must use the service role client and be protected by CRON_SECRET.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'Server Misconfigured', message: 'CRON_SECRET is not configured.' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Server Misconfigured', message: 'Supabase service credentials are not configured.' },
      { status: 500 }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const now = new Date();
    // Query appointments occurring in the next 24 hours
    const targetTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    const { data: appointments, error } = await supabaseAdmin
      .from('appointments')
      .select('*, customers(name, phone)')
      .eq('status', 'scheduled')
      .eq('whatsapp_reminder_sent', false)
      .lte('scheduled_date', targetTime.toISOString())
      .gt('scheduled_date', now.toISOString());

    if (error) throw error;

    if (!appointments || appointments.length === 0) {
      return NextResponse.json({ message: 'No upcoming appointments found to remind.' }, { status: 200 });
    }

    const results = [];
    for (const appt of appointments) {
      // TypeScript type assertion for nested customers relationship
      const customer = appt.customers as any;
      if (customer && customer.phone) {
        const dateObj = new Date(appt.scheduled_date);
        
        // Format to friendly Indian standard time representations
        const dateStr = dateObj.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' });
        const timeStr = dateObj.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', timeStyle: 'short' });

        const success = await sendAppointmentReminder(
          customer.name,
          appt.title,
          dateStr,
          timeStr,
          customer.phone
        );

        if (success) {
          // Update flag to prevent duplicate dispatches
          await supabaseAdmin
            .from('appointments')
            .update({ whatsapp_reminder_sent: true })
            .eq('id', appt.id);
          
          results.push({ appointment_id: appt.id, customer: customer.name, status: 'sent' });
        } else {
          results.push({ appointment_id: appt.id, customer: customer.name, status: 'failed_to_send' });
        }
      } else {
        results.push({ appointment_id: appt.id, status: 'skipped_no_phone' });
      }
    }

    return NextResponse.json({ message: 'Reminders processed successfully.', results }, { status: 200 });
  } catch (err: any) {
    console.error('Error running appointments reminder cron job:', err);
    return NextResponse.json({ error: 'Internal Server Error', message: err.message }, { status: 500 });
  }
}
