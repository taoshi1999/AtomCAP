"""Home API projection tests."""

from __future__ import annotations

from app.api.home import HOME_VISIBLE_DELIVERABLE_TYPES
from app.objects import DeliverableType


def test_home_deliverables_hide_project_workspace_reports():
    """Pre-DD Reports live in the project workspace, not in the home sidebar."""
    assert DeliverableType.DD_REPORT.value not in HOME_VISIBLE_DELIVERABLE_TYPES
    assert DeliverableType.THESIS.value in HOME_VISIBLE_DELIVERABLE_TYPES
    assert DeliverableType.DEAL_LIST.value in HOME_VISIBLE_DELIVERABLE_TYPES
