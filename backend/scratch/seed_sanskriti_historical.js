/**
 * Backfill realistic synthetic activity for Sanskriti Couture
 * from 1 July 2026 through 14 November 2026.
 *
 * Usage:
 *   node scratch/seed_sanskriti_historical.js
 *   node scratch/seed_sanskriti_historical.js --reset   (re-seed the same range)
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const OWNER_EMAIL = 'sanskriti@gmail.com';
const RANGE_START = '2026-07-01';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const ts = (date, time = '11:00:00') => new Date(`${date}T${time}+05:30`).toISOString();
const shiftDate = (date, days) => {
  const shifted = new Date(`${date}T12:00:00+05:30`);
  shifted.setDate(shifted.getDate() + days);
  return shifted.toISOString().slice(0, 10);
};

const newCustomers = [
  { name: 'Kavya Trivedi', phone: '9824456710', email: 'kavya.trivedi@example.com', address: 'B-12, Athwa Lines, Surat', createdAt: '2026-07-01' },
  { name: 'Ishita Joshi', phone: '9737210456', email: 'ishita.joshi@example.com', address: '7, Vesu Main Road, Surat', createdAt: '2026-07-12' },
  { name: 'Rhea Kapadia', phone: '9904117823', email: 'rhea.kapadia@example.com', address: '304, Piplod Heights, Surat', createdAt: '2026-07-24' },
  { name: 'Nandini Rao', phone: '9879503214', email: 'nandini.rao@example.com', address: '22, Adajan Gam, Surat', createdAt: '2026-07-31' },
  { name: 'Tanvi Deshmukh', phone: '9825701436', email: 'tanvi.deshmukh@example.com', address: 'B-9, Pal RTO, Surat', createdAt: '2026-08-09' },
  { name: 'Aisha Khan', phone: '9913765240', email: 'aisha.khan@example.com', address: '15, City Light Road, Surat', createdAt: '2026-08-17' },
  { name: 'Devika Menon', phone: '9843556677', email: 'devika.menon@example.com', address: '8, Dumas Road, Surat', createdAt: '2026-08-25' },
  { name: 'Sanya Bhatia', phone: '9769881234', email: 'sanya.bhatia@example.com', address: 'C-501, Althan, Surat', createdAt: '2026-09-02' }
];

const orderPlans = [
  {
    key: 'jul-kavya-bridal',
    customer: 'Kavya Trivedi',
    created: '2026-07-02',
    delivery: '2026-07-18',
    status: 'delivered',
    description: 'Bridal Red Banarasi Lehenga',
    notes: 'Gold zari border with hand-finished latkans.',
    items: [
      { name: 'Banarasi Silk Bridal Lehenga', price: 62000, qty: 1, description: 'Crimson red with gold zari' },
      { name: 'Custom Bridal Blouse', price: 8500, qty: 1, description: 'Elbow-sleeve padded blouse' }
    ],
    payments: [
      { date: '2026-07-02', amount: 25000, mode: 'UPI', note: 'Bridal advance' },
      { date: '2026-07-17', amount: 45500, mode: 'Cash', note: 'Balance before delivery' }
    ]
  },
  {
    key: 'jul-anjali-anarkali',
    customer: 'Anjali Mehta',
    created: '2026-07-05',
    delivery: '2026-07-20',
    status: 'delivered',
    description: 'Festive Anarkali Set',
    notes: 'Soft net with gota patti detailing.',
    items: [
      { name: 'Festive Anarkali Kurta', price: 18500, qty: 1, description: 'Floor-length anarkali' },
      { name: 'Embroidered Dupatta', price: 4500, qty: 1, description: 'Net dupatta with gota border' }
    ],
    payments: [
      { date: '2026-07-05', amount: 10000, mode: 'UPI', note: 'Order advance' },
      { date: '2026-07-19', amount: 13000, mode: 'Card', note: 'Balance payment' }
    ]
  },
  {
    key: 'jul-pooja-blouse',
    customer: 'Pooja Patel',
    created: '2026-07-09',
    delivery: '2026-07-24',
    status: 'delivered',
    description: 'Saree Blouse - Reception',
    notes: 'Deep back with dori tassels.',
    items: [
      { name: 'Hand-embroidered Silk Blouse', price: 9500, qty: 1, description: 'Reception blouse with zardosi' }
    ],
    payments: [
      { date: '2026-07-09', amount: 9500, mode: 'UPI', note: 'Full payment' }
    ]
  },
  {
    key: 'jul-ishita-engagement',
    customer: 'Ishita Joshi',
    created: '2026-07-13',
    delivery: '2026-08-02',
    status: 'delivered',
    description: 'Engagement Lehenga in Blush Pink',
    notes: 'Lightweight lehenga for a daytime engagement.',
    items: [
      { name: 'Blush Pink Engagement Lehenga', price: 54000, qty: 1, description: 'Organza with pearl work' },
      { name: 'Embroidered Dupatta', price: 7500, qty: 1, description: 'Pearl and sequin border' }
    ],
    payments: [
      { date: '2026-07-13', amount: 20000, mode: 'Bank Transfer', note: 'Engagement advance' },
      { date: '2026-08-01', amount: 41500, mode: 'UPI', note: 'Balance before delivery' }
    ]
  },
  {
    key: 'jul-shruti-kanjivaram',
    customer: 'Shruti Iyer',
    created: '2026-07-17',
    delivery: '2026-07-30',
    status: 'delivered',
    description: 'Kanjivaram Saree with Zari Border',
    notes: 'Sourced from Kanchipuram, fall and pico completed.',
    items: [
      { name: 'Kanjivaram Silk Saree', price: 27500, qty: 1, description: 'Pure silk with temple border' }
    ],
    payments: [
      { date: '2026-07-17', amount: 27500, mode: 'Card', note: 'Full payment' }
    ]
  },
  {
    key: 'jul-deepika-cancelled',
    customer: 'Deepika Rao',
    created: '2026-07-21',
    delivery: '2026-07-31',
    status: 'cancelled',
    description: 'Reception Gown - Emerald',
    notes: 'Client cancelled after a family date change.',
    items: [
      { name: 'Emerald Reception Gown', price: 38000, qty: 1, description: 'Velvet gown with cape sleeves' }
    ],
    payments: []
  },
  {
    key: 'jul-rhea-twins',
    customer: 'Rhea Kapadia',
    created: '2026-07-25',
    delivery: '2026-08-10',
    status: 'delivered',
    description: 'Twin Birthday Lehengas (Mother & Daughter)',
    notes: 'Matching mother-daughter set in pastel ivory.',
    items: [
      { name: 'Adult Birthday Lehenga', price: 42000, qty: 1, description: 'Ivory chikankari lehenga' },
      { name: 'Kids Birthday Lehenga', price: 18000, qty: 1, description: 'Matching kids lehenga' }
    ],
    payments: [
      { date: '2026-07-25', amount: 20000, mode: 'UPI', note: 'Order advance' },
      { date: '2026-08-09', amount: 40000, mode: 'Cash', note: 'Balance before delivery' }
    ]
  },
  {
    key: 'jul-ritu-blouses',
    customer: 'Ritu Verma',
    created: '2026-07-29',
    delivery: '2026-08-12',
    status: 'delivered',
    description: 'Office Wear Blouse Set (3 pcs)',
    notes: 'Everyday cotton blouses with piping finish.',
    items: [
      { name: 'Cotton Blouse - Ivory', price: 3800, qty: 1, description: 'Round neck, short sleeve' },
      { name: 'Cotton Blouse - Grey', price: 3800, qty: 1, description: 'V neck, three-quarter sleeve' },
      { name: 'Cotton Blouse - Navy', price: 3800, qty: 1, description: 'Mandarin collar' }
    ],
    payments: [
      { date: '2026-08-12', amount: 11400, mode: 'UPI', note: 'Full payment on delivery' }
    ]
  },
  {
    key: 'aug-nandini-mehendi',
    customer: 'Nandini Rao',
    created: '2026-08-02',
    delivery: '2026-08-20',
    status: 'delivered',
    description: 'Mehendi Lehenga - Mustard Yellow',
    notes: 'Mirror work with a contrast green dupatta.',
    items: [
      { name: 'Mustard Mehendi Lehenga', price: 32000, qty: 1, description: 'Georgette with mirror work' },
      { name: 'Contrast Green Dupatta', price: 4500, qty: 1, description: 'Bandhani print dupatta' }
    ],
    payments: [
      { date: '2026-08-02', amount: 15000, mode: 'UPI', note: 'Order advance' },
      { date: '2026-08-19', amount: 21500, mode: 'UPI', note: 'Balance before delivery' }
    ]
  },
  {
    key: 'aug-sneha-saree',
    customer: 'Sneha Gupta',
    created: '2026-08-06',
    delivery: '2026-08-19',
    status: 'delivered',
    description: 'Sangeet Saree - Wine',
    notes: 'Pre-stitched saree with belt.',
    items: [
      { name: 'Wine Georgette Saree', price: 15500, qty: 1, description: 'Pre-draped with sequin work' }
    ],
    payments: [
      { date: '2026-08-06', amount: 15500, mode: 'Card', note: 'Full payment' }
    ]
  },
  {
    key: 'aug-tanvi-bridal',
    customer: 'Tanvi Deshmukh',
    created: '2026-08-10',
    delivery: '2026-09-05',
    status: 'delivered',
    description: 'Bridal Lehenga - Ivory & Gold',
    notes: 'Three-piece bridal set with custom veil.',
    items: [
      { name: 'Ivory & Gold Bridal Lehenga', price: 78000, qty: 1, description: 'Hand-embroidered zardosi' },
      { name: 'Bridal Veil', price: 12000, qty: 1, description: 'Gold tissue veil with scallop border' }
    ],
    payments: [
      { date: '2026-08-10', amount: 30000, mode: 'Bank Transfer', note: 'Bridal booking advance' },
      { date: '2026-08-24', amount: 30000, mode: 'UPI', note: 'Second installment' },
      { date: '2026-09-04', amount: 30000, mode: 'Cash', note: 'Final balance' }
    ]
  },
  {
    key: 'aug-priya-sapphire',
    customer: 'Priya Sharma',
    created: '2026-08-14',
    delivery: '2026-08-31',
    status: 'delivered',
    description: 'Reception Lehenga - Sapphire Blue',
    notes: 'Slim-fit reception lehenga with corset blouse.',
    items: [
      { name: 'Sapphire Blue Reception Lehenga', price: 48000, qty: 1, description: 'Raw silk with crystal work' }
    ],
    payments: [
      { date: '2026-08-14', amount: 20000, mode: 'UPI', note: 'Order advance' },
      { date: '2026-08-30', amount: 28000, mode: 'UPI', note: 'Balance before delivery' }
    ]
  },
  {
    key: 'aug-aisha-kurta',
    customer: 'Aisha Khan',
    created: '2026-08-18',
    delivery: '2026-08-28',
    status: 'delivered',
    description: 'Modal Silk Kurta Set',
    notes: 'Comfort-fit festive kurta with palazzo.',
    items: [
      { name: 'Modal Silk Kurta', price: 6500, qty: 1, description: 'Block print with mirror neckline' },
      { name: 'Modal Silk Palazzo', price: 3200, qty: 1, description: 'Elasticated waist' }
    ],
    payments: [
      { date: '2026-08-18', amount: 9700, mode: 'Cash', note: 'Full payment' }
    ]
  },
  {
    key: 'aug-meera-blouse',
    customer: 'Meera Sen',
    created: '2026-08-22',
    delivery: '2026-09-03',
    status: 'delivered',
    description: 'Festive Saree Blouse - Gold Tissue',
    notes: 'Gold tissue blouse with piping and back tie.',
    items: [
      { name: 'Gold Tissue Saree Blouse', price: 12500, qty: 1, description: 'Festive blouse with piping' }
    ],
    payments: [
      { date: '2026-08-22', amount: 6000, mode: 'UPI', note: 'Order advance' },
      { date: '2026-09-02', amount: 6500, mode: 'UPI', note: 'Balance before delivery' }
    ]
  },
  {
    key: 'aug-devika-lavender',
    customer: 'Devika Menon',
    created: '2026-08-26',
    delivery: '2026-09-12',
    status: 'delivered',
    description: 'Wedding Guest Lehenga - Lavender',
    notes: 'Soft lavender lehenga for a close family wedding.',
    items: [
      { name: 'Lavender Wedding Guest Lehenga', price: 36000, qty: 1, description: 'Tulle with thread embroidery' },
      { name: 'Embroidered Dupatta', price: 5000, qty: 1, description: 'Butterfly print dupatta' }
    ],
    payments: [
      { date: '2026-08-26', amount: 15000, mode: 'UPI', note: 'Order advance' },
      { date: '2026-09-11', amount: 26000, mode: 'Card', note: 'Balance before delivery' }
    ]
  },
  {
    key: 'aug-neha-blouse',
    customer: 'Neha Nair',
    created: '2026-08-30',
    delivery: '2026-09-10',
    status: 'delivered',
    description: 'Designer Blouse - Pearl Work',
    notes: 'Pearl-embellished blouse for a reception.',
    items: [
      { name: 'Pearl Work Designer Blouse', price: 11000, qty: 1, description: 'Pearl and bead embroidery' }
    ],
    payments: [
      { date: '2026-09-10', amount: 11000, mode: 'UPI', note: 'Full payment on delivery' }
    ]
  },
  {
    key: 'sep-sanya-bridal',
    customer: 'Sanya Bhatia',
    created: '2026-09-03',
    delivery: '2026-09-28',
    status: 'delivered',
    description: 'Bridal Lehenga - Deep Maroon',
    notes: 'Traditional bridal set with heavy zardosi.',
    items: [
      { name: 'Deep Maroon Bridal Lehenga', price: 85000, qty: 1, description: 'Velvet with gold zardosi' },
      { name: 'Bridal Dupatta', price: 9500, qty: 1, description: 'Organza with scallop border' }
    ],
    payments: [
      { date: '2026-09-03', amount: 35000, mode: 'Bank Transfer', note: 'Bridal booking advance' },
      { date: '2026-09-27', amount: 59500, mode: 'UPI', note: 'Balance before delivery' }
    ]
  },
  {
    key: 'sep-kiran-kurta',
    customer: 'Kiran Desai',
    created: '2026-09-07',
    delivery: '2026-09-15',
    status: 'delivered',
    description: 'Kurta Set - Festive',
    notes: 'Festive kurta with tonal embroidery.',
    items: [
      { name: 'Embroidered Festive Kurta', price: 7800, qty: 1, description: 'Silk blend with thread work' },
      { name: 'Silk Churidar', price: 2600, qty: 1, description: 'Matching churidar' }
    ],
    payments: [
      { date: '2026-09-07', amount: 10400, mode: 'UPI', note: 'Full payment' }
    ]
  },
  {
    key: 'sep-kavya-backless',
    customer: 'Kavya Trivedi',
    created: '2026-09-11',
    delivery: '2026-09-20',
    status: 'delivered',
    description: 'Saree Blouse - Backless',
    notes: 'Backless blouse with a pearl dori.',
    items: [
      { name: 'Backless Silk Blouse', price: 8200, qty: 1, description: 'Silk with pearl dori' }
    ],
    payments: [
      { date: '2026-09-11', amount: 8200, mode: 'Card', note: 'Full payment' }
    ]
  },
  {
    key: 'sep-anjali-garba',
    customer: 'Anjali Mehta',
    created: '2026-09-15',
    delivery: '2026-09-30',
    status: 'delivered',
    description: 'Navratri Garba Outfit',
    notes: 'Bright mirror work chaniya choli for garba night.',
    items: [
      { name: 'Garba Chaniya Choli', price: 21000, qty: 1, description: 'Cotton silk with mirror work' }
    ],
    payments: [
      { date: '2026-09-15', amount: 10000, mode: 'UPI', note: 'Order advance' },
      { date: '2026-09-29', amount: 11000, mode: 'Cash', note: 'Balance before delivery' }
    ]
  },
  {
    key: 'sep-ishita-cocktail',
    customer: 'Ishita Joshi',
    created: '2026-09-19',
    delivery: '2026-10-04',
    status: 'delivered',
    description: 'Cocktail Gown - Black',
    notes: 'Black satin gown with a structured bodice.',
    items: [
      { name: 'Black Cocktail Gown', price: 26000, qty: 1, description: 'Satin with structured bodice' }
    ],
    payments: [
      { date: '2026-10-03', amount: 26000, mode: 'UPI', note: 'Full payment before delivery' }
    ]
  },
  {
    key: 'sep-pooja-blouses',
    customer: 'Pooja Patel',
    created: '2026-09-23',
    delivery: '2026-10-01',
    status: 'delivered',
    description: 'Saree Blouse - Daily Wear (2 pcs)',
    notes: 'Two everyday blouses with soft lining.',
    items: [
      { name: 'Cotton Saree Blouse - White', price: 3200, qty: 1, description: 'Daily wear, boat neck' },
      { name: 'Cotton Saree Blouse - Beige', price: 3200, qty: 1, description: 'Daily wear, square neck' }
    ],
    payments: [
      { date: '2026-09-23', amount: 6400, mode: 'UPI', note: 'Full payment' }
    ]
  },
  {
    key: 'sep-rhea-saree',
    customer: 'Rhea Kapadia',
    created: '2026-09-27',
    delivery: '2026-10-10',
    status: 'delivered',
    description: 'Engagement Saree - Pastel Peach',
    notes: 'Pastel organza saree for a ring ceremony.',
    items: [
      { name: 'Pastel Peach Organza Saree', price: 18500, qty: 1, description: 'Organza with sequin border' }
    ],
    payments: [
      { date: '2026-10-09', amount: 18500, mode: 'Card', note: 'Full payment before delivery' }
    ]
  },
  {
    key: 'sep-deepika-velvet',
    customer: 'Deepika Rao',
    created: '2026-09-30',
    delivery: '2026-10-14',
    status: 'delivered',
    description: 'Trial Lehenga - Royal Blue',
    notes: 'Replacement order after the earlier cancellation.',
    items: [
      { name: 'Royal Blue Velvet Lehenga', price: 46000, qty: 1, description: 'Velvet with cutdana work' }
    ],
    payments: [
      { date: '2026-09-30', amount: 20000, mode: 'Bank Transfer', note: 'Order advance' },
      { date: '2026-10-13', amount: 26000, mode: 'UPI', note: 'Balance before delivery' }
    ]
  },
  {
    key: 'oct-nandini-reception',
    customer: 'Nandini Rao',
    created: '2026-10-04',
    delivery: '2026-10-20',
    status: 'delivered',
    description: 'Reception Lehenga - Champagne',
    notes: 'Champagne gold lehenga with a fitted corset.',
    items: [
      { name: 'Champagne Reception Lehenga', price: 52000, qty: 1, description: 'Shimmer fabric with corset' },
      { name: 'Embroidered Dupatta', price: 7000, qty: 1, description: 'Gold embroidered net' }
    ],
    payments: [
      { date: '2026-10-04', amount: 25000, mode: 'UPI', note: 'Order advance' },
      { date: '2026-10-19', amount: 34000, mode: 'Cash', note: 'Balance before delivery' }
    ]
  },
  {
    key: 'oct-ritu-saree',
    customer: 'Ritu Verma',
    created: '2026-10-08',
    delivery: '2026-10-17',
    status: 'delivered',
    description: 'Diwali Saree - Green Silk',
    notes: 'Emerald silk saree for Diwali pooja.',
    items: [
      { name: 'Green Silk Diwali Saree', price: 16500, qty: 1, description: 'Pure silk with gold border' }
    ],
    payments: [
      { date: '2026-10-08', amount: 16500, mode: 'UPI', note: 'Full payment' }
    ]
  },
  {
    key: 'oct-tanvi-bridesmaid',
    customer: 'Tanvi Deshmukh',
    created: '2026-10-12',
    delivery: '2026-10-25',
    status: 'delivered',
    description: 'Bridesmaid Lehenga - Peach',
    notes: 'Lightweight peach lehenga for a bridesmaid.',
    items: [
      { name: 'Peach Bridesmaid Lehenga', price: 24000, qty: 1, description: 'Georgette with sequin work' }
    ],
    payments: [
      { date: '2026-10-12', amount: 10000, mode: 'UPI', note: 'Order advance' },
      { date: '2026-10-24', amount: 14000, mode: 'UPI', note: 'Balance before delivery' }
    ]
  },
  {
    key: 'oct-sneha-kurta',
    customer: 'Sneha Gupta',
    created: '2026-10-16',
    delivery: '2026-10-26',
    status: 'delivered',
    description: 'Diwali Kurta Set',
    notes: 'Understated silk kurta for a family Diwali dinner.',
    items: [
      { name: 'Silk Diwali Kurta', price: 9200, qty: 1, description: 'Straight-cut silk kurta' },
      { name: 'Silk Dupatta', price: 2800, qty: 1, description: 'Tonal silk dupatta' }
    ],
    payments: [
      { date: '2026-10-16', amount: 12000, mode: 'Cash', note: 'Full payment' }
    ]
  },
  {
    key: 'oct-aisha-blouse',
    customer: 'Aisha Khan',
    created: '2026-10-20',
    delivery: '2026-11-02',
    status: 'delivered',
    description: 'Wedding Blouse - Zari Work',
    notes: 'Zari work blouse for a family wedding.',
    items: [
      { name: 'Zari Work Wedding Blouse', price: 14500, qty: 1, description: 'Zari and sequin embroidery' }
    ],
    payments: [
      { date: '2026-10-20', amount: 7000, mode: 'UPI', note: 'Order advance' },
      { date: '2026-11-01', amount: 7500, mode: 'UPI', note: 'Balance before delivery' }
    ]
  },
  {
    key: 'oct-priya-bridal',
    customer: 'Priya Sharma',
    created: '2026-10-25',
    delivery: '2026-11-12',
    status: 'ready',
    description: 'Bridal Lehenga - Rose Gold',
    notes: 'Rose gold bridal lehenga with a scalloped dupatta.',
    items: [
      { name: 'Rose Gold Bridal Lehenga', price: 68000, qty: 1, description: 'Hand-embroidered rose gold lehenga' }
    ],
    payments: [
      { date: '2026-10-25', amount: 30000, mode: 'UPI', note: 'Bridal booking advance' },
      { date: '2026-11-08', amount: 25000, mode: 'UPI', note: 'Second installment' }
    ]
  },
  {
    key: 'oct-shruti-sangeet',
    customer: 'Shruti Iyer',
    created: '2026-10-29',
    delivery: '2026-11-16',
    status: 'in_progress',
    description: 'Sangeet Lehenga - Teal',
    notes: 'Teal lehenga with silver mirror work.',
    items: [
      { name: 'Teal Sangeet Lehenga', price: 39000, qty: 1, description: 'Georgette with mirror work' }
    ],
    payments: [
      { date: '2026-10-29', amount: 15000, mode: 'UPI', note: 'Order advance' }
    ]
  },
  {
    key: 'nov-devika-scarlet',
    customer: 'Devika Menon',
    created: '2026-11-01',
    delivery: '2026-11-18',
    status: 'in_progress',
    description: 'Wedding Lehenga - Scarlet',
    notes: 'Scarlet bridal lehenga with a long veil.',
    items: [
      { name: 'Scarlet Wedding Lehenga', price: 72000, qty: 1, description: 'Silk with heavy zardosi' },
      { name: 'Long Bridal Veil', price: 8500, qty: 1, description: 'Scalloped net veil' }
    ],
    payments: [
      { date: '2026-11-01', amount: 30000, mode: 'Bank Transfer', note: 'Bridal booking advance' }
    ]
  },
  {
    key: 'nov-sanya-gown',
    customer: 'Sanya Bhatia',
    created: '2026-11-03',
    delivery: '2026-11-20',
    status: 'in_progress',
    description: 'Reception Gown - Sage',
    notes: 'Sage green gown with a dramatic trail.',
    items: [
      { name: 'Sage Reception Gown', price: 34000, qty: 1, description: 'Chiffon with a long trail' }
    ],
    payments: [
      { date: '2026-11-03', amount: 15000, mode: 'UPI', note: 'Order advance' }
    ]
  },
  {
    key: 'nov-neha-saree',
    customer: 'Neha Nair',
    created: '2026-11-05',
    delivery: '2026-11-14',
    status: 'ready',
    description: 'Festive Saree - Rani Pink',
    notes: 'Rani pink saree with a hand-finished pallu.',
    items: [
      { name: 'Rani Pink Festive Saree', price: 19500, qty: 1, description: 'Silk with hand-finished pallu' }
    ],
    payments: [
      { date: '2026-11-05', amount: 10000, mode: 'UPI', note: 'Order advance' },
      { date: '2026-11-12', amount: 8000, mode: 'UPI', note: 'Part balance' }
    ]
  },
  {
    key: 'nov-rhea-blouse',
    customer: 'Rhea Kapadia',
    created: '2026-11-07',
    delivery: '2026-11-12',
    status: 'delivered',
    description: 'Bridal Blouse - Gold Moti',
    notes: 'Gold moti blouse for a family wedding.',
    items: [
      { name: 'Gold Moti Bridal Blouse', price: 18500, qty: 1, description: 'Moti and zardosi embroidery' }
    ],
    payments: [
      { date: '2026-11-11', amount: 18500, mode: 'UPI', note: 'Full payment before delivery' }
    ]
  },
  {
    key: 'nov-ishita-lehenga',
    customer: 'Ishita Joshi',
    created: '2026-11-08',
    delivery: '2026-11-13',
    status: 'delivered',
    description: 'Diwali Lehenga - Copper',
    notes: 'Copper tissue lehenga for a Diwali party.',
    items: [
      { name: 'Copper Tissue Lehenga', price: 28500, qty: 1, description: 'Tissue with sequin motifs' }
    ],
    payments: [
      { date: '2026-11-08', amount: 28500, mode: 'Card', note: 'Full payment' }
    ]
  },
  {
    key: 'nov-kiran-blouses',
    customer: 'Kiran Desai',
    created: '2026-11-10',
    delivery: '2026-11-19',
    status: 'pending',
    description: 'Saree Blouse - Velvet (2 pcs)',
    notes: 'Two velvet blouses for the winter season.',
    items: [
      { name: 'Velvet Blouse - Wine', price: 4500, qty: 1, description: 'Velvet with piping' },
      { name: 'Velvet Blouse - Emerald', price: 4500, qty: 1, description: 'Velvet with piping' }
    ],
    payments: []
  },
  {
    key: 'nov-anjali-winter',
    customer: 'Anjali Mehta',
    created: '2026-11-12',
    delivery: '2026-11-25',
    status: 'pending',
    description: 'Winter Wedding Lehenga - Powder Blue',
    notes: 'Powder blue lehenga for a winter destination wedding.',
    items: [
      { name: 'Powder Blue Wedding Lehenga', price: 58000, qty: 1, description: 'Organza with silver embroidery' }
    ],
    payments: []
  },
  {
    key: 'nov-nandini-gown',
    customer: 'Nandini Rao',
    created: '2026-11-14',
    delivery: '2026-11-28',
    status: 'pending',
    description: 'New Year Gown - Wine',
    notes: 'Wine gown for a New Year celebration.',
    items: [
      { name: 'Wine New Year Gown', price: 24000, qty: 1, description: 'Satin with a cowl back' }
    ],
    payments: []
  }
];

const appointmentPlans = [
  { customer: 'Kavya Trivedi', orderKey: 'jul-kavya-bridal', date: '2026-07-10', time: '11:00 AM', title: 'Bridal Lehenga Measurement Session', type: 'linked_to_order', stage: 'initial_measurement', status: 'completed', notes: 'Recorded bridal measurements and reviewed zari options.' },
  { customer: 'Ishita Joshi', orderKey: 'jul-ishita-engagement', date: '2026-07-15', time: '02:00 PM', title: 'Engagement Lehenga First Trial', type: 'linked_to_order', stage: 'trial_1', status: 'completed', notes: 'Adjusted shoulder fit and dupatta length.' },
  { customer: 'Rhea Kapadia', orderKey: 'jul-rhea-twins', date: '2026-07-27', time: '11:30 AM', title: 'Mother & Daughter Lehenga Fitting', type: 'linked_to_order', stage: 'trial_1', status: 'completed', notes: 'Both pieces fitted; minor hem changes noted.' },
  { customer: 'Nandini Rao', orderKey: 'aug-nandini-mehendi', date: '2026-08-08', time: '12:00 PM', title: 'Mehendi Lehenga Trial', type: 'linked_to_order', stage: 'trial_1', status: 'completed', notes: 'Mirror work placement approved.' },
  { customer: 'Tanvi Deshmukh', orderKey: 'aug-tanvi-bridal', date: '2026-08-17', time: '10:30 AM', title: 'Bridal Lehenga First Trial', type: 'linked_to_order', stage: 'trial_1', status: 'completed', notes: 'Corset fit approved; sleeve length reduced.' },
  { customer: 'Priya Sharma', orderKey: 'aug-priya-sapphire', date: '2026-08-24', time: '03:00 PM', title: 'Sapphire Lehenga Final Fitting', type: 'linked_to_order', stage: 'final_fitting', status: 'completed', notes: 'Final fit approved for delivery.' },
  { customer: 'Devika Menon', orderKey: 'aug-devika-lavender', date: '2026-09-02', time: '11:00 AM', title: 'Wedding Guest Lehenga Trial', type: 'linked_to_order', stage: 'trial_1', status: 'completed', notes: 'Tulle layers softened at the waist.' },
  { customer: 'Sanya Bhatia', orderKey: 'sep-sanya-bridal', date: '2026-09-12', time: '02:30 PM', title: 'Bridal Lehenga Embroidery Check', type: 'linked_to_order', stage: 'trial_1', status: 'completed', notes: 'Zardosi work reviewed and approved.' },
  { customer: 'Anjali Mehta', orderKey: 'sep-anjali-garba', date: '2026-09-18', time: '10:00 AM', title: 'Navratri Outfit Measurement', type: 'linked_to_order', stage: 'initial_measurement', status: 'completed', notes: 'Selected mirror work and contrasting border.' },
  { customer: 'Pooja Patel', orderKey: 'sep-pooja-blouses', date: '2026-09-25', time: '04:00 PM', title: 'Everyday Blouse Fitting', type: 'linked_to_order', stage: 'final_fitting', status: 'completed', notes: 'Both blouses approved with minor armhole changes.' },
  { customer: 'Ritu Verma', orderKey: 'oct-ritu-saree', date: '2026-10-02', time: '11:30 AM', title: 'Diwali Saree Selection', type: 'linked_to_order', stage: 'initial_measurement', status: 'completed', notes: 'Selected emerald silk and gold border.' },
  { customer: 'Tanvi Deshmukh', orderKey: 'oct-tanvi-bridesmaid', date: '2026-10-09', time: '03:00 PM', title: 'Bridesmaid Lehenga Trial', type: 'linked_to_order', stage: 'trial_1', status: 'completed', notes: 'Sequin work approved; hem shortened.' },
  { customer: 'Aisha Khan', orderKey: 'oct-aisha-blouse', date: '2026-10-15', time: '10:00 AM', title: 'Zari Blouse Measurement', type: 'linked_to_order', stage: 'initial_measurement', status: 'completed', notes: 'Recorded neckline and sleeve preferences.' },
  { customer: 'Priya Sharma', orderKey: 'oct-priya-bridal', date: '2026-10-22', time: '12:30 PM', title: 'Rose Gold Lehenga Second Trial', type: 'linked_to_order', stage: 'trial_2', status: 'completed', notes: 'Dupatta drape and blouse fit approved.' },
  { customer: 'Shruti Iyer', orderKey: 'oct-shruti-sangeet', date: '2026-10-28', time: '02:00 PM', title: 'Sangeet Lehenga First Trial', type: 'linked_to_order', stage: 'trial_1', status: 'completed', notes: 'Mirror work placement reviewed.' },
  { customer: 'Devika Menon', orderKey: 'nov-devika-scarlet', date: '2026-11-03', time: '11:00 AM', title: 'Scarlet Lehenga First Trial', type: 'linked_to_order', stage: 'trial_1', status: 'completed', notes: 'Bodice and veil length adjustments noted.' },
  { customer: 'Sanya Bhatia', orderKey: 'nov-sanya-gown', date: '2026-11-06', time: '02:00 PM', title: 'Reception Gown Measurement', type: 'linked_to_order', stage: 'initial_measurement', status: 'completed', notes: 'Trail length and back design finalized.' },
  { customer: 'Neha Nair', orderKey: 'nov-neha-saree', date: '2026-11-09', time: '10:30 AM', title: 'Festive Saree Fitting', type: 'linked_to_order', stage: 'final_fitting', status: 'completed', notes: 'Pallu finish approved for delivery.' },
  { customer: 'Rhea Kapadia', orderKey: 'nov-rhea-blouse', date: '2026-11-11', time: '12:00 PM', title: 'Bridal Blouse Final Fitting', type: 'linked_to_order', stage: 'final_fitting', status: 'completed', notes: 'Moti work and lining approved.' },
  { customer: 'Ishita Joshi', orderKey: 'nov-ishita-lehenga', date: '2026-11-12', time: '03:30 PM', title: 'Copper Lehenga Final Fitting', type: 'linked_to_order', stage: 'final_fitting', status: 'completed', notes: 'Ready for delivery.' },
  { customer: 'Pooja Patel', orderKey: null, date: '2026-10-18', time: '11:00 AM', title: 'Blouse Consultation', type: 'walk_in', stage: null, status: 'no_show', notes: 'Client did not arrive for the consultation.' },
  { customer: 'Meera Sen', orderKey: null, date: '2026-09-22', time: '03:30 PM', title: 'Festive Blouse Consultation', type: 'walk_in', stage: null, status: 'cancelled', notes: 'Client rescheduled outside the booking window.' },
  { customer: 'Kiran Desai', orderKey: 'nov-kiran-blouses', date: '2026-11-16', time: '11:00 AM', title: 'Velvet Blouse Consultation', type: 'linked_to_order', stage: 'initial_measurement', status: 'scheduled', notes: 'Discuss lining and sleeve options.' },
  { customer: 'Anjali Mehta', orderKey: 'nov-anjali-winter', date: '2026-11-18', time: '01:00 PM', title: 'Winter Lehenga First Trial', type: 'linked_to_order', stage: 'trial_1', status: 'scheduled', notes: 'First fit for the powder blue lehenga.' },
  { customer: 'Nandini Rao', orderKey: 'nov-nandini-gown', date: '2026-11-20', time: '04:00 PM', title: 'New Year Gown Design Discussion', type: 'linked_to_order', stage: 'initial_measurement', status: 'scheduled', notes: 'Review cowl back and fabric options.' }
];

const measurementPlans = [
  { customer: 'Kavya Trivedi', date: '2026-07-06', label: 'Bridal Lehenga - Initial', notes: 'Bridal measurements for the red Banarasi lehenga.', values: { Bust: '36', Underbust: '31', Waist: '29', Hip: '39', 'Shoulder Width': '14.5', 'Blouse Length': '14.5', 'Sleeve Length': '10', 'Lehenga Length': '42', 'Front Neck Depth': '8', 'Back Neck Depth': '9' } },
  { customer: 'Ishita Joshi', date: '2026-07-13', label: 'Engagement Lehenga - Initial', notes: 'Daytime engagement look; prefers a light fit.', values: { Bust: '34', Underbust: '29', Waist: '27', Hip: '37', 'Shoulder Width': '14', 'Blouse Length': '14', 'Sleeve Length': '9.5', 'Lehenga Length': '41', 'Front Neck Depth': '7.5', 'Back Neck Depth': '8.5' } },
  { customer: 'Rhea Kapadia', date: '2026-07-25', label: 'Mother & Daughter Set', notes: 'Matching set; daughter measurements kept separate.', values: { Bust: '35', Underbust: '30', Waist: '28', Hip: '38.5', 'Shoulder Width': '14.5', 'Blouse Length': '14', 'Sleeve Length': '10', 'Lehenga Length': '41.5', 'Front Neck Depth': '7', 'Back Neck Depth': '8' } },
  { customer: 'Nandini Rao', date: '2026-08-06', label: 'Mehendi Lehenga - Initial', notes: 'Prefers a comfortable waist with mirror work.', values: { Bust: '33', Underbust: '28.5', Waist: '26.5', Hip: '36.5', 'Shoulder Width': '13.5', 'Blouse Length': '13.5', 'Sleeve Length': '9', 'Lehenga Length': '40.5', 'Front Neck Depth': '7.5', 'Back Neck Depth': '8' } },
  { customer: 'Tanvi Deshmukh', date: '2026-08-14', label: 'Bridal Lehenga - Initial', notes: 'Corset blouse with a fitted waist.', values: { Bust: '37', Underbust: '32', Waist: '30', Hip: '40', 'Shoulder Width': '15', 'Blouse Length': '15', 'Sleeve Length': '10.5', 'Lehenga Length': '42.5', 'Front Neck Depth': '8', 'Back Neck Depth': '9' } },
  { customer: 'Aisha Khan', date: '2026-08-20', label: 'Zari Blouse Measurement', notes: 'Wedding blouse with a modest neckline.', values: { Bust: '34.5', Underbust: '29.5', Waist: '28', Hip: '38', 'Shoulder Width': '14', 'Blouse Length': '14', 'Sleeve Length': '9.5', 'Lehenga Length': '41', 'Front Neck Depth': '7', 'Back Neck Depth': '8' } },
  { customer: 'Devika Menon', date: '2026-08-28', label: 'Wedding Guest Lehenga - Initial', notes: 'Soft tulle fit; avoids a tight waist.', values: { Bust: '36', Underbust: '31', Waist: '29', Hip: '39', 'Shoulder Width': '14.5', 'Blouse Length': '14.5', 'Sleeve Length': '10', 'Lehenga Length': '42', 'Front Neck Depth': '7.5', 'Back Neck Depth': '8.5' } },
  { customer: 'Sanya Bhatia', date: '2026-09-05', label: 'Bridal Lehenga - Initial', notes: 'Traditional bridal fit with a heavy dupatta.', values: { Bust: '35', Underbust: '30', Waist: '28.5', Hip: '38.5', 'Shoulder Width': '14.5', 'Blouse Length': '14', 'Sleeve Length': '10', 'Lehenga Length': '41.5', 'Front Neck Depth': '8', 'Back Neck Depth': '9' } },
  { customer: 'Priya Sharma', date: '2026-10-26', label: 'Rose Gold Bridal Lehenga', notes: 'Second bridal measurement for the rose gold set.', values: { Bust: '34', Underbust: '29', Waist: '27', Hip: '37', 'Shoulder Width': '14', 'Blouse Length': '14', 'Sleeve Length': '9.5', 'Lehenga Length': '41', 'Front Neck Depth': '7.5', 'Back Neck Depth': '8.5' } },
  { customer: 'Anjali Mehta', date: '2026-11-12', label: 'Winter Wedding Lehenga', notes: 'Powder blue lehenga for a destination wedding.', values: { Bust: '35', Underbust: '30', Waist: '28', Hip: '38', 'Shoulder Width': '14.5', 'Blouse Length': '14', 'Sleeve Length': '10', 'Lehenga Length': '41', 'Front Neck Depth': '7.5', 'Back Neck Depth': '8.5' } },
  { customer: 'Pooja Patel', date: '2026-09-21', label: 'Everyday Blouse Set', notes: 'Two daily-wear blouses with a soft lining.', values: { Bust: '33', Underbust: '28', Waist: '26', Hip: '36', 'Shoulder Width': '13.5', 'Blouse Length': '13.5', 'Sleeve Length': '9', 'Lehenga Length': '40', 'Front Neck Depth': '7', 'Back Neck Depth': '8' } },
  { customer: 'Meera Sen', date: '2026-08-20', label: 'Gold Tissue Blouse', notes: 'Festive blouse with a back tie.', values: { Bust: '34', Underbust: '29', Waist: '27.5', Hip: '37.5', 'Shoulder Width': '14', 'Blouse Length': '14', 'Sleeve Length': '9.5', 'Lehenga Length': '41', 'Front Neck Depth': '7.5', 'Back Neck Depth': '8' } }
];

async function findVendor() {
  const { data, error } = await supabase
    .from('staff')
    .select('vendor_id, role, is_active, vendors(id, name, business_name)')
    .eq('email', OWNER_EMAIL)
    .single();

  if (error || !data) throw new Error(`Could not find staff profile for ${OWNER_EMAIL}: ${error?.message || 'not found'}`);
  if (!data.is_active) throw new Error('Owner staff profile is inactive.');
  if (!data.vendor_id) throw new Error('Owner has no vendor_id.');
  return data.vendors;
}

async function resetRange(vendorId) {
  console.log('Reset requested. Removing synthetic data from 2026-07-01 onwards...');

  const { error: apptErr } = await supabase
    .from('appointments')
    .delete()
    .eq('vendor_id', vendorId)
    .gte('scheduled_date', RANGE_START);
  if (apptErr) throw apptErr;

  const { data: vendorCustomers, error: custErr } = await supabase
    .from('customers')
    .select('id')
    .eq('vendor_id', vendorId);
  if (custErr) throw custErr;

  const customerIds = (vendorCustomers || []).map(c => c.id);
  if (customerIds.length > 0) {
    const { error: measErr } = await supabase
      .from('customer_measurements')
      .delete()
      .in('customer_id', customerIds)
      .gte('recorded_at', RANGE_START);
    if (measErr) throw measErr;
  }

  const { error: orderErr } = await supabase
    .from('orders')
    .delete()
    .eq('vendor_id', vendorId)
    .gte('created_at', RANGE_START);
  if (orderErr) throw orderErr;

  const { error: newCustErr } = await supabase
    .from('customers')
    .delete()
    .eq('vendor_id', vendorId)
    .gte('created_at', RANGE_START);
  if (newCustErr) throw newCustErr;

  console.log('Range reset complete.');
}

async function getOrderNumberFactory() {
  const { data, error } = await supabase
    .from('orders')
    .select('order_number')
    .not('order_number', 'is', null);
  if (error) throw error;

  const sequences = {};
  for (const row of data || []) {
    const match = /^ORD-(\d{6})-(\d+)$/.exec(row.order_number || '');
    if (!match) continue;
    sequences[match[1]] = Math.max(sequences[match[1]] || 0, parseInt(match[2], 10));
  }

  return (createdAt) => {
    const prefix = `ORD-${createdAt.slice(0, 7).replace('-', '')}`;
    const next = (sequences[prefix] || 0) + 1;
    sequences[prefix] = next;
    return `${prefix}-${String(next).padStart(4, '0')}`;
  };
}

async function main() {
  const reset = process.argv.includes('--reset');
  const vendor = await findVendor();
  console.log(`Seeding synthetic data for ${vendor.business_name || vendor.name} (${vendor.id})`);

  const { data: existingRangeOrders, error: rangeErr } = await supabase
    .from('orders')
    .select('id')
    .eq('vendor_id', vendor.id)
    .gte('created_at', RANGE_START);
  if (rangeErr) throw rangeErr;

  if ((existingRangeOrders || []).length > 0) {
    if (!reset) {
      console.error(`Found ${existingRangeOrders.length} orders from ${RANGE_START} onwards. Refusing to duplicate data.`);
      console.error('Re-run with --reset to replace the synthetic range.');
      process.exit(1);
    }
    await resetRange(vendor.id);
  }

  const { data: existingCustomers, error: existingCustErr } = await supabase
    .from('customers')
    .select('id, full_name, name, created_at')
    .eq('vendor_id', vendor.id);
  if (existingCustErr) throw existingCustErr;

  const customerByName = new Map();
  for (const customer of existingCustomers || []) {
    customerByName.set(customer.full_name || customer.name, customer);
  }

  const customersToInsert = newCustomers
    .filter(customer => !customerByName.has(customer.name))
    .map(customer => ({
      vendor_id: vendor.id,
      name: customer.name,
      full_name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      notes: 'Referred through the festive and wedding season collection.',
      total_outstanding: 0,
      created_at: ts(customer.createdAt, '10:30:00')
    }));

  if (customersToInsert.length > 0) {
    const { data, error } = await supabase.from('customers').insert(customersToInsert).select('id, full_name');
    if (error) throw error;
    for (const customer of data || []) customerByName.set(customer.full_name, customer);
    console.log(`Inserted ${data.length} new customers.`);
  } else {
    console.log('No new customers needed.');
  }

  const nextOrderNumber = await getOrderNumberFactory();
  const orderIdsByKey = new Map();
  const orderIdsByPlan = new Map();
  let insertedOrders = 0;
  let insertedPayments = 0;

  for (const plan of orderPlans) {
    const customer = customerByName.get(plan.customer);
    if (!customer) throw new Error(`Unknown customer: ${plan.customer}`);

    const totalAmount = plan.items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const paidTotal = plan.payments.reduce((sum, payment) => sum + payment.amount, 0);
    if (paidTotal > totalAmount) {
      throw new Error(`Payments exceed total for ${plan.key}: ${paidTotal} > ${totalAmount}`);
    }

    const orderNumber = nextOrderNumber(plan.created);
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert([{
        vendor_id: vendor.id,
        customer_id: customer.id,
        order_number: orderNumber,
        description: plan.description,
        notes: plan.notes,
        total_amount: totalAmount,
        amount_paid: 0,
        amount_outstanding: totalAmount,
        delivery_date: ts(plan.delivery, '18:00:00'),
        status: plan.status,
        created_at: ts(plan.created, '11:15:00')
      }])
      .select('id, order_number')
      .single();
    if (orderErr) throw orderErr;

    orderIdsByKey.set(plan.key, order.id);
    orderIdsByPlan.set(plan.key, { id: order.id, customerId: customer.id, totalAmount });

    const itemRows = plan.items.map(item => ({
      order_id: order.id,
      item_name: item.name,
      description: item.description || null,
      quantity: item.qty,
      unit_price: item.price,
      total_price: item.price * item.qty
    }));
    const { error: itemErr } = await supabase.from('order_items').insert(itemRows);
    if (itemErr) throw itemErr;

    if (plan.payments.length > 0) {
      const paymentRows = plan.payments.map(payment => ({
        order_id: order.id,
        customer_id: customer.id,
        amount: payment.amount,
        payment_mode: payment.mode,
        payment_method: payment.mode,
        reference_note: payment.note,
        paid_at: ts(payment.date, '16:30:00'),
        created_at: ts(payment.date, '16:30:00')
      }));
      const { error: paymentErr } = await supabase.from('payments').insert(paymentRows);
      if (paymentErr) throw paymentErr;
      insertedPayments += paymentRows.length;
    }

    insertedOrders += 1;
  }

  console.log(`Inserted ${insertedOrders} orders and ${insertedPayments} payments.`);

  const appointmentRows = appointmentPlans.map(appointment => ({
    vendor_id: vendor.id,
    customer_id: customerByName.get(appointment.customer).id,
    order_id: appointment.orderKey ? orderIdsByKey.get(appointment.orderKey) : null,
    title: appointment.title,
    appointment_type: appointment.type,
    stage: appointment.stage,
    scheduled_date: ts(appointment.date, to24Hour(appointment.time)),
    appointment_date: ts(appointment.date, to24Hour(appointment.time)),
    time_slot: appointment.time,
    status: appointment.status,
    notes: appointment.notes,
    created_at: ts(shiftDate(appointment.date, -7), '09:00:00')
  }));

  const { error: appointmentErr } = await supabase.from('appointments').insert(appointmentRows);
  if (appointmentErr) throw appointmentErr;
  console.log(`Inserted ${appointmentRows.length} appointments.`);

  const measurementRows = measurementPlans.map(measurement => ({
    customer_id: customerByName.get(measurement.customer).id,
    template_id: null,
    label: measurement.label,
    values: measurement.values,
    notes: measurement.notes,
    recorded_at: ts(measurement.date, '12:00:00'),
    updated_at: ts(measurement.date, '12:00:00')
  }));

  const { error: measurementErr } = await supabase.from('customer_measurements').insert(measurementRows);
  if (measurementErr) throw measurementErr;
  console.log(`Inserted ${measurementRows.length} measurement snapshots.`);

  await reconcileBalances(vendor.id);

  console.log('\nSynthetic backfill complete.');
  console.log('Range: 2026-07-01 to 2026-11-14');
  console.log(`Customers: ${newCustomers.length} new / ${customerByName.size} total`);
  console.log(`Orders: ${insertedOrders} new`);
  console.log(`Appointments: ${appointmentRows.length} new`);
  console.log(`Measurements: ${measurementRows.length} new`);
}

function to24Hour(time) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time.trim());
  if (!match) return '12:00:00';
  let hour = parseInt(match[1], 10);
  const minute = match[2];
  const suffix = match[3].toUpperCase();
  if (suffix === 'PM' && hour !== 12) hour += 12;
  if (suffix === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${minute}:00`;
}

async function reconcileBalances(vendorId) {
  console.log('Reconciling order and customer balances...');

  const { data: customerRows, error: customerErr } = await supabase
    .from('customers')
    .select('id')
    .eq('vendor_id', vendorId);
  if (customerErr) throw customerErr;

  const customerIds = (customerRows || []).map(c => c.id);
  if (customerIds.length === 0) return;

  const { data: orderRows, error: orderErr } = await supabase
    .from('orders')
    .select('id, customer_id, total_amount')
    .eq('vendor_id', vendorId);
  if (orderErr) throw orderErr;

  const orderIds = (orderRows || []).map(o => o.id);
  const paidByOrder = new Map();
  if (orderIds.length > 0) {
    const { data: paymentRows, error: paymentErr } = await supabase
      .from('payments')
      .select('order_id, amount')
      .in('order_id', orderIds);
    if (paymentErr) throw paymentErr;
    for (const payment of paymentRows || []) {
      paidByOrder.set(payment.order_id, (paidByOrder.get(payment.order_id) || 0) + Number(payment.amount || 0));
    }
  }

  const { data: statusRows, error: statusErr } = await supabase
    .from('orders')
    .select('id, status')
    .eq('vendor_id', vendorId);
  if (statusErr) throw statusErr;
  const statusByOrder = new Map((statusRows || []).map(row => [row.id, row.status]));

  const outstandingByCustomer = new Map();
  for (const order of orderRows || []) {
    const paid = paidByOrder.get(order.id) || 0;
    const isCancelled = statusByOrder.get(order.id) === 'cancelled';
    const outstanding = isCancelled ? 0 : Math.max(0, Number(order.total_amount || 0) - paid);
    outstandingByCustomer.set(order.customer_id, (outstandingByCustomer.get(order.customer_id) || 0) + outstanding);

    const { error } = await supabase
      .from('orders')
      .update({ amount_paid: paid, amount_outstanding: outstanding })
      .eq('id', order.id);
    if (error) throw error;
  }

  for (const customerId of customerIds) {
    const { error } = await supabase
      .from('customers')
      .update({ total_outstanding: outstandingByCustomer.get(customerId) || 0 })
      .eq('id', customerId);
    if (error) throw error;
  }

  console.log(`Reconciled ${orderRows?.length || 0} orders across ${customerIds.length} customers.`);
}

main().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
