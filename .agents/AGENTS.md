# Git and Build Publishing Restrictions

- **NO AUTOMATIC PUSH OR PUBLISH:** Do NOT run `git push` or `electron publish` under any circumstances unless explicitly and directly instructed by the user. 
  - **CRITICAL SUB-RULE:** Even if the user requested a push or build earlier in the conversation, if you have modified ANY code since that request, you MUST STOP and ask the user "Are you ready for me to build/push?" before executing the commands.
- **NO ELECTRON BUILDS:** Do NOT run `npm run build`, `npx electron-builder`, or any script that builds the Electron app, UNLESS the user explicitly and clearly tells you to do so right at the moment of execution.
- **RELEASE RULES:** When explicitly asked to build/release, always strictly adhere to the procedures and naming conventions documented in `c:\Users\sawar\MyProjects\student-report\release_Rules.md`.
