// The website design: its default, the section types and the fields the builder (admin/) shows for each.
// The order hub checks every saved design against the same rules (tiffin hub/src/site.ts): keep the two in step.
window.SiteSchema = (function () {
  'use strict';

  const FONTS = ['Plus Jakarta Sans', 'Poppins', 'Inter', 'DM Sans', 'Nunito', 'Montserrat', 'Lora', 'Playfair Display'];

  // [key, label, kind, extra] — kind: text | textarea | image | images | choice | toggle | color | font | dishes | list | stars
  const SECTIONS = {
    hero: {
      label: 'Hero banner', icon: '🖼️', about: 'A big photo with your headline, at the top of the page.',
      fields: [['title', 'Headline', 'text', 80], ['subtitle', 'Subtitle', 'textarea', 200], ['image', 'Background photo', 'image', 'wide'],
        ['buttonText', 'Button text', 'text', 30, 'Scrolls to the menu. Empty: no button.'], ['align', 'Text position', 'choice', [['left', 'Left'], ['center', 'Centre']]]],
    },
    featured: { label: 'Featured dishes', icon: '⭐', about: 'Up to 12 dishes you want customers to see first.', fields: [['title', 'Title', 'text', 60], ['itemIds', 'Dishes', 'dishes', 12]] },
    menu: { label: 'Menu', icon: '📋', about: 'Your dishes from the POS, with the cart. Every page needs it.', fixed: true, fields: [['title', 'Title above the menu', 'text', 60, 'Empty: no title.']] },
    about: { label: 'About us', icon: '👋', about: 'Your story, with a photo.', fields: [['title', 'Title', 'text', 60], ['text', 'Text', 'textarea', 1500], ['image', 'Photo', 'image', 'wide']] },
    gallery: { label: 'Photo gallery', icon: '📷', about: 'Up to 12 photos of your food and place.', fields: [['title', 'Title', 'text', 60], ['images', 'Photos', 'images', 12]] },
    reviews: {
      label: 'Reviews', icon: '💬', about: 'What your customers say.',
      fields: [['title', 'Title', 'text', 60], ['items', 'Reviews', 'list', { max: 12, add: 'Add a review', fields: [['name', 'Name', 'text', 40], ['text', 'Review', 'textarea', 300], ['rating', 'Stars', 'stars']], blank: { name: '', text: '', rating: 5 } }]],
    },
    hours: { label: 'Opening hours', icon: '🕒', about: 'Your hours for each day, from the POS.', fields: [['title', 'Title', 'text', 60]] },
    contact: { label: 'Contact & map', icon: '📍', about: 'Address, phone, WhatsApp and a map (set them under Contact).', fields: [['title', 'Title', 'text', 60], ['showMap', 'Show a map', 'toggle']] },
    faq: {
      label: 'Questions (FAQ)', icon: '❓', about: 'Answers to what customers often ask.',
      fields: [['title', 'Title', 'text', 60], ['items', 'Questions', 'list', { max: 20, add: 'Add a question', fields: [['q', 'Question', 'text', 150], ['a', 'Answer', 'textarea', 600]], blank: { q: '', a: '' } }]],
    },
    text: { label: 'Text block', icon: '📝', about: 'A title and some text: offers, catering, anything.', fields: [['title', 'Title', 'text', 80], ['text', 'Text', 'textarea', 2000]] },
  };

  const blank = (kind, extra) => (kind === 'toggle' ? false : kind === 'stars' ? 1 : ['images', 'dishes', 'list'].includes(kind) ? [] : kind === 'choice' ? extra[0][0] : '');
  const TITLES = { featured: 'Our favourites', menu: 'Menu', about: 'About us', gallery: 'Gallery', reviews: 'What our customers say', hours: 'Opening hours', contact: 'Find us', faq: 'Questions', text: '' };

  function newSection(type, id) {
    const s = { id, type, hidden: false };
    for (const [k, , kind, extra] of SECTIONS[type].fields) s[k] = blank(kind, extra);
    if (type in TITLES) s.title = TITLES[type];
    if (type === 'hero') Object.assign(s, { title: 'Freshly cooked, delivered hot', subtitle: 'Made to order the moment the kitchen accepts. Delivery or pickup.', buttonText: 'Order now' });
    if (type === 'contact') s.showMap = true;
    return s;
  }

  const DEFAULT = {
    v: 1,
    theme: { primary: '#f5a85c', accent: '#e08733', text: '#17181a', background: '#ffffff', font: 'Plus Jakarta Sans', headingFont: 'Plus Jakarta Sans', radius: 'rounded', buttons: 'rounded', header: 'light' },
    brand: { name: '', tagline: '', logo: '', favicon: '', seoTitle: '', seoDescription: '', shareImage: '' },
    contact: { phone: '', whatsapp: '', email: '', address: '', mapUrl: '', instagram: '', facebook: '', youtube: '', footerText: '' },
    menu: { layout: 'grid', showPhotos: true, showDescriptions: true, showVeg: true, showCategoryChips: true },
    bar: { show: false, text: '', link: '' },
    sections: [newSection('hero', 'hero'), newSection('menu', 'menu')],
  };

  // One-click looks for the Theme tab
  const PRESETS = [
    { name: 'Saffron', theme: { primary: '#f5a85c', accent: '#e08733', text: '#17181a', background: '#ffffff', font: 'Plus Jakarta Sans', headingFont: 'Plus Jakarta Sans', radius: 'rounded', buttons: 'rounded', header: 'light' } },
    { name: 'Chilli', theme: { primary: '#c62828', accent: '#8e1c1c', text: '#1d1b1a', background: '#fffaf5', font: 'Poppins', headingFont: 'Poppins', radius: 'soft', buttons: 'pill', header: 'brand' } },
    { name: 'Mint', theme: { primary: '#16865a', accent: '#0f5f40', text: '#14201b', background: '#ffffff', font: 'Nunito', headingFont: 'Nunito', radius: 'rounded', buttons: 'pill', header: 'light' } },
    { name: 'Midnight', theme: { primary: '#d4a24c', accent: '#a87b2c', text: '#1b1b1f', background: '#fbfaf7', font: 'Inter', headingFont: 'Playfair Display', radius: 'soft', buttons: 'square', header: 'dark' } },
    { name: 'Café', theme: { primary: '#7a4b2a', accent: '#5a361d', text: '#2a1d14', background: '#fbf6ef', font: 'DM Sans', headingFont: 'Lora', radius: 'soft', buttons: 'rounded', header: 'light' } },
    { name: 'Minimal', theme: { primary: '#111111', accent: '#444444', text: '#111111', background: '#ffffff', font: 'Inter', headingFont: 'Inter', radius: 'square', buttons: 'square', header: 'light' } },
  ];

  const clone = (o) => JSON.parse(JSON.stringify(o));
  /** A design from the hub, or the default when there is none (an older hub, demo mode). Missing parts get their default. */
  function normalise(site) {
    if (!site || site.v !== 1 || !Array.isArray(site.sections)) return clone(DEFAULT);
    const d = clone(DEFAULT);
    return { v: 1, theme: { ...d.theme, ...site.theme }, brand: { ...d.brand, ...site.brand }, contact: { ...d.contact, ...site.contact },
      menu: { ...d.menu, ...site.menu }, bar: { ...d.bar, ...site.bar }, sections: site.sections.filter((s) => SECTIONS[s.type]).map((s) => ({ ...newSection(s.type, s.id), ...s })) };
  }

  return { FONTS, SECTIONS, PRESETS, DEFAULT, newSection, normalise, clone };
})();
