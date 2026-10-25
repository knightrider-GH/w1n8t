"""
api/index.py — Vercel Serverless entrypoint for FastAPI backend.
Seamlessly routes /api/* requests on Vercel to the core FastAPI application.
"""

import os
import sys

# Ensure repository root and backend directory are in Python sys.path
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Import the configured FastAPI app instance
from backend.main import app

# Expose app and handler for Vercel ASGI serverless runtime
handler = app
