import http.server
import socketserver
import threading
from pathlib import Path

import pytest


PROJECT_ROOT = Path(__file__).resolve().parent.parent


def pytest_addoption(parser):
    parser.addoption(
        "--remote-browser",
        action="store",
        default=None,
        help="CDP URL of an already running Chromium browser (e.g. http://localhost:9222)",
    )


@pytest.fixture(scope="session")
def browser(browser_type, request):
    """Launch a browser or connect to an existing remote Chromium instance."""
    remote_url = request.config.getoption("--remote-browser")
    headed = request.config.getoption("--headed")
    slow_mo = request.config.getoption("--slowmo")

    if remote_url:
        browser = browser_type.connect_over_cdp(remote_url)
        yield browser
        # Keep the remote browser alive for manual testing.
        return

    browser = browser_type.launch(
        headless=not headed,
        slow_mo=slow_mo,
    )
    yield browser
    browser.close()


DEV_SERVER_PORT = 8123
TEST_SERVER_PORT = 8124


@pytest.fixture(scope="session")
def base_url(request):
    """Return the URL for the dev server or start a temporary test server."""
    remote_url = request.config.getoption("--remote-browser")
    if remote_url:
        # Reuse the dev server started by dev_server_browser.py.
        yield f"http://127.0.0.1:{DEV_SERVER_PORT}"
        return

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(PROJECT_ROOT), **kwargs)

        def log_message(self, format, *args):
            pass

    with socketserver.TCPServer(("127.0.0.1", TEST_SERVER_PORT), Handler) as httpd:
        server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        server_thread.start()
        yield f"http://127.0.0.1:{TEST_SERVER_PORT}"
        httpd.shutdown()


@pytest.fixture
def mock_data():
    """Small deterministic dataset for admin tests."""
    return {
        "roster": [
            {
                "number": 1,
                "name_english": "Alice",
                "name_chinese": "",
                "small_group_leader": "Ps Alan",
                "age_group": "Adult",
                "gender": "female",
            },
            {
                "number": 2,
                "name_english": "Bob",
                "name_chinese": "",
                "small_group_leader": "Ps Alan",
                "age_group": "Adult",
                "gender": "male",
            },
            {
                "number": 3,
                "name_english": "Carol",
                "name_chinese": "",
                "small_group_leader": "Hui Yee",
                "age_group": "Young Adult",
                "gender": "female",
            },
            {
                "number": 4,
                "name_english": "David",
                "name_chinese": "",
                "small_group_leader": "Hui Yee",
                "age_group": "Young Adult",
                "gender": "male",
            },
        ],
        "game_event": {
            "groups": [
                {
                    "id": 1,
                    "name": "Love",
                    "capacity": 10,
                    "member_count": 2,
                    "leader_number": 1,
                    "leader_name_english": "Alice",
                    "leader_name_chinese": "",
                    "fruit_key": "strawberry",
                    "fruit_name": "Strawberry",
                    "fruit_asset": "assets/fruits/strawberry.svg",
                },
                {
                    "id": 2,
                    "name": "Joy",
                    "capacity": 10,
                    "member_count": 2,
                    "leader_number": 3,
                    "leader_name_english": "Carol",
                    "leader_name_chinese": "",
                    "fruit_key": "watermelon",
                    "fruit_name": "Watermelon",
                    "fruit_asset": "assets/fruits/watermelon.svg",
                },
            ],
            "participants": [
                {
                    "number": 1,
                    "name_english": "Alice",
                    "name_chinese": "",
                    "small_group_leader": "Ps Alan",
                    "age_group": "Adult",
                    "gender": "female",
                    "game_event_group_id": 1,
                    "game_event_group_name": "Love 仁爱",
                    "game_event_group_leader_number": 1,
                    "game_event_group_leader_name_english": "Alice",
                    "game_event_group_leader_name_chinese": "",
                    "game_event_group_fruit_key": "strawberry",
                    "game_event_group_fruit_name": "Strawberry",
                    "game_event_group_fruit_asset": "assets/fruits/strawberry.svg",
                    "game_event_group_is_leader": True,
                },
                {
                    "number": 2,
                    "name_english": "Bob",
                    "name_chinese": "",
                    "small_group_leader": "Ps Alan",
                    "age_group": "Adult",
                    "gender": "male",
                    "game_event_group_id": 1,
                    "game_event_group_name": "Love 仁爱",
                    "game_event_group_leader_number": 1,
                    "game_event_group_leader_name_english": "Alice",
                    "game_event_group_leader_name_chinese": "",
                    "game_event_group_fruit_key": "strawberry",
                    "game_event_group_fruit_name": "Strawberry",
                    "game_event_group_fruit_asset": "assets/fruits/strawberry.svg",
                    "game_event_group_is_leader": False,
                },
                {
                    "number": 3,
                    "name_english": "Carol",
                    "name_chinese": "",
                    "small_group_leader": "Hui Yee",
                    "age_group": "Young Adult",
                    "gender": "female",
                    "game_event_group_id": 2,
                    "game_event_group_name": "Joy 喜乐",
                    "game_event_group_leader_number": 3,
                    "game_event_group_leader_name_english": "Carol",
                    "game_event_group_leader_name_chinese": "",
                    "game_event_group_fruit_key": "watermelon",
                    "game_event_group_fruit_name": "Watermelon",
                    "game_event_group_fruit_asset": "assets/fruits/watermelon.svg",
                    "game_event_group_is_leader": True,
                },
                {
                    "number": 4,
                    "name_english": "David",
                    "name_chinese": "",
                    "small_group_leader": "Hui Yee",
                    "age_group": "Young Adult",
                    "gender": "male",
                    "game_event_group_id": 2,
                    "game_event_group_name": "Joy 喜乐",
                    "game_event_group_leader_number": 3,
                    "game_event_group_leader_name_english": "Carol",
                    "game_event_group_leader_name_chinese": "",
                    "game_event_group_fruit_key": "watermelon",
                    "game_event_group_fruit_name": "Watermelon",
                    "game_event_group_fruit_asset": "assets/fruits/watermelon.svg",
                    "game_event_group_is_leader": False,
                },
            ],
            "game_masters": [],
        },
    }
