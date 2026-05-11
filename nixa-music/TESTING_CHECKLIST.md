# Testing Checklist

## Auth

- [ ] Admin login works.
- [ ] Artist login only opens artist routes.
- [ ] Label login only opens label routes.
- [ ] Accountant login only opens finance/payout routes.
- [ ] Forgot password generates a reset link.
- [ ] Reset password updates credentials and rejects expired tokens.

## Catalog

- [ ] Artist submits release.
- [ ] Label submits release.
- [ ] Admin approves release.
- [ ] Admin rejects release with notes.
- [ ] Catalog search and filters work.

## Revenue

- [ ] CSV upload accepts valid reports.
- [ ] CSV upload rejects invalid files.
- [ ] Revenue rows are parsed.
- [ ] Calculated revenues are generated.
- [ ] Revenue imports preserve history.

## Finance

- [ ] Split creation validates total percentage.
- [ ] Split history is preserved.
- [ ] Recalculation updates finance summary.
- [ ] Artist and label statements load.
- [ ] Finance report export works.

## Payouts & Invoices

- [ ] Pending payouts appear in queue.
- [ ] Manual payout validates payable balance.
- [ ] Payout status changes create logs.
- [ ] Invoice generation creates invoice number.
- [ ] Invoice download works.

## Management

- [ ] Admin creates user.
- [ ] Admin disables/enables user.
- [ ] Admin resets password.
- [ ] Admin creates artist profile.
- [ ] Admin creates label profile.
- [ ] Admin assigns artist to label.
- [ ] Profile page loads for each role.

## Notifications & Audit

- [ ] Notification bell shows unread count.
- [ ] Notification page filters unread items.
- [ ] Mark all read works.
- [ ] Audit logs show login and management actions.
- [ ] Audit search/filter works.

## Responsive UI

- [ ] Admin dashboard works on desktop.
- [ ] Tables scroll cleanly on tablet/mobile.
- [ ] Sidebar opens and closes on mobile.
- [ ] Forms do not overflow on small screens.
