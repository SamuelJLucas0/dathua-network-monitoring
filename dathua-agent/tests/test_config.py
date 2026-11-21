from agent import config


def test_load_config_missing_file_returns_none(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "get_base_dir", lambda: tmp_path / "does-not-exist")
    assert config.load_config() is None


def test_save_and_load_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "get_base_dir", lambda: tmp_path)

    config.save_config("http://localhost:3000/api", "dth_site_abc", {"siteId": 1, "name": "Sucursal"})
    loaded = config.load_config()

    assert loaded["apiBaseUrl"] == "http://localhost:3000/api"
    assert loaded["apiKey"] == "dth_site_abc"
    assert loaded["site"]["siteId"] == 1


def test_load_config_incomplete_data_returns_none(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "get_base_dir", lambda: tmp_path)
    tmp_path.mkdir(parents=True, exist_ok=True)
    (tmp_path / "config.json").write_text('{"apiBaseUrl": "http://x"}', encoding="utf-8")

    assert config.load_config() is None


def test_clear_config_removes_file(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "get_base_dir", lambda: tmp_path)
    config.save_config("http://localhost:3000/api", "dth_site_abc", {"siteId": 1})

    config.clear_config()

    assert config.load_config() is None
