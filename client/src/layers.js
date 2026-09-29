// Which thing sits on top when two of them overlap.
//
// Every overlay used to pick its own number. Fourteen separate places
// independently chose 1000 — nobody chose wrongly, they each chose alone,
// and the numbers only started to matter once two of them could be on
// screen together. That happened when My Bookings grew a drawer: the
// drawer took 1001, the refund, reschedule, extend and rating dialogs were
// still on 1000, and every one of them opened BEHIND the drawer with its
// confirm button out of reach.
//
// So the order lives here instead, as names. Add a rung rather than
// inventing a number at the call site, and leave gaps so one can be added
// between two others without renumbering.
//
// Only page-level overlays belong here. A `zIndex: 2` that stacks a label
// over an image inside one component is local business and should stay
// where it is.
export const LAYERS = {
  nav: 100,          // the sticky header
  navMenu: 200,      // menus hanging off it
  panel: 300,        // sheets and popovers owned by one page
  drawerScrim: 990,  // the dimmed page behind the drawer
  drawer: 1000,      // the My Bookings detail drawer
  modal: 1100,       // a dialog — always above the drawer it was opened from
  modalOver: 1150,   // a dialog opened from another dialog
  floating: 1200,    // a menu that has to clear an open dialog
  toast: 3000,       // confirmations and errors, above everything
};

export default LAYERS;
