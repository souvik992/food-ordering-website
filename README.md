# Online ordering website

A mobile-first ordering website for one restaurant. Orders go to the **Tiffin order hub**, which sends them live to the
restaurant's Tiffin POS, where they appear on the **ODS** screen. Accepting there prints the GST bill and the kitchen ticket.
The customer then follows the order here live: accepted, being prepared, ready, out for delivery (with the rider's name and
phone), and delivered or collected.

The design follows the laCafe restaurant website template (warm orange palette, Plus Jakarta Sans): a main page with the
menu, category chips and a sticky cart; a one-page checkout with a sticky summary; order info with a live status timeline;
and order history. On phones the same components stack, with a bottom cart bar.

No build step: plain HTML, CSS and JavaScript. Host the folder on any static web host (https).

## Set up

1. In `js/config.js`, set `hubUrl` (the order hub address) and `store` (the store's short name on the hub). Optionally set
   the hero title, subtitle and photo, a short "about" line, and the phone number and address shown in the footer.
2. In the POS: **Settings > Online orders**: turn online orders on, tick **Website**, pair with the hub, and set up
   **Serviceability** (store location, delivery distances and fees, opening hours).
3. Open a shift in the POS. Customers can only order while a shift is open and the store is within its opening hours.

**Design the website in the website builder** at `<website address>/admin` (for example
`https://order.example.com/admin`). Sign in with the store's **website editor password**: the hub admin makes it on the
hub admin page (Stores > the store > New editor password) or with `npm run admin -- site-password <store>` on the hub.
In the builder, beside a live preview (computer, tablet or phone size):

- **Sections:** add, drag to reorder, hide and edit the home page sections: hero banner, featured dishes, menu (always
  there), about us, photo gallery, reviews, opening hours (from the POS), contact and map, questions (FAQ), text block;
  plus an announcement bar above the header.
- **Theme:** ready-made looks, colours, fonts, corners, button shape, header style.
- **Brand & SEO:** restaurant name, tagline, logo, browser tab icon, Google title and description, sharing picture.
- **Contact:** phone, WhatsApp, email, address, Google Maps link, Instagram, Facebook, YouTube, footer text.
- **Menu:** cards or list, and whether dish photos, descriptions, veg marks and category buttons show.

Photos are uploaded from the computer or phone (made smaller first). Changes are kept as a draft; **Publish** makes them
live, and customers see them the next time they open or reload the website. Undo / Redo and Discard are there too. The
menu, prices, dish photos and opening hours still come from the POS. Only `hubUrl`, `store` and `demo` stay in
`js/config.js` (the website needs them before it can reach the hub); its other values are used only until a design is
published.

For testing, override both settings in the address bar: `index.html?hub=http://localhost:4900&store=demo`.

## Several outlets: one website, orders go to the nearest outlet

Make a **brand** on the hub's admin page (Brands: add the brand, then add its outlets), then in `js/config.js` set
`brand: '<brand address>'` instead of `store` (or test with `index.html?hub=...&brand=<brand>`).

- On the first visit the site asks where the customer is (phone location, the map position typed in, or a saved
  address) and whether they want delivery or pickup.
- The hub chooses the outlet: for delivery the nearest outlet that is open and delivers to the delivery address, for
  pickup the nearest open outlet. The menu page and checkout say "Delivered from <outlet> · x km away · Change"; for
  pickup the header says "Pickup from <outlet>".
- The menu, prices and totals are that outlet's own. When the address or delivery/pickup changes, the outlet is chosen
  again; items the new outlet does not sell are taken out of the cart (the customer is told).
- If the choice changed just before ordering (an outlet closed or opened), nothing is placed: the site switches to the
  new outlet and shows its total. If no outlet can take the order, the customer is told why.
- The website design is the brand's main outlet's (set on the hub admin page). Carts, favourites, sign-in and orders
  are kept per brand, so switching outlets keeps them. Demo mode (`?demo=1`) ignores the brand.

## Demo mode (no hub connection)

Demo mode is **off in production** (`demo: false` in `js/config.js`): orders and their live status always come from
the hub and the POS ODS, and if the hub cannot be reached the site says so and loads the real menu as soon as it
answers. Turn it on with `demo: true`, or add `?demo=1` to the address, for previews.

When it is on: if the website cannot reach the order hub when it opens (hub down, wrong address, no internet), or the hub answers
but the store has no menu yet (the POS has not been paired and published its menu), it shows a **demo website**
instead of an error: a sample menu with photos (`js/demo.js`, `images/demo/`) where everything works (options,
cart, checkout with the code `123456`, placing orders, live tracking from a pretend kitchen, cancel and reorder). A
warning above the header says orders are **not sent to the restaurant**. Demo carts and orders are kept apart from real
ones. The site keeps checking the hub every 30 seconds and offers a reload once it answers.

A store that has a menu but is closed or offline shows its real menu with the closed notice, not the demo.
Photo credits: `images/demo/CREDITS.md`.

## What comes from where

| Thing | Source |
|---|---|
| Menu, categories, prices, veg / non-veg, options (add-ons, sizes) | The POS menu, through the hub |
| Totals, delivery fee, packaging, GST | A quote from the hub (the same calculation as the POS bill) |
| Mobile verification | 6-digit code from the hub (valid 30 days on this device) |
| Order status, rider, bill number | The hub, live (Server-Sent Events) |
| Photos, descriptions | Item photos and descriptions from the POS menu (through the hub); `ITEM_PHOTOS` in `js/config.js` as a fallback; otherwise an emoji |
| Opening hours, kitchen ETA | The POS serviceability settings, through the hub |

The website never works out a total itself. If a price changes between the cart and placing the order, the hub refuses
the order and the website shows the new total.

## Not available yet

- Online payment (UPI, cards): cash on delivery or at pickup only.
- SMS for the verification code: the hub needs an SMS provider before real customers can sign in. In the hub's test mode
  the code is shown on screen.
- Coupons / vouchers and scheduled orders: the hub does not support them yet.
- Picking the delivery location on a map: the location comes from the phone (GPS) or is typed in.
