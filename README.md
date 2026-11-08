# Smart HR System

Arabic RTL HR management workspace built with HTML, Tailwind utility classes, vanilla JavaScript and Google Apps Script / Google Sheets.

## Main modules
- Dashboard and workforce analytics
- Employee records
- Leave requests and approvals
- Penalties and violations
- Recruitment and S.T.A.R. interview evaluation
- Company forms and documents
- User accounts and permissions
- AI assistant (OpenRouter)

## Frontend structure
- `index.html` — application shell, login, navigation, notifications and AI assistant
- `views/` — module markup loaded into the application shell
- `js/` — module logic and API adapter
- `css/style.css` — legacy base styles
- `css/design-system.css` — base design tokens and components
- `css/hris-overhaul.css` — previous unified styling layer
- `css/modern-hris.css` — complete v3 visual system: rebuilt login experience, application shell, shared module surfaces, responsive RTL and comprehensive dark mode
- `apps_script_backend/Code.gs` — Apps Script API and business logic

## Deployment
1. Publish the frontend from the `gh-pages` branch using GitHub Pages.
2. Set the Apps Script deployment URL in `js/config.js`.
3. Copy `apps_script_backend/Code.gs` into the bound Apps Script project.
4. Save and create a new Apps Script deployment version after every backend change.
5. Verify GitHub Actions and test the deployed frontend and Apps Script API together.

## Security notes
- The API dispatcher uses server-side cached sessions and a permission map.
- User administration and global settings are Admin-only; a generic settings permission is not sufficient to create or delete accounts.
- AI receives aggregate workforce statistics only. Employee names, employee codes, individual salaries, account lists and source code are not sent to the external model.
- Dashboard-only responses omit individual salary and health-certificate fields; the payroll dashboard is hidden for non-Admin sessions.
- Employee self-service login still uses employee code only. Add a second factor/PIN before broad production rollout.
- Existing Drive files shared as “Anyone with the link” must be audited separately; code changes cannot revoke old file permissions.
- Apps Script password hashes currently use the project’s compatibility hash format. For high-assurance production use, migrate to a standard password KDF and add login throttling / lockout.

## Validation
Static JavaScript syntax checks can be run with Node.js using `new Function(source)` for each JavaScript file. This is not a substitute for browser testing, Apps Script authorization checks, or end-to-end tests against the production spreadsheet.

## Data protection
Use least-privilege Google Drive and spreadsheet sharing. Do not expose the Apps Script deployment editor or the underlying HR spreadsheet to ordinary employees. Back up the spreadsheet before schema or bulk data changes.
