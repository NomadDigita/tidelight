#!/usr/bin/env python3
"""Build and inspect the Python SDK wheel without publishing or installing globally."""

from __future__ import annotations

import email.parser
import os
import re
import subprocess
import sys
import tempfile
import shutil
import zipfile
from pathlib import Path


def fail(message: str) -> None:
    raise SystemExit(f"Python package validation failed: {message}")


def project_metadata(pyproject: Path) -> tuple[str, str, str]:
    source = pyproject.read_text(encoding="utf-8")
    project = re.search(r"(?ms)^\[project\]\s*(.*?)(?=^\[|\Z)", source)
    if not project:
        fail("pyproject.toml is missing [project].")
    values = {}
    for key in ("name", "version", "requires-python"):
        match = re.search(rf'(?m)^{re.escape(key)}\s*=\s*["\']([^"\']+)["\']\s*$', project.group(1))
        if not match:
            fail(f"pyproject.toml is missing project.{key}.")
        values[key] = match.group(1)
    return values["name"], values["version"], values["requires-python"]


def main() -> None:
    source = Path(sys.argv[1] if len(sys.argv) > 1 else "sdk/python").resolve()
    output_directory = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else None
    pyproject = source / "pyproject.toml"
    if not pyproject.is_file():
        fail(f"{pyproject} does not exist.")

    expected_name, expected_version, expected_python = project_metadata(pyproject)
    with tempfile.TemporaryDirectory(prefix="tidelight-python-wheel-") as temporary:
        root = Path(temporary)
        staged_source = root / "source"
        shutil.copytree(source, staged_source, ignore=shutil.ignore_patterns(".git", "build", "*.egg-info", "__pycache__", "tests"))
        dist = root / "dist"
        install = root / "install"
        dist.mkdir()
        subprocess.run(
            [sys.executable, "-m", "pip", "wheel", "--no-deps", "--wheel-dir", str(dist), str(staged_source)],
            check=True,
            env={**os.environ, "PIP_DISABLE_PIP_VERSION_CHECK": "1"},
        )
        wheels = list(dist.glob("*.whl"))
        if len(wheels) != 1:
            fail(f"expected one wheel, found {len(wheels)}.")
        wheel = wheels[0]
        with zipfile.ZipFile(wheel) as archive:
            files = {name for name in archive.namelist() if not name.endswith("/")}
            metadata_files = [name for name in files if name.endswith(".dist-info/METADATA")]
            if len(metadata_files) != 1:
                fail("wheel must contain exactly one dist-info/METADATA file.")
            metadata = email.parser.BytesParser().parsebytes(archive.read(metadata_files[0]))
            normalize = lambda name: re.sub(r"[-_.]+", "-", name).lower()
            if normalize(metadata.get("Name", "")) != normalize(expected_name):
                fail(f"wheel name {metadata.get('Name')!r} does not match project name {expected_name!r}.")
            if metadata.get("Version") != expected_version:
                fail(f"wheel version {metadata.get('Version')!r} does not match project version {expected_version!r}.")
            if metadata.get("Requires-Python") != expected_python:
                fail("wheel Python compatibility metadata differs from pyproject.toml.")
            if "Unpublished client" not in metadata.get_payload():
                fail("wheel must embed the source README as its package description.")
            project_urls = metadata.get_all("Project-URL", [])
            if not any("Repository, https://github.com/TidelightOrg/tidelight" in value for value in project_urls):
                fail("wheel must advertise its canonical source repository.")
            required = {"tidelight/__init__.py", "tidelight/client.py"}
            missing = required - files
            if missing:
                fail(f"wheel is missing required modules: {', '.join(sorted(missing))}.")
            sensitive_name = re.compile(r"(^|/)(\.env(?:\..*)?|id_rsa|id_ed25519|.*(?:secret|credential|private[-_]?key).*)($|\.)", re.I)
            unsafe = [name for name in files if name.endswith((".pyc", ".pem", ".key", ".p12")) or "/tests/" in name or name.startswith("tests/") or sensitive_name.search(name)]
            if unsafe:
                fail(f"wheel contains test, bytecode, or private-key material: {', '.join(sorted(unsafe))}.")
            unexpected = [name for name in files if not (name.startswith("tidelight/") or ".dist-info/" in name)]
            if unexpected:
                fail(f"wheel contains unexpected top-level files: {', '.join(sorted(unexpected))}.")

        subprocess.run([sys.executable, "-m", "pip", "install", "--no-deps", "--target", str(install), str(wheel)], check=True, stdout=subprocess.DEVNULL)
        env = {**os.environ, "PYTHONPATH": str(install), "PIP_DISABLE_PIP_VERSION_CHECK": "1"}
        subprocess.run(
            [sys.executable, "-c", "from tidelight import ApiError, Client, Instrument, InstrumentPage, ResearchJob; print('installed wheel imports passed')"],
            check=True,
            env=env,
        )
        if output_directory:
            output_directory.mkdir(parents=True, exist_ok=True)
            shutil.copy2(wheel, output_directory / wheel.name)
        suffix = f" Verified wheel saved to {output_directory}." if output_directory else " Nothing was published."
        print(f"Validated {wheel.name}: metadata, contents, and isolated imports.{suffix}")


if __name__ == "__main__":
    main()
