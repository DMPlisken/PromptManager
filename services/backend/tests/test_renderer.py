"""Unit tests for the template renderer service (no HTTP, no DB)."""

import pytest

from app.services.renderer import render_template, extract_placeholders


# ---------------------------------------------------------------------------
# render_template
# ---------------------------------------------------------------------------


def test_render_basic_template():
    result = render_template("Hello {{NAME}}", {"NAME": "World"})
    assert result == "Hello World"


def test_render_multiple_variables():
    content = "{{GREETING}}, {{NAME}}! Welcome to {{PLACE}}."
    variables = {"GREETING": "Hi", "NAME": "Alice", "PLACE": "Wonderland"}
    result = render_template(content, variables)
    assert result == "Hi, Alice! Welcome to Wonderland."


def test_render_missing_variable_left_as_is():
    """Variables not present in the dict should remain as literal {{PLACEHOLDER}}."""
    result = render_template("Hello {{NAME}}, role: {{ROLE}}", {"NAME": "Bob"})
    assert result == "Hello Bob, role: {{ROLE}}"


def test_render_no_variables():
    result = render_template("Plain text, no placeholders.", {})
    assert result == "Plain text, no placeholders."


def test_render_empty_content():
    result = render_template("", {"NAME": "X"})
    assert result == ""


def test_render_variable_with_whitespace_in_braces():
    """Placeholder names are stripped of surrounding whitespace."""
    result = render_template("Hello {{ NAME }}", {"NAME": "Eve"})
    assert result == "Hello Eve"


def test_render_repeated_variable():
    result = render_template("{{X}} and {{X}} again", {"X": "val"})
    assert result == "val and val again"


def test_render_special_characters_in_value():
    """Values with regex-special characters should be inserted literally."""
    result = render_template("Pattern: {{RE}}", {"RE": "a.*b+c?"})
    assert result == "Pattern: a.*b+c?"


# ---------------------------------------------------------------------------
# extract_placeholders
# ---------------------------------------------------------------------------


def test_extract_placeholders_unique():
    placeholders = extract_placeholders("{{A}} and {{B}} and {{A}}")
    assert placeholders == ["A", "B"]


def test_extract_placeholders_empty():
    placeholders = extract_placeholders("No placeholders here")
    assert placeholders == []


def test_extract_placeholders_preserves_order():
    placeholders = extract_placeholders("{{C}} then {{A}} then {{B}}")
    assert placeholders == ["C", "A", "B"]


def test_extract_placeholders_strips_whitespace():
    placeholders = extract_placeholders("{{ NAME }} and {{  AGE  }}")
    assert placeholders == ["NAME", "AGE"]


def test_extract_placeholders_complex_content():
    content = """
    Title: {{TITLE}}
    Description: {{DESCRIPTION}}
    Iterations: {{ITERATIONS}}
    Re-use title: {{TITLE}}
    """
    placeholders = extract_placeholders(content)
    assert placeholders == ["TITLE", "DESCRIPTION", "ITERATIONS"]
