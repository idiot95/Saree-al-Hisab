/* App icon name -> Material Symbols Rounded name.

   Categories store the app name ('cart') in the database, so the keys here are
   frozen; only the value, what is drawn, may change. The font is a subset
   built from MATERIAL_USED (scripts/icons-font.mjs), so a value that is not
   in this file is not in the font and would draw as its literal text. */

export const ICON_NAMES: Record<string, string> = {
  // categories
  house2: 'home', cart: 'shopping_cart', child: 'child_friendly', cutlery: 'restaurant',
  bag: 'shopping_bag', bulb: 'lightbulb', car: 'directions_car', health: 'monitor_heart',
  phone: 'smartphone', gift: 'redeem', plane: 'flight', fuel: 'local_gas_station',
  book: 'menu_book', coffee: 'coffee', scissors: 'content_cut', tools: 'build', pet: 'pets',
  gym: 'fitness_center', music: 'music_note', wifi: 'wifi', shield: 'verified_user',
  charity: 'volunteer_activism', salary: 'request_quote', invest: 'trending_up', tag: 'sell',
  // accounts and rails
  bank: 'account_balance', cash: 'payments', savings: 'savings', card: 'credit_card',
  person: 'person', upi: 'qr_code_2', netbanking: 'laptop_mac', cheque: 'receipt',
  wallet: 'account_balance_wallet', autodebit: 'autorenew', settings: 'settings',
  // the rest of the app
  sun: 'light_mode', moon: 'dark_mode', worth: 'show_chart', receivable: 'south_west',
  tab: 'group', plus: 'add', camera: 'photo_camera', upload: 'upload', pencil: 'edit',
  check: 'check', trash: 'delete', skip: 'skip_next', stop: 'stop_circle', move: 'swap_horiz',
  folder: 'folder', dots: 'more_horiz', bell: 'notifications', clip: 'attach_file',
  google: 'login', linked: 'check_circle', unlinked: 'radio_button_unchecked',

  // food and the kitchen
  milk: 'local_drink', meat: 'kebab_dining', fish: 'set_meal', egg: 'egg', bread: 'bakery_dining',
  fruit: 'nutrition', vegetables: 'grass', salad: 'eco', pizza: 'local_pizza',
  burger: 'lunch_dining', icecream: 'icecream', cake: 'cake', sweets: 'cookie',
  tea: 'emoji_food_beverage', teapot: 'coffee_maker', bottle: 'water_bottle', soup: 'soup_kitchen',
  cheese: 'tapas', chef: 'skillet', fridge: 'kitchen', cooker: 'oven_gen', microwave: 'microwave',
  // the house
  bed: 'bed', sofa: 'weekend', lamp: 'light', door: 'door_front', key: 'key', lock: 'lock',
  bath: 'bathtub', laundry: 'local_laundry_service', ironing: 'iron', vacuum: 'cleaning_services',
  bucket: 'wash', plant: 'potted_plant', flower: 'local_florist', tree: 'park', garden: 'yard',
  hammer: 'hardware', paint: 'format_paint', brush: 'brush', aircon: 'ac_unit',
  // utilities
  electricity: 'bolt', water: 'water_drop', gas: 'local_fire_department', plug: 'power',
  battery: 'battery_full', dish: 'satellite_alt', tv: 'tv', recharge: 'charging_station',
  cloud: 'cloud',
  // getting around
  bus: 'directions_bus', train: 'train', bicycle: 'pedal_bike', scooter: 'electric_scooter',
  motorbike: 'two_wheeler', moped: 'moped', parking: 'local_parking', toll: 'toll',
  truck: 'local_shipping', delivery: 'delivery_dining', package: 'inventory_2', post: 'mail',
  ship: 'directions_boat',
  // health and sport
  medicine: 'medication', doctor: 'stethoscope', dentist: 'dentistry', glasses: 'eyeglasses',
  firstaid: 'medical_services', hospital: 'local_hospital', vaccine: 'vaccines',
  running: 'directions_run', yoga: 'self_improvement', swimming: 'pool',
  cricket: 'sports_cricket', football: 'sports_soccer', tennis: 'sports_tennis',
  // children and learning
  school: 'school', backpack: 'backpack', notebook: 'book_2', books: 'library_books',
  certificate: 'workspace_premium', chalkboard: 'co_present', abacus: 'calculate',
  baby: 'child_care', toys: 'toys', games: 'sports_esports', ticket: 'confirmation_number',
  cinema: 'movie', art: 'palette', headphones: 'headphones', trophy: 'emoji_events',
  medal: 'military_tech',
  // clothes and the person
  shirt: 'checkroom', hanger: 'dry_cleaning', shoes: 'steps', socks: 'styler',
  sewing: 'design_services', perfume: 'spa', razor: 'self_care', jewellery: 'diamond',
  crown: 'stars', sunglasses: 'sunny',
  // faith and the community
  mosque: 'mosque', moonstars: 'bedtime', star: 'star', sparkles: 'auto_awesome',
  celebration: 'celebration', balloon: 'festival', candle: 'emoji_objects', pray: 'volunteer_activism',
  heart: 'favorite', friends: 'diversity_3', people: 'groups', community: 'location_city',
  // money and paper
  coin: 'monetization_on', rupee: 'currency_rupee', piggy: 'savings', percent: 'percent',
  discount: 'local_offer', report: 'summarize', invoice: 'receipt_long', calculator: 'calculate',
  scale: 'balance', gavel: 'gavel', briefcase: 'work', building: 'apartment', store: 'storefront',
  tax: 'request_quote', award: 'award_star', factory: 'factory',
  // away from home
  world: 'public', map: 'map', compass: 'explore', luggage: 'luggage', tent: 'camping',
  beach: 'beach_access', mountain: 'landscape', sailboat: 'sailing', rocket: 'rocket_launch',
  umbrella: 'umbrella', snowflake: 'severe_cold', rain: 'rainy',
  // screens
  cpu: 'memory', keyboard: 'keyboard', printer: 'print', devices: 'devices', watch: 'watch',
  photo: 'image', video: 'videocam', radio: 'radio', speaker: 'speaker',
  // animals
  dog: 'pets', cat: 'cruelty_free', horse: 'pets',
};

/* Names the interface draws directly (chevrons, close, warning…). Icon accepts
   these as well as app names. */
export const UI_NAMES = [
  'home', 'receipt_long', 'add', 'group', 'account_balance_wallet', 'diamond',
  'currency_exchange', 'sms', 'rule', 'event_upcoming', 'trending_up', 'chevron_right',
  'chevron_left', 'expand_more', 'expand_less', 'close', 'photo_camera', 'search', 'tune',
  'check_circle', 'event_repeat', 'info', 'arrow_back', 'handshake', 'warning', 'error', 'progress_activity',
  'calendar_month', 'event', 'done_all', 'check', 'circle', 'sell', 'more_horiz',
  'picture_as_pdf', 'add_photo_alternate', 'archive', 'sync_problem', 'account_balance', 'edit', 'photo_library',
  'schedule', 'north_east', 'south_west', 'help', 'content_copy', 'phone_iphone', 'android', 'smartphone', 'lock',
  'trending_down', 'trending_flat', 'logout', 'person_add', 'wifi_off', 'visibility',
  'drag_indicator', 'arrow_upward', 'arrow_downward', 'restore', 'remove', 'document_scanner',
];

/** Every Material name the font must contain: sorted, unique. */
export const MATERIAL_USED: string[] = [...new Set([...Object.values(ICON_NAMES), ...UI_NAMES])].sort();
