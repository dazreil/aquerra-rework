# Project Startup Checklist

Use this before starting a new Codex-assisted web/game project so the setup is clean, deployable, and does not require carrying a huge chat context.

## 1. Create the project folder

Pick a clear local folder name, for example:

```text
~/Documents/Codex/my-new-project
```

Keep one project per folder.

## 2. Create a GitHub repository first

On GitHub:

1. Create a new repository.
2. Use a clear repo name.
3. Choose private or public.
4. Add a README if you want.
5. Copy the repo URL.

Example:

```text
https://github.com/YOUR_USERNAME/YOUR_REPO.git
```

## 3. Tell Codex the repo URL at the start

Start the project by saying something like:

```text
This is a new project. Use this folder:
/path/to/project

GitHub repo:
https://github.com/YOUR_USERNAME/YOUR_REPO.git

Please initialize Git, add a .gitignore, commit the starting scaffold, and push to GitHub.
```

## 4. Give Codex temporary GitHub access only if needed

If Codex cannot push because GitHub CLI is not logged in, create a short-lived GitHub token:

GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token

Use:

- Repository access: only the new repo
- Contents: Read and write
- Metadata: Read-only/default
- Expiry: 1 day if possible

After Codex pushes successfully, revoke the token.

Do not use SSH or GPG keys for temporary Codex access.

## 5. Create the deploy target early

For a Vite/Phaser/static web project, Netlify works well.

Recommended:

1. Push the project to GitHub.
2. In Netlify, create a new project from GitHub.
3. Pick the repo.
4. Use:

```text
Build command: pnpm run build
Publish directory: dist
```

Add this file to the repo:

```toml
# netlify.toml
[build]
  command = "pnpm run build"
  publish = "dist"
```

After this, every GitHub push deploys automatically.

## 6. Avoid manual deploys once GitHub sync exists

Manual Netlify deploys are fine for quick experiments, but for real project flow use:

```bash
git add .
git commit -m "Describe change"
git push
```

Then Netlify deploys from GitHub.

## 7. Keep dependencies and build commands explicit

Every project should have:

- `package.json`
- lockfile, usually `pnpm-lock.yaml`
- `.gitignore`
- `README.md`
- deploy config, if needed
- a clear run command
- a clear build command

For Vite:

```json
{
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc && vite build",
    "preview": "vite preview --host 127.0.0.1"
  }
}
```

## 8. Create a handoff file immediately

Ask Codex to create:

```text
SESSION_HANDOFF.md
```

It should include:

- project goal
- current features
- important files
- run/build/deploy commands
- live URL
- GitHub repo URL
- known issues
- next likely work

At the end of a session, ask Codex:

```text
Update SESSION_HANDOFF.md so we can resume later without loading the full context.
```

At the start of the next session, say:

```text
Read SESSION_HANDOFF.md and continue from there.
```

## 9. Decide desktop vs web controls early

For browser games/tools, avoid depending only on:

- right-click
- hover
- shift-click
- alt-click
- tiny click targets

Prefer:

- visible mode buttons
- tap-friendly controls
- HTML UI for inventory/toolbars
- keyboard/mouse shortcuts as optional extras

## 10. End every working session with these checks

Ask Codex to:

1. Run the build.
2. Commit changes.
3. Push to GitHub.
4. Confirm Netlify deployed, if connected.
5. Update `SESSION_HANDOFF.md`.

Good closing prompt:

```text
Run the build, commit and push the current work, confirm deployment status, and update SESSION_HANDOFF.md.
```

