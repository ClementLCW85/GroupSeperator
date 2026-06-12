# Local Playwright Tests

These tests run against the local project files using a temporary HTTP server.

## Run all tests

```bash
source .venv/Scripts/activate
pytest tests/
```

## Run a single test

```bash
source .venv/Scripts/activate
pytest tests/test_admin.py::test_reassign_leader_updates_page -v
```

## Run in headed mode (see the browser)

```bash
source .venv/Scripts/activate
pytest tests/ --headed
```
