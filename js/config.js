// Which Tiffin order hub and which store this website takes orders for.
//   hubUrl: the order hub address. Use https:// in production (the POS connects to the same hub).
//   store:  the store's short name on the hub (created with `npm run admin -- create-store <name> "<Store name>"`).
// For testing, both can be overridden in the address bar: index.html?hub=http://localhost:4900&store=demo
window.TIFFIN_CONFIG = {
  hubUrl: 'http://localhost:4900',
  store: 'demo',
};

// Optional photos for menu items, by POS item id: { '<item id>': 'https://.../photo.jpg' }.
// Items without a photo show an emoji. (The hub menu does not carry photos yet.)
window.ITEM_PHOTOS = {};
