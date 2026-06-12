# Local Playwright Tests

These tests run against the local project files using a temporary HTTP server.

## Run all tests once (headless)

```bash
source .venv/Scripts/activate
pytest tests/
```

## Run a single test

```bash
source .venv/Scripts/activate
pytest tests/test_admin.py::test_reassign_leader_updates_page -v
```

## View the browser while testing

```bash
source .venv/Scripts/activate
pytest tests/ --headed --slowmo 500
```

- `--headed` opens a visible browser window.
- `--slowmo 500` pauses 500 ms between actions so you can follow what is happening.

## Keep one browser open and reuse it for every test run

### 1. Start the dev server + browser

In one terminal:

```bash
source .venv/Scripts/activate
python tests/dev_server_browser.py
```

This opens a Chromium window and keeps it alive. The browser exposes remote debugging on `http://localhost:9222`.

### 2. Run tests in the same browser

In another terminal:

```bash
source .venv/Scripts/activate
pytest tests/ --remote-browser=http://localhost:9222 --slowmo=500
```

After the tests finish, the browser window stays open. You can continue testing manually, then run pytest again — it will reuse the same browser.

### 3. Stop the dev server

Press `Enter` in the first terminal to close the browser and shut down the server.

## Hot reload with a persistent browser

Combine `ptw` with the remote browser. First start the dev browser, then:

```bash
source .venv/Scripts/activate
ptw tests/ --ext=.py,.js,.html,.css,.json -- --remote-browser=http://localhost:9222 --slowmo=500
```

Now every time you change `app.js`, `index.html`, or test files, the tests re-run in the same open browser.

## Hot reload with a new browser each run

If you don't need to reuse the same browser, use `ptw` with `--headed`:

```bash
source .venv/Scripts/activate
ptw tests/ --ext=.py,.js,.html,.css,.json -- --headed --slowmo 500
```

Press `Ctrl+C` to stop watching.
