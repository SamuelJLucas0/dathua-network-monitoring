from unittest.mock import MagicMock, patch

import pytest
import requests

from agent.api_client import ApiUnreachableError, DathuaApiClient, SiteKeyRevokedError


def make_response(status_code, json_data=None, text=""):
    res = MagicMock()
    res.status_code = status_code
    res.text = text
    res.json.return_value = json_data or {}
    return res


def test_get_active_nodes_success():
    client = DathuaApiClient("http://localhost:3000/api", "dth_site_test")
    with patch.object(client.session, "request", return_value=make_response(
        200, {"site": {"siteId": 1, "orgId": 1}, "nodes": [{"nodeId": 1}]}
    )) as mock_req:
        site, nodes = client.get_active_nodes()

    assert site == {"siteId": 1, "orgId": 1}
    assert nodes == [{"nodeId": 1}]
    mock_req.assert_called_once()
    assert mock_req.call_args.args[1] == "http://localhost:3000/api/nodes/worker/active"


def test_get_active_nodes_revoked_key_raises_specific_error():
    client = DathuaApiClient("http://localhost:3000/api", "dth_site_revoked")
    with patch.object(client.session, "request", return_value=make_response(403, {"message": "API Key inválida"})):
        with pytest.raises(SiteKeyRevokedError):
            client.get_active_nodes()


def test_report_telemetry_server_error_raises_unreachable():
    client = DathuaApiClient("http://localhost:3000/api", "dth_site_test")
    with patch.object(client.session, "request", return_value=make_response(500, text="boom")):
        with pytest.raises(ApiUnreachableError):
            client.report_telemetry([{"metadata": {"node_id": 1}}])


def test_connection_error_raises_unreachable_not_revoked():
    client = DathuaApiClient("http://localhost:3000/api", "dth_site_test")
    with patch.object(client.session, "request", side_effect=requests.exceptions.ConnectionError("refused")):
        with pytest.raises(ApiUnreachableError):
            client.get_active_nodes()


def test_submit_discovery_candidates_sends_expected_payload():
    client = DathuaApiClient("http://localhost:3000/api", "dth_site_test")
    candidates = [{"ip": "10.0.0.5", "mac": "AA:BB:CC:DD:EE:FF", "hostname": None, "openPorts": [80]}]
    with patch.object(client.session, "request", return_value=make_response(201, {"accepted": 1})) as mock_req:
        result = client.submit_discovery_candidates(candidates)

    assert result == {"accepted": 1}
    _, kwargs = mock_req.call_args
    assert kwargs["json"] == {"candidates": candidates, "sessionStart": False}


def test_submit_discovery_candidates_session_start_flag():
    client = DathuaApiClient("http://localhost:3000/api", "dth_site_test")
    candidates = [{"ip": "10.0.0.5"}]
    with patch.object(client.session, "request", return_value=make_response(201, {"accepted": 1})) as mock_req:
        client.submit_discovery_candidates(candidates, session_start=True)

    _, kwargs = mock_req.call_args
    assert kwargs["json"]["sessionStart"] is True
