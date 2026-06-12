import json

from playwright.sync_api import expect


def route_mock_data(page, mock_data):
    """Intercept data file requests and return deterministic mock data."""

    def handle_route(route, request):
        # Playwright gives the raw encoded URL; decode it before matching.
        url = request.url.replace("%20", " ")
        if "Full Name List" in url:
            route.fulfill(status=200, body=json.dumps(mock_data["roster"]).encode())
            return
        if "game_event_groups.json" in url:
            route.fulfill(status=200, body=json.dumps(mock_data["game_event"]).encode())
            return
        route.continue_()

    page.route("**/*", handle_route)


def open_admin(page, base_url, mock_data):
    route_mock_data(page, mock_data)
    page.goto(base_url)
    page.get_by_role("tab", name="Admin").click()
    page.locator("#adminPassword").fill("7212")
    page.locator("#adminUnlockButton").click()
    expect(page.locator("#admin-viewer-panel")).to_be_visible()


def read_game_json(page):
    """Return the current game-event JSON shown in the admin JSON viewer."""
    page.locator("#game-json-tab").click()
    text = page.locator("#gameRawJson").text_content()
    return json.loads(text)


def test_admin_unlock(page, base_url, mock_data):
    open_admin(page, base_url, mock_data)
    expect(page.locator("#adminStatus")).to_have_text("")


def test_reassign_leader_updates_page(page, base_url, mock_data):
    open_admin(page, base_url, mock_data)

    # Change group 1 leader from Alice (1) to Bob (2)
    page.locator("#adminGroupSelect").select_option("1")
    page.locator("#adminLeaderSelect").select_option("2")
    page.locator("#adminApplyButton").click()

    expect(page.locator("#adminStatus")).to_have_text("Leader updated.")

    data = read_game_json(page)
    group = next(g for g in data["groups"] if g["id"] == 1)
    assert group["leader_number"] == 2
    assert group["leader_name_english"] == "Bob"

    participants = [p for p in data["participants"] if p["game_event_group_id"] == 1]
    leader_participant = next(p for p in participants if p["number"] == 2)
    assert leader_participant["game_event_group_is_leader"] is True

    old_leader = next(p for p in participants if p["number"] == 1)
    assert old_leader["game_event_group_is_leader"] is False


def test_export_downloads_current_json(page, base_url, mock_data, tmp_path):
    open_admin(page, base_url, mock_data)

    # Change leader first so exported data differs from original mock data
    page.locator("#adminGroupSelect").select_option("2")
    page.locator("#adminLeaderSelect").select_option("4")
    page.locator("#adminApplyButton").click()
    expect(page.locator("#adminStatus")).to_have_text("Leader updated.")

    # Set up download listener
    download_path = tmp_path / "game_event_groups.json"
    with page.expect_download() as download_info:
        page.locator("#adminExportButton").click()
    download = download_info.value
    download.save_as(str(download_path))

    exported = json.loads(download_path.read_text())
    group = next(g for g in exported["groups"] if g["id"] == 2)
    assert group["leader_number"] == 4
    assert group["leader_name_english"] == "David"
    assert "participants" in exported
    assert "game_masters" in exported


def test_rebuild_changes_groups(page, base_url, mock_data):
    open_admin(page, base_url, mock_data)

    before = read_game_json(page)
    before_assignments = {
        p["number"]: p["game_event_group_id"]
        for p in before["participants"]
    }

    page.locator("#adminRegroupButton").click()
    expect(page.locator("#adminStatus")).to_have_text("Game groups rebuilt.")

    after = read_game_json(page)
    after_assignments = {
        p["number"]: p["game_event_group_id"]
        for p in after["participants"]
    }

    # Rebuild should keep all participants assigned to valid groups
    assert set(after_assignments.values()).issubset({1, 2})
    assert len(after["participants"]) == len(before["participants"])

    # At least one participant should move (very high probability with shuffling)
    assert before_assignments != after_assignments
