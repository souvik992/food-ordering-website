# Online ordering website

A mobile-first ordering website for one restaurant. Orders go to the **Tiffin order hub**, which sends them live to the
restaurant's Tiffin POS, where they appear on the **ODS** screen. Accepting there prints the GST bill and the kitchen ticket.
The customer then follows the order here live: accepted, being prepared, ready, out for delivery (with the rider's name and
phone), and delivered or collected.

No build step: plain HTML, CSS and JavaScript. Host the folder on any static web host (https).

## Set up

1. In `js/config.js`, set `hubUrl` (the order hub address) and `store` (the store's short name on the hub).
2. In the POS: **Settings > Online orders**: turn online orders on, tick **Website**, pair with the hub, and set up
   **Serviceability** (store location, delivery distances and fees, opening hours).
3. Open a shift in the POS. Customers can only order while a shift is open and the store is within its opening hours.

For testing, override both settings in the address bar: `index.html?hub=http://localhost:4900&store=demo`.

## What comes from where

| Thing | Source |
|---|---|
| Menu, categories, prices, veg / non-veg, options (add-ons, sizes) | The POS menu, through the hub |
| Totals, delivery fee, packaging, GST | A quote from the hub (the same calculation as the POS bill) |
| Mobile verification | 6-digit code from the hub (valid 30 days on this device) |
| Order status, rider, bill number | The hub, live (Server-Sent Events) |
| Photos | Optional, `ITEM_PHOTOS` in `js/config.js`; otherwise an emoji |

The website never works out a total itself. If a price changes between the cart and placing the order, the hub refuses
the order and the website shows the new total.

## Not available yet

- Online payment (UPI, cards): cash on delivery or at pickup only.
- SMS for the verification code: the hub needs an SMS provider before real customers can sign in. In the hub's test mode
  the code is shown on screen.
- Coupons / vouchers and scheduled orders: the hub does not support them yet.
- Picking the delivery location on a map: the location comes from the phone (GPS) or is typed in.
