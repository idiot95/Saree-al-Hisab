/* The names of the glyphs that load on demand — a plain list, so the pages
   that only need to know "is this one of ours" do not pay for the drawings.
   The drawings themselves are in glyphs-more.tsx, keyed by this list's type,
   so a name without a drawing (or a drawing without a name) fails to compile. */

export const MORE_GLYPHS = [
  // food and the kitchen
  'milk', 'meat', 'fish', 'egg', 'bread', 'fruit', 'vegetables', 'salad', 'pizza', 'burger',
  'icecream', 'cake', 'sweets', 'tea', 'teapot', 'bottle', 'soup', 'cheese', 'chef',
  'fridge', 'cooker', 'microwave',
  // the house
  'bed', 'sofa', 'lamp', 'door', 'key', 'lock', 'bath', 'laundry', 'ironing', 'vacuum',
  'bucket', 'plant', 'flower', 'tree', 'garden', 'hammer', 'paint', 'brush', 'aircon',
  // utilities
  'electricity', 'water', 'gas', 'plug', 'battery', 'dish', 'tv', 'recharge', 'cloud',
  // getting around
  'bus', 'train', 'bicycle', 'scooter', 'motorbike', 'moped', 'parking', 'toll', 'truck',
  'delivery', 'package', 'post', 'ship',
  // health and sport
  'medicine', 'doctor', 'dentist', 'glasses', 'firstaid', 'hospital', 'vaccine',
  'running', 'yoga', 'swimming', 'cricket', 'football', 'tennis',
  // children and learning
  'school', 'backpack', 'notebook', 'books', 'certificate', 'chalkboard', 'abacus', 'baby',
  'toys', 'games', 'ticket', 'cinema', 'art', 'headphones', 'trophy', 'medal',
  // clothes and the person
  'shirt', 'hanger', 'shoes', 'socks', 'sewing', 'perfume', 'razor', 'jewellery', 'crown',
  'sunglasses',
  // faith and the community
  'mosque', 'moonstars', 'star', 'sparkles', 'celebration', 'balloon', 'candle', 'pray',
  'heart', 'friends', 'people', 'community',
  // money and paper
  'coin', 'rupee', 'piggy', 'percent', 'discount', 'report', 'invoice', 'calculator',
  'scale', 'gavel', 'briefcase', 'building', 'store', 'tax', 'award', 'factory',
  // away from home
  'world', 'map', 'compass', 'luggage', 'tent', 'beach', 'mountain', 'sailboat', 'rocket',
  'umbrella', 'snowflake', 'rain',
  // screens
  'cpu', 'keyboard', 'printer', 'devices', 'watch', 'photo', 'video', 'radio', 'speaker',
  // animals
  'dog', 'cat', 'horse',
] as const;
