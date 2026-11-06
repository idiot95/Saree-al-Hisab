/* Invented bank and UPI messages in the shapes Indian banks send. Nothing here
   is a real person, account or VPA: XX1234 and @ok* handles are placeholders. */

export type SmsExpect = {
  amountMinor: number | null;
  currency: string | null;
  direction: 'debit' | 'credit' | null;
  last4: string | null;
  merchant: string | null;
  date: string | null;
};

export type SmsFixture = {
  /** Bank or app the shape imitates, for the coverage count. */
  source: string;
  kind: string;
  sender: string;
  text: string;
  expect: SmsExpect;
};

const f = (
  source: string, kind: string, sender: string, text: string,
  amountMinor: number, currency: string, direction: 'debit' | 'credit',
  last4: string | null, merchant: string | null, date: string | null,
): SmsFixture => ({ source, kind, sender, text, expect: { amountMinor, currency, direction, last4, merchant, date } });

export const BANK_FIXTURES: SmsFixture[] = [
  // HDFC
  f('HDFC', 'debit', 'HDFCBK', 'Sent Rs.450.00 From HDFC Bank A/c XX1234 To ZOMATO On 06/11/26 Ref 612345678901. Not you? Call 18002586161',
    45000, 'INR', 'debit', '1234', 'ZOMATO', '2026-11-06'),
  f('HDFC', 'debit', 'HDFCBK', 'Rs.2,340.00 debited from a/c **1234 on 06-11-26 to VPA grocer@okhdfc (UPI Ref No 612345678901). Not you? Call 18002586161',
    234000, 'INR', 'debit', '1234', 'grocer@okhdfc', '2026-11-06'),
  f('HDFC', 'credit', 'HDFCBK', 'Credit Alert! Rs.15,000.00 credited to HDFC Bank A/c XX1234 on 06-11-26 from VPA ammar@okhdfc (UPI 612345678901)',
    1500000, 'INR', 'credit', '1234', 'ammar@okhdfc', '2026-11-06'),
  f('HDFC', 'credit', 'HDFCBK', 'Update: INR 1,25,000.00 deposited in HDFC Bank A/c XX1234 on 06-NOV-26 for NEFT Cr-TESTCORP SALARY-NOV. Avl bal INR 2,04,500.75',
    12500000, 'INR', 'credit', '1234', null, '2026-11-06'),
  // ICICI
  f('ICICI', 'debit', 'ICICIB', 'ICICI Bank Acct XX1234 debited for Rs 1,250.00 on 06-Nov-26; Swiggy credited. UPI:612345678901. Call 18002662 for dispute.',
    125000, 'INR', 'debit', '1234', null, '2026-11-06'),
  f('ICICI', 'debit', 'ICICIB', 'ICICI Bank Acct XX1234 debited Rs. 899.50 on 05-Nov-26 trf to netflix@icici. Avl Bal Rs 12,345.67',
    89950, 'INR', 'debit', '1234', 'netflix@icici', '2026-11-05'),
  f('ICICI', 'credit', 'ICICIB', 'Dear Customer, Acct XX1234 is credited with Rs 25,000.00 on 06-Nov-26 from Test Payer. UPI:612345678901-ICICI Bank.',
    2500000, 'INR', 'credit', '1234', 'Test Payer', '2026-11-06'),
  f('ICICI', 'credit', 'ICICIB', 'ICICI Bank Acct XX1234 credited Rs. 3,000.00 on 04-Nov-26. Info: UPI/612345678901/refund@icici. Avl Bal Rs 20,000.00',
    300000, 'INR', 'credit', '1234', 'refund@icici', '2026-11-04'),
  // SBI
  f('SBI', 'debit', 'SBIINB', 'Dear SBI User, your A/c X1234 debited by Rs 500.00 on 06Nov26 transfer to Fruit Vendor Ref No 612345678901. If not done by you, call 1800111109',
    50000, 'INR', 'debit', '1234', 'Fruit Vendor', '2026-11-06'),
  f('SBI', 'debit', 'SBIINB', 'Your A/C XXXXX671234 Debited INR 1,200.00 on 06/11/2026 -Transferred to Test Landlord. Ref 612345678901',
    120000, 'INR', 'debit', '1234', 'Test Landlord', '2026-11-06'),
  f('SBI', 'credit', 'SBIINB', 'Your a/c no. XXXXXXXX1234 is credited by Rs.5,000.00 on 06/11/2026 by transfer from Test Payer, Ref 612345678901 -SBI',
    500000, 'INR', 'credit', '1234', 'Test Payer', '2026-11-06'),
  f('SBI', 'credit', 'SBIINB', 'A/c XX1234 credited INR 7,500.00 on 03-11-2026 (UPI Ref 612345678901 from sana@oksbi). SBI',
    750000, 'INR', 'credit', '1234', 'sana@oksbi', '2026-11-03'),
  // Axis
  f('Axis', 'debit', 'AXISBK', 'Debit INR 3,499.00 A/c no. XX1234 06-11-26 08:15:22 UPI/P2M/612345678901/Test Store. Avl Bal INR 41,250.75 -Axis Bank',
    349900, 'INR', 'debit', '1234', 'Test Store', '2026-11-06'),
  f('Axis', 'debit', 'AXISBK', 'INR 600.00 debited from A/c no. XX1234 on 2026-11-06 12:01:44 UPI/P2A/612345678901/friend@okaxis. Not you? SMS BLOCK UPI to 18001035577',
    60000, 'INR', 'debit', '1234', 'friend@okaxis', '2026-11-06'),
  f('Axis', 'credit', 'AXISBK', 'INR 12,000.00 credited to A/c no. XX1234 on 06-11-2026 08:15:22 UPI/P2A/612345678901/Test Payer. Avl Bal INR 53,250.75 -Axis Bank',
    1200000, 'INR', 'credit', '1234', 'Test Payer', '2026-11-06'),
  f('Axis', 'credit', 'AXISBK', 'Salary credited! INR 85,000.00 credited in your Axis Bank A/c XX1234 on 06-Nov-26. Avl Bal INR 1,20,000.00',
    8500000, 'INR', 'credit', '1234', null, '2026-11-06'),
  // Kotak
  f('Kotak', 'debit', 'KOTAKB', 'Sent Rs.750.00 from Kotak Bank AC X1234 to shop@okaxis on 06-11-26.UPI Ref 612345678901. Not you? Call 18602662666',
    75000, 'INR', 'debit', '1234', 'shop@okaxis', '2026-11-06'),
  f('Kotak', 'debit', 'KOTAKB', 'Rs.1,200.00 debited from your Kotak Mahindra Bank A/c XX1234 on 05-Nov-2026 at TEST PHARMACY. Avl Bal Rs 8,000.00',
    120000, 'INR', 'debit', '1234', 'TEST PHARMACY', '2026-11-05'),
  f('Kotak', 'credit', 'KOTAKB', 'Received Rs.2,000.00 in your Kotak Bank AC X1234 from friend@okicici on 06-11-26.UPI Ref 612345678901.',
    200000, 'INR', 'credit', '1234', 'friend@okicici', '2026-11-06'),
  f('Kotak', 'credit', 'KOTAKB', 'Your Kotak Bank A/c XX1234 is credited with Rs.9,999.00 on 06-Nov-26 by NEFT from TESTCORP LTD. Ref 612345678901',
    999900, 'INR', 'credit', '1234', 'TESTCORP LTD', '2026-11-06'),
  // UPI apps
  f('GPay', 'sent', 'GPAY', 'Paid ₹320.00 to chaipoint@okhdfc using Google Pay on 06/11/2026. UPI Ref 612345678901',
    32000, 'INR', 'debit', null, 'chaipoint@okhdfc', '2026-11-06'),
  f('GPay', 'sent', 'GPAY', 'You paid ₹1,180 to Test Kirana on Google Pay. UPI transaction ID 612345678901. 2026-11-06',
    118000, 'INR', 'debit', null, 'Test Kirana', '2026-11-06'),
  f('GPay', 'received', 'GPAY', 'Received ₹1,500.00 from ammar@okhdfc on Google Pay 06-11-2026',
    150000, 'INR', 'credit', null, 'ammar@okhdfc', '2026-11-06'),
  f('GPay', 'received', 'GPAY', 'Test Payer sent you ₹250.00 on Google Pay. UPI Ref 612345678901',
    25000, 'INR', 'credit', null, 'Test Payer', null),
  f('PhonePe', 'sent', 'PHONEPE', 'Sent ₹450 to Test Kirana. Txn ID T2611061234567. PhonePe 06/11/2026',
    45000, 'INR', 'debit', null, 'Test Kirana', '2026-11-06'),
  f('PhonePe', 'sent', 'PHONEPE', 'Paid ₹99.00 to music@ybl via PhonePe on 06-Nov-26. Txn ID T2611061234568',
    9900, 'INR', 'debit', null, 'music@ybl', '2026-11-06'),
  f('PhonePe', 'received', 'PHONEPE', 'Received ₹900 from sara@ybl on PhonePe. Txn ID T2611061234569. 06-11-26',
    90000, 'INR', 'credit', null, 'sara@ybl', '2026-11-06'),
  f('PhonePe', 'received', 'PHONEPE', '₹2,500 received from Test Payer via PhonePe. Txn ID T2611061234570',
    250000, 'INR', 'credit', null, 'Test Payer', null),
  f('Paytm', 'sent', 'PAYTMB', 'Paid Rs.60 to Auto Driver from Paytm Payments Bank A/c XX1234 on 06-11-26',
    6000, 'INR', 'debit', '1234', 'Auto Driver', '2026-11-06'),
  f('Paytm', 'sent', 'PAYTMB', 'Rs.340 paid to tester@paytm via Paytm UPI on 06-11-26. Ref 612345678901',
    34000, 'INR', 'debit', null, 'tester@paytm', '2026-11-06'),
  f('Paytm', 'received', 'PAYTMB', 'Rs.1,000 received in Paytm Payments Bank A/c XX1234 from tester@paytm on 06-11-26',
    100000, 'INR', 'credit', '1234', 'tester@paytm', '2026-11-06'),
  f('Paytm', 'received', 'PAYTMB', 'Received Rs.75.50 from Test Payer in your Paytm Wallet on 06-11-26',
    7550, 'INR', 'credit', null, 'Test Payer', '2026-11-06'),
  // Credit cards
  f('ICICI', 'card', 'ICICIB', 'Spent Rs.899.00 on ICICI Bank Card XX1234 at NETFLIX on 06-Nov-26. Avl Limit: Rs 1,00,000.00',
    89900, 'INR', 'debit', '1234', 'NETFLIX', '2026-11-06'),
  f('HDFC', 'card', 'HDFCBK', 'Rs 4,560.00 spent on HDFC Bank Credit Card ending 1234 at AMAZON on 06-11-26. Avl Cr Limit Rs 95,440.00',
    456000, 'INR', 'debit', '1234', 'AMAZON', '2026-11-06'),
  // ATM
  f('HDFC', 'atm', 'HDFCBK', 'Rs.10,000.00 withdrawn from ATM using Card XX1234 on 06-11-26 at TEST ATM MUMBAI. Avl Bal Rs 32,000.00',
    1000000, 'INR', 'debit', '1234', 'TEST ATM MUMBAI', '2026-11-06'),
  f('SBI', 'atm', 'SBIINB', 'Rs 5,000 withdrawn at ATM from A/c XX1234 on 06Nov26. Avl Bal Rs 20,000',
    500000, 'INR', 'debit', '1234', null, '2026-11-06'),
  // Gulf
  f('AED', 'card', 'EMIRATESNBD', 'Purchase of AED 125.50 with Card ending 1234 at CARREFOUR DUBAI on 06-Nov-26. Available balance AED 4,320.00',
    12550, 'AED', 'debit', '1234', 'CARREFOUR DUBAI', '2026-11-06'),
  f('AED', 'credit', 'EMIRATESNBD', 'AED 5,000.00 credited to your account XX1234 on 06/11/2026. Available balance: AED 9,000.00',
    500000, 'AED', 'credit', '1234', null, '2026-11-06'),
];

export const OTP_FIXTURES: string[] = [
  '123456 is your OTP for login. Do not share it with anyone.',
  'Your OTP is 482915 for txn of Rs 500 at TESTSHOP. Valid for 10 minutes.',
  'Your verification code is 739104. Never share this code.',
  'Use one-time password 7391 to authorise payment of Rs 2,000. Do not share.',
  'Aapka OTP 558213 hai. Kisi ke saath share na karein. Transaction Rs 1,200 ke liye.',
  'आपका OTP 558213 है। इसे किसी से साझा न करें।',
  'Your login code is 4829. Do not share.',
];

export const PROMO_FIXTURES: string[] = [
  'Get Rs 500 cashback on your first UPI transaction! Use code WELCOME. T&C apply.',
  'Congratulations! Loan of Rs 5,00,000 pre-approved for you. Apply now at bank.example/loan',
  'Festive offer: win up to Rs 1,00,000 on credit card spends. Offer ends 10-11-26.',
];
