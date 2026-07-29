# Git and Build Publishing Restrictions

- **NO AUTOMATIC PUSH OR PUBLISH:** Do NOT run `git push` or `electron publish` under any circumstances unless explicitly and directly instructed by the user.
- **ELECTRON BUILDER:** Always use `npx electron-builder` (or `npm run build` followed by `npx electron-builder`) for packaging the app. 
- **RELEASE RULES:** When discussing or executing a build/release, always strictly adhere to the procedures and naming conventions documented in `c:\Users\sawar\MyProjects\student-report\release_Rules.md`.
