"""Launch a local static server and an always-on Chromium browser for manual testing.

Run this in one terminal, then run pytest with --remote-browser to reuse the same
browser instance for automated tests.

    source .venv/Scripts/activate
    python tests/dev_server_browser.py

In another terminal:

    source .venv/Scripts/activate
    pytest tests/ --remote-browser=http://localhost:9222 --slowmo=500

Press Enter in the first terminal to shut down the server and close the browser.
"""

import argparse
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PORT = 8123
REMOTE_DEBUGGING_PORT = 9222


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT_ROOT), **kwargs)

    def log_message(self, format, *args):
        pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--no-input",
        action="store_true",
        help="Keep running without waiting for Enter (useful in non-interactive environments).",
    )
    args = parser.parse_args()

    with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
        server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        server_thread.start()
        print(f"Local server running at http://127.0.0.1:{PORT}")

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=False,
                args=[f"--remote-debugging-port={REMOTE_DEBUGGING_PORT}"],
            )
            page = browser.new_page()
            page.goto(f"http://127.0.0.1:{PORT}")
            print(f"Browser open with remote debugging on port {REMOTE_DEBUGGING_PORT}")

            if args.no_input:
                print("Running in no-input mode. Send SIGINT or stop the process to quit.")
                try:
                    threading.Event().wait()
                except KeyboardInterrupt:
                    pass
            else:
                print("Press Enter to stop the server and close the browser...")
                try:
                    input()
                except EOFError:
                    print("EOF received, keeping server running. Press Ctrl+C to stop.")
                    threading.Event().wait()

            browser.close()

        httpd.shutdown()


if __name__ == "__main__":
    main()
