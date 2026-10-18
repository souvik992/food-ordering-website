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

For testing, override both settings in the address bar: `index.html?hub=http://localhost:4900&store=demo`.

## Demo mode (no hub connection)

If the website cannot reach the order hub when it opens (hub down, wrong address, no internet), it shows a **demo
website** instead of an error: a sample menu with photos (`js/demo.js`, `images/demo/`) where everything works (options,
cart, checkout with the code `123456`, placing orders, live tracking from a pretend kitchen, cancel and reorder). A
warning above the header says orders are **not sent to the restaurant**. Demo carts and orders are kept apart from real
ones. The site keeps checking the hub every 30 seconds and offers a reload once it answers.

Demo mode is only for an unreachable hub. A hub that answers but has no menu yet, or is closed, shows that as usual.
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
