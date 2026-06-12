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

## Hot reload (auto re-run tests on file changes)

```bash
source .venv/Scripts/activate
ptw tests/ --ext=.py,.js,.html,.css,.json -- --headed --slowmo 500
```

`ptw` watches the project for changes and re-runs pytest automatically. Any pytest options go after `--`.

- `--ext=.py,.js,.html,.css,.json` makes it re-run when source files change (default is `.py` only).
- `--headed --slowmo 500` opens the browser so you can watch the test run.

For example, to watch only `app.js` and `index.html` changes:

```bash
source .venv/Scripts/activate
ptw tests/ app.js index.html --ext=.py,.js,.html -- --headed --slowmo 500
```

Press `Ctrl+C` to stop watching.
