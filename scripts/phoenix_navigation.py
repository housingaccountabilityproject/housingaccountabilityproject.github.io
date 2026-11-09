"""Shared, progressively enhanced Phoenix research navigation."""
from html import escape

LINKS = [
    ('index.html', 'Overview'),
    ('records.html', 'Evidence index'),
    ('projects.html', 'Projects & phases'),
    ('questions.html', 'Questions & evidence'),
    ('glossary.html', 'Glossary'),
    ('inaugural-report.html', 'First report'),
    ('housing-help.html', 'Housing help'),
]


def navigation(current='', prefix=''):
    links = ''.join(
        f'<a href="{escape(prefix + path, quote=True)}"'
        + (' aria-current="page"' if path == current else '')
        + f'>{escape(title)}</a>'
        for path, title in LINKS
    )
    return f'<nav class="wrap phoenix-tools" aria-label="Phoenix research tools">{links}</nav>'
