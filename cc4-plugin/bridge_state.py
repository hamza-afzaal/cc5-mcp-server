"""Session state that must survive hot reloads of cc4_api.

server.py reloads only cc4_api, so anything kept here lives for the whole CC4
session. Keep it to plain data.
"""

from __future__ import annotations

# Normalized paths of projects written by save_project_as in this CC4 session.
# convert_lod / merge_materials only run while the current project is one of these
# (design D6: irreversible operations only on saved copies).
saved_as_paths: set = set()
