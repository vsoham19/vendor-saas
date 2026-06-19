-- Migration: Add WhatsApp reminder tracking flag to appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS whatsapp_reminder_sent BOOLEAN DEFAULT false;
