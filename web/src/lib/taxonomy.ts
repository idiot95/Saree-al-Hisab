/* A library of categories a household can adopt, group by group, from the
   Categories screen.

   The starter set a new household is given is deliberately thin — eight ways
   to spend, six ways money comes in — because a fresh book with forty
   headings is a form nobody fills. This is the long list, for the household
   that wants it: every group here is a parent with its children beneath it,
   in the shape the finance apps of the day use (Fold, for one, files
   spending under some forty categories with a hundred and sixty
   sub-categories beneath them — shopping into clothes, shoes, electronics,
   books; travel into flights, hotels, and so on). Names are what an Indian
   household says: Wajebaat, Eidi, FASTag, thaali. Nothing here is in the
   database until somebody taps Add — and then it is theirs to rename,
   recolour and retire like anything else.

   Every name in the library is unique, parents and children together,
   because a household's categories are unique by name, so "Add all" can
   add all of it. A child that clashes with a name the household already
   has is simply skipped. */

export type Suggested = {
  name: string; icon: string; tint: string; scope: 'expense' | 'income';
  children: readonly { name: string; icon: string }[];
};

const g = (name: string, icon: string, tint: string, scope: 'expense' | 'income',
  children: readonly (readonly [string, string])[]): Suggested =>
  ({ name, icon, tint, scope, children: children.map(([n, i]) => ({ name: n, icon: i })) });

export const LIBRARY: readonly Suggested[] = [
  // ── spending ─────────────────────────────────────────────────────────────
  g('Groceries', 'cart', 'green', 'expense', [
    ['Milk & dairy', 'milk'], ['Vegetables', 'vegetables'], ['Fruit', 'fruit'], ['Meat & fish', 'meat'],
    ['Eggs', 'egg'], ['Bread & bakery', 'bread'], ['Grains & staples', 'bag'], ['Snacks & sweets', 'sweets'],
    ['Tea & coffee', 'tea'], ['Water & drinks', 'bottle'],
  ]),
  g('Eating out', 'cutlery', 'orange', 'expense', [
    ['Restaurants', 'chef'], ['Food delivery', 'delivery'], ['Cafés', 'coffee'], ['Street food', 'burger'],
    ['Ice cream & desserts', 'icecream'],
  ]),
  g('Home', 'house2', 'green', 'expense', [
    ['Rent', 'house2'], ['Society charges', 'building'], ['Home repairs', 'hammer'], ['Furniture', 'sofa'],
    ['Appliances', 'fridge'], ['Décor & lighting', 'lamp'], ['Garden & plants', 'plant'],
    ['Cleaning supplies', 'bucket'], ['Home help', 'people'],
  ]),
  g('Utilities', 'bulb', 'cyan', 'expense', [
    ['Electricity', 'electricity'], ['Water bill', 'water'], ['Gas & cylinder', 'gas'], ['Mobile recharge', 'recharge'],
    ['Internet', 'wifi'], ['TV & DTH', 'tv'], ['Subscriptions', 'cloud'],
  ]),
  g('Transport', 'car', 'blue', 'expense', [
    ['Fuel', 'fuel'], ['Cab & auto', 'car'], ['Bus & metro', 'bus'], ['Train tickets', 'train'],
    ['Parking', 'parking'], ['Tolls & FASTag', 'toll'], ['Vehicle servicing', 'tools'], ['Two-wheeler', 'motorbike'],
  ]),
  g('Shopping', 'bag', 'purple', 'expense', [
    ['Clothes', 'shirt'], ['Shoes', 'shoes'], ['Electronics', 'devices'], ['Books & magazines', 'books'],
    ['Video games', 'games'], ['Jewellery', 'jewellery'], ['Beauty & perfume', 'perfume'], ['Household goods', 'dish'],
  ]),
  g('Children', 'child', 'pink', 'expense', [
    ['School fees', 'school'], ['Tuition & classes', 'chalkboard'], ['Stationery', 'notebook'],
    ['School uniform', 'hanger'], ['Toys', 'toys'], ['Baby needs', 'baby'], ['Pocket money', 'coin'],
    ["Kids' activities", 'trophy'],
  ]),
  g('Health', 'health', 'rust', 'expense', [
    ['Doctor visits', 'doctor'], ['Medicines', 'medicine'], ['Hospital', 'hospital'], ['Dentist', 'dentist'],
    ['Eye care', 'glasses'], ['Tests & scans', 'firstaid'], ['Vaccines', 'vaccine'],
  ]),
  g('Personal care', 'scissors', 'pink', 'expense', [
    ['Salon & barber', 'scissors'], ['Cosmetics', 'perfume'], ['Gym', 'gym'], ['Yoga & sport', 'yoga'],
    ['Laundry', 'laundry'], ['Grooming', 'razor'],
  ]),
  g('Faith & community', 'mosque', 'indigo', 'expense', [
    ['Wajebaat & sabeel', 'mosque'], ['Zakat & sadaqah', 'charity'], ['FMB thaali', 'cutlery'],
    ['Niyaz & majlis', 'moonstars'], ['Jamaat dues', 'community'], ['Ziyarat', 'map'],
  ]),
  g('Gifts & occasions', 'gift', 'pink', 'expense', [
    ['Weddings', 'celebration'], ['Eid & festivals', 'sparkles'], ['Birthdays', 'cake'], ['Gifts given', 'gift'],
    ['Salaam envelopes', 'coin'],
  ]),
  g('Travel', 'plane', 'blue', 'expense', [
    ['Flights', 'plane'], ['Hotels', 'bed'], ['Holiday spending', 'beach'], ['Visas & passports', 'world'],
    ['Luggage', 'luggage'], ['Travel insurance', 'umbrella'],
  ]),
  g('Entertainment', 'music', 'purple', 'expense', [
    ['Streaming', 'video'], ['Cinema', 'cinema'], ['Outings & tickets', 'ticket'], ['Hobbies', 'art'],
    ['Music', 'music'], ['Sports events', 'cricket'],
  ]),
  g('Pets', 'pet', 'orange', 'expense', [
    ['Pet food', 'pet'], ['Vet', 'dog'], ['Pet grooming', 'cat'],
  ]),
  g('Insurance', 'shield', 'indigo', 'expense', [
    ['Life insurance', 'shield'], ['Health insurance', 'health'], ['Vehicle insurance', 'car'],
    ['Home insurance', 'house2'],
  ]),
  g('Loans & EMIs', 'bank', 'rust', 'expense', [
    ['Home loan EMI', 'house2'], ['Car loan EMI', 'car'], ['Personal loan EMI', 'bank'], ['Card interest', 'card'],
    ['Repaying people', 'friends'],
  ]),
  g('Taxes & charges', 'tax', 'indigo', 'expense', [
    ['Income tax', 'tax'], ['Property tax', 'building'], ['Government fees', 'gavel'], ['Bank charges', 'bank'],
    ['Fines & penalties', 'invoice'],
  ]),
  g('Learning', 'book', 'blue', 'expense', [
    ['Courses', 'certificate'], ['Study material', 'books'], ['Exam fees', 'notebook'], ['Online learning', 'cpu'],
  ]),
  g('Investments', 'invest', 'green', 'expense', [
    ['Mutual funds & SIPs', 'invest'], ['Stocks', 'report'], ['Gold', 'jewellery'], ['Fixed deposits', 'bank'],
    ['PPF & NPS', 'piggy'], ['Property', 'building'], ['Committee & chit', 'people'],
  ]),
  g('Work', 'briefcase', 'blue', 'expense', [
    ['Office supplies', 'printer'], ['Software & tools', 'cpu'], ['Work travel', 'plane'],
    ['Professional fees', 'scale'], ['Staff wages', 'people'],
  ]),
  g('Other spending', 'tag', 'indigo', 'expense', [
    ['ATM cash', 'cash'], ['Uncategorised', 'tag'],
  ]),
  // ── income ───────────────────────────────────────────────────────────────
  g('Salary', 'salary', 'green', 'income', [
    ['Monthly salary', 'salary'], ['Bonus', 'award'], ['Reimbursements', 'invoice'], ['Allowances', 'coin'],
  ]),
  g('Business income', 'briefcase', 'blue', 'income', [
    ['Sales', 'store'], ['Freelance', 'briefcase'], ['Consulting fees', 'scale'],
  ]),
  g('Investment income', 'percent', 'indigo', 'income', [
    ['Interest', 'percent'], ['Dividends', 'report'], ['Capital gains', 'invest'], ['Rent received', 'building'],
  ]),
  g('Gifts received', 'gift', 'pink', 'income', [
    ['Eidi', 'gift'], ['Cash gifts', 'coin'], ['Family support', 'heart'],
  ]),
  g('Refunds', 'rupee', 'cyan', 'income', [
    ['Refund', 'rupee'], ['Cashback & rewards', 'discount'], ['Tax refund', 'tax'], ['Insurance payout', 'shield'],
  ]),
  g('Pension & benefits', 'piggy', 'orange', 'income', [
    ['Pension', 'piggy'], ['PF withdrawal', 'savings'], ['Government benefit', 'building'],
  ]),
  g('Other income', 'coin', 'orange', 'income', [
    ['Sold something', 'tag'], ['Prize money', 'trophy'], ['Loan taken', 'bank'],
  ]),
];

/** A group by its name, or nothing. Names are compared as a person would
 *  read them: case does not count. */
export function suggestedGroup(name: string): Suggested | undefined {
  const k = name.trim().toLowerCase();
  return LIBRARY.find((s) => s.name.toLowerCase() === k);
}

/** How many of the library's names a household already has — counting a
 *  parent only when it stands at the top, and a child wherever it is. */
export function alreadyHave(group: Suggested, names: Iterable<string>): { parent: boolean; children: number } {
  const have = new Set(Array.from(names, (n) => n.trim().toLowerCase()));
  return {
    parent: have.has(group.name.toLowerCase()),
    children: group.children.filter((c) => have.has(c.name.toLowerCase())).length,
  };
}
