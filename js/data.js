// Demo menu data. Swap this for an API call when you add a backend.
const img = (id, w = 700) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;

window.CATEGORIES = [
  { id: 'all', name: 'All', emoji: '🍽️' },
  { id: 'food', name: 'Food', emoji: '🍔' },
  { id: 'grocery', name: 'Grocery', emoji: '🥬' },
  { id: 'drinks', name: 'Drinks', emoji: '🥤' },
  { id: 'desserts', name: 'Desserts', emoji: '🍰' },
  { id: 'stores', name: 'Stores', emoji: '🛒' },
];

window.ITEMS = [
  {
    id: 1, name: 'Street Tacos', by: 'Taco Fiesta', category: 'food',
    price: 7.0, rating: 4.7, reviews: 2300, time: 25, type: 'Bike', emoji: '🌮',
    image: img('1551504734-5ee1c4a1479b'),
    description: 'Soft flour tortillas loaded with grilled beef, crisp lettuce, red onion, peppers and our house salsa. Fresh, bold and made to order every single time.',
  },
  {
    id: 2, name: 'Smash Burger', by: 'Burger Barn', category: 'food',
    price: 15.0, rating: 4.7, reviews: 1840, time: 30, type: 'Bike', emoji: '🍔',
    image: img('1568901346375-23c9450c58cd'),
    description: 'Two smashed beef patties, melted cheddar, pickles, caramelised onions and secret sauce on a toasted brioche bun. Served with crispy fries.',
  },
  {
    id: 3, name: 'Salmon Sushi Rolls', by: 'Sushi Zen', category: 'food',
    price: 12.5, rating: 4.8, reviews: 960, time: 35, type: 'Car', emoji: '🍣',
    image: img('1579871494447-9811cf80d66c'),
    description: 'Eight pieces of hand-rolled sushi with fresh salmon, avocado and cucumber. Comes with soy sauce, wasabi and pickled ginger.',
  },
  {
    id: 4, name: 'Margherita Pizza', by: "Nonna's Oven", category: 'food',
    price: 11.0, rating: 4.6, reviews: 3120, time: 28, type: 'Bike', emoji: '🍕',
    image: img('1565299624946-b28f40a0ae38'),
    description: 'Wood-fired thin crust topped with San Marzano tomatoes, fresh mozzarella, basil and a drizzle of extra-virgin olive oil.',
  },
  {
    id: 5, name: 'Green Power Bowl', by: 'Leaf & Co', category: 'food',
    price: 9.0, rating: 4.5, reviews: 640, time: 20, type: 'Bike', emoji: '🥗',
    image: img('1512621776951-a57141f2eefd'),
    description: 'Quinoa, avocado, chickpeas, cherry tomatoes, cucumber and leafy greens with a zesty lemon-tahini dressing.',
  },
  {
    id: 6, name: 'Fresh Strawberries', by: 'Green Market', category: 'grocery',
    price: 3.5, rating: 4.8, reviews: 410, time: 15, type: 'Bike', emoji: '🍓',
    image: img('1464965911861-746a04b4bca6'),
    description: 'A 500g punnet of sweet, juicy strawberries picked this morning from local farms. Perfect for snacking, smoothies or desserts.',
  },
  {
    id: 7, name: 'Iced Latte', by: 'Bean There', category: 'drinks',
    price: 4.2, rating: 4.6, reviews: 780, time: 12, type: 'Bike', emoji: '🧋',
    image: img('1461023058943-07fcbe16d735'),
    description: 'Double-shot espresso poured over ice and cold milk. Add a pump of vanilla or caramel at checkout.',
  },
  {
    id: 8, name: 'Berry Pancakes', by: 'Morning Stack', category: 'desserts',
    price: 8.5, rating: 4.9, reviews: 1290, time: 22, type: 'Bike', emoji: '🥞',
    image: img('1567620905732-2d1ec7ab7445'),
    description: 'Three fluffy buttermilk pancakes topped with fresh berries, whipped butter and warm maple syrup.',
  },
  {
    id: 9, name: 'Weekly Essentials Box', by: 'FreshMart', category: 'stores',
    price: 24.0, rating: 4.4, reviews: 220, time: 40, type: 'Van', emoji: '🛒',
    image: img('1542838132-92c53300491e'),
    description: 'Milk, eggs, bread, seasonal fruit and vegetables: everything you need for the week, delivered to your door in one box.',
  },
];

window.COURIER = { name: 'Mitchel Santnar', id: '13256626' };
window.DELIVERY_FEE = 2.0;
window.VOUCHERS = { GOOD10: 0.1, FOODIE20: 0.2 }; // code -> discount
