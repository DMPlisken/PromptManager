import re


def render_template(content: str, variables: dict[str, str]) -> str:
    """Replace {{PLACEHOLDER}} tokens in content with provided variable values."""
    def replacer(match: re.Match) -> str:
        key = match.group(1).strip()
        val = variables.get(key)
        if val is not None and val.strip():
            return val.rstrip()
        return match.group(0)

    return re.sub(r"\{\{(.+?)\}\}", replacer, content)


def extract_placeholders(content: str) -> list[str]:
    """Extract all unique placeholder names from template content."""
    return list(dict.fromkeys(
        match.strip() for match in re.findall(r"\{\{(.+?)\}\}", content)
    ))
