"""Vercel serverless entry-point — exposes the FastAPI backend."""

import os
import sys

# Vercel runs from /var/task but our app package is in /var/task/api/
sys.path.insert(0, os.path.dirname(__file__))

from app.api import app  # noqa: E402, F401
