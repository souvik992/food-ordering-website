// Which Tiffin order hub and which store this website takes orders for.
//   hubUrl: the order hub address. Use https:// in production (the POS connects to the same hub).
//   store:  the store's short name on the hub (created with `npm run admin -- create-store <name> "<Store name>"`).
// For testing, both can be overridden in the address bar: index.html?hub=http://localhost:4900&store=demo
window.TIFFIN_CONFIG = {
  hubUrl: 'http://localhost:4900',
  store: 'demo',

  // Optional: what the website says about the restaurant. Empty values are left out.
  heroTitle: 'Freshly cooked, delivered hot',
  heroSubtitle: 'Made to order the moment the kitchen accepts. Delivery or pickup.',
  heroImage: '',   // a wide photo (https://…); without one the first dish photo is used
  about: 'Home-style food cooked fresh in our kitchen every day.',
  phone: '',       // shown in the footer, e.g. '+91 98765 43210'
  address: '',     // shown in the footer and for pickup
};

// Optional photos for menu items, by POS item id: { '<item id>': 'https://.../photo.jpg' }.
// Photos added to items in the POS come from the hub and take priority. Items without a photo show an emoji.
window.ITEM_PHOTOS = {};
