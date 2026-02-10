# pipe-works-org

pipe-works.org is a public workbench: writing code with the garage door up, documenting coding failures, small goblin successes, and experiments in public.

It also showcases snippets from the PipeWorks MUD server before my world, The Daily Undertaking, is officially open for play.

## Goblin Reminder: How GH Magiks Update The Site

- Any push to `main` triggers the Deploy workflow.
- GitHub Actions uses SSH + `rsync` to publish the contents of `site/` as the web root on the Mythic Beasts host.
- The workflow lives at `/Users/aapark/pipe-works-development/pipe-works-org/.github/workflows/deploy.yml`.
- Manual deploys are possible via “Run workflow” in the GitHub Actions UI.
