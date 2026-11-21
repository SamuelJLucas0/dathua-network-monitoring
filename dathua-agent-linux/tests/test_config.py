from agent_linux import config


def test_load_config_missing_file_returns_none(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "get_config_dir", lambda: tmp_path / "does-not-exist")
    assert config.load_config() is None


def test_save_and_load_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "get_config_dir", lambda: tmp_path)

    config.save_config("http://localhost:3000/api", "dth_site_abc", {"siteId": 1, "name": "Sucursal"})
    loaded = config.load_config()

    assert loaded["apiBaseUrl"] == "http://localhost:3000/api"
    assert loaded["apiKey"] == "dth_site_abc"
    assert loaded["site"]["siteId"] == 1


def test_save_config_file_is_not_world_readable(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "get_config_dir", lambda: tmp_path)
    config.save_config("http://localhost:3000/api", "dth_site_abc", {"siteId": 1})

    mode = config.get_config_path().stat().st_mode & 0o777
    assert mode == 0o600


def test_load_config_incomplete_data_returns_none(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "get_config_dir", lambda: tmp_path)
    tmp_path.mkdir(parents=True, exist_ok=True)
    (tmp_path / "config.json").write_text('{"apiBaseUrl": "http://x"}', encoding="utf-8")

    assert config.load_config() is None


def test_clear_config_removes_file(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "get_config_dir", lambda: tmp_path)
    config.save_config("http://localhost:3000/api", "dth_site_abc", {"siteId": 1})

    config.clear_config()

    assert config.load_config() is None


def test_xdg_env_override_is_respected(tmp_path, monkeypatch):
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path))
    assert config.get_config_dir() == tmp_path / config.APP_NAME


def test_xdg_default_falls_back_to_home_dot_config(monkeypatch):
    monkeypatch.delenv("XDG_CONFIG_HOME", raising=False)
    assert config.get_config_dir() == config.Path.home() / ".config" / config.APP_NAME
