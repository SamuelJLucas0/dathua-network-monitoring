from unittest.mock import MagicMock, patch

from agent_linux import service


def test_write_unit_file_contains_python_exe_and_project_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(service, "get_systemd_user_dir", lambda: tmp_path)

    path = service.write_unit_file(project_dir=tmp_path / "checkout")

    content = path.read_text(encoding="utf-8")
    assert "ExecStart=" in content
    assert "-m agent_linux run" in content
    assert str(tmp_path / "checkout") in content
    assert path.parent == tmp_path


def test_install_reports_steps_without_touching_real_systemd(tmp_path, monkeypatch):
    monkeypatch.setattr(service, "get_systemd_user_dir", lambda: tmp_path)
    ok_result = MagicMock(returncode=0, stdout="", stderr="")
    with patch("agent_linux.service._run", return_value=ok_result) as mock_run:
        steps = service.install(project_dir=tmp_path)

    assert any("Unidad escrita" in s for s in steps)
    assert any("Linger activado" in s for s in steps)
    commands = [call.args[0] for call in mock_run.call_args_list]
    # restart (no `enable --now`): si ya corría, debe tomar la config/código nuevos.
    assert ["systemctl", "--user", "restart", service.SERVICE_NAME] in commands
    assert ["systemctl", "--user", "enable", service.SERVICE_NAME] in commands


def test_install_stops_early_if_enable_fails(tmp_path, monkeypatch):
    monkeypatch.setattr(service, "get_systemd_user_dir", lambda: tmp_path)
    fail_result = MagicMock(returncode=1, stdout="", stderr="permission denied")
    with patch("agent_linux.service._run", return_value=fail_result):
        steps = service.install(project_dir=tmp_path)

    assert any("ERROR" in s for s in steps)
    assert not any("Linger" in s for s in steps)


def test_uninstall_removes_unit_file(tmp_path, monkeypatch):
    monkeypatch.setattr(service, "get_systemd_user_dir", lambda: tmp_path)
    service.write_unit_file(project_dir=tmp_path)
    assert service.unit_path().exists()

    ok_result = MagicMock(returncode=0, stdout="", stderr="")
    with patch("agent_linux.service._run", return_value=ok_result):
        service.uninstall()

    assert not service.unit_path().exists()
