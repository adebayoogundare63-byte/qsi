# Queen's School (Junior) Ibadan Registration Platform

This workspace contains a minimal front-end and Apps Script project scaffold for a school registration platform using GitHub Pages and Google Apps Script.

## Included files

- `index.html` – public registration and admin UI shell
- `style.css` – page styling
- `app.js` – browser logic for registration, admin dashboard, search, class filter, delete confirmation, and actions
- `server.gs` – Google Apps Script backend for student submission, admin auth, dashboard data, deletion, and archived records
- `counter-logic.js` – shared logic for class and admission sequence rules
- `counter.test.js` – Node-based logic tests for the sequence rules

## Deployment

1. Copy the content of `index.html`, `style.css`, and `app.js` into a GitHub Pages repository or static site.
2. Deploy the Google Apps Script contained in `server.gs` to a bound Apps Script project.
3. Add the Google Sheets you need for `Students`, `Settings`, and `Deleted Records`.
4. Update the script URL in the frontend to point to your deployed Apps Script project.
5. Set admin credentials in the Apps Script project and use the admin login flow before administrator actions.

## Important rules implemented

- Admission numbers never reuse deleted values.
- Class assignments follow the JSS1Q, JSS1S, JSS1I, JSS1Y, JSS1N cycle server-side.
- Deletion is only available to authenticated administrators.
- Deleted records are archived to a dedicated `Deleted Records` sheet before active removal.
- LockService is used to guard counter updates against race conditions.

## Local verification

```bash
node --test
```
