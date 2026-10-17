// Static content. The menu itself (CATEGORIES, ITEMS) is loaded from the order hub when the site starts (js/app.js).
window.CATEGORIES = [];
window.ITEMS = [];

// Emoji shown for items without a photo, picked from the item or category name
window.EMOJI_RULES = [
  [/burger/i, '🍔'], [/pizza/i, '🍕'], [/biryani|rice|pulao|thali|meal/i, '🍛'], [/dosa|idli|uttapam|vada/i, '🥞'],
  [/roll|wrap|kathi|frankie/i, '🌯'], [/sandwich|toast/i, '🥪'], [/noodle|chowmein|pasta/i, '🍜'], [/momo|dumpling/i, '🥟'],
  [/fries|chips/i, '🍟'], [/chicken|tandoor|kebab|tikka/i, '🍗'], [/paneer|curry|dal|sabzi/i, '🍲'], [/roti|naan|paratha|bread/i, '🫓'],
  [/salad/i, '🥗'], [/chai|tea/i, '🍵'], [/coffee/i, '☕'], [/lassi|shake|smoothie/i, '🥤'], [/juice/i, '🧃'],
  [/drink|beverage|cola|soda|water/i, '🥤'], [/ice ?cream|kulfi/i, '🍨'], [/cake|pastry|brownie/i, '🍰'],
  [/sweet|dessert|gulab|halwa|jalebi|kheer/i, '🍮'], [/snack|starter|samosa|pakora/i, '🥟'],
];

window.STATUS = {
  PLACED: 'Placed', PAYMENT_PENDING: 'Waiting for payment', PAYMENT_FAILED: 'Payment failed',
  SENT_TO_STORE: 'Sent to the restaurant', RECEIVED: 'Received by the restaurant', ACCEPTED: 'Accepted',
  PREPARING: 'Being prepared', READY: 'Ready', OUT_FOR_DELIVERY: 'Out for delivery', DELIVERED: 'Delivered',
  PICKED_UP: 'Collected', REJECTED: 'Not accepted', AUTO_REJECTED: 'Not accepted in time', CANCELLED: 'Cancelled',
};
window.FINAL_STATES = ['REJECTED', 'AUTO_REJECTED', 'CANCELLED', 'DELIVERED', 'PICKED_UP'];
// The customer can cancel until the restaurant accepts
window.CANCELLABLE_STATES = ['PLACED', 'PAYMENT_PENDING', 'PAYMENT_FAILED', 'SENT_TO_STORE', 'RECEIVED'];

window.FAQS = [
  { q: 'How long does it take?', a: 'You see an estimate before you order. Once the restaurant accepts, the tracking page shows when your food will be ready.' },
  { q: 'How do I pay?', a: 'Pay in cash on delivery, or at the counter when you pick up. Online payment is coming soon.' },
  { q: 'Why do I need to verify my mobile number?', a: 'The restaurant only takes cash orders from verified numbers. You verify once on each device.' },
  { q: 'Can I cancel my order?', a: 'Yes, until the restaurant accepts it. Open the order under My Orders and press Cancel order.' },
  { q: 'Why can I not order right now?', a: 'The restaurant may be closed, outside its opening hours, or not taking online orders at the moment.' },
];
