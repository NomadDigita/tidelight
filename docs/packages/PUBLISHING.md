# First public package release runbook

This runbook describes the release steps after the first-release gates in [README.md](./README.md) are cleared. **No package is currently available from npm or PyPI.** Do not present a source archive or an internal candidate artifact as a registry release.

## Current release blockers

- `@tidelight/sdk`, `@tidelight/mcp`, `@tidelight/react`, and `@tidelight/cli` are all marked `private: true`.
- MCP, React, and CLI use `UNLICENSED`; the SDK and Python metadata also need an approved license and repository metadata.
- The CLI declares `@tidelight/sdk` through `file:../../sdk/typescript`, which cannot work for a consumer installing a registry package. Replace it with the approved published SDK version and prove a clean tarball install.
- Python currently builds the distribution `tidelight-sdk` with a proprietary license while the intended directory name is `tidelight`. Confirm namespace ownership and make the project, docs, mirror, and PyPI project agree before choosing either name.
- Organization ownership and publisher access for every npm scope and PyPI project have not been verified. No trusted publisher relationship is confirmed.
- Security policy links, package compatibility tables, package changelogs, release provenance/SBOM checks, and release approval rules still need completion.

Registry absence is not proof that a namespace is safe to claim. Verify each package owner and account configuration while signed in to the organization’s registry accounts.

## Build an internal candidate

After merging source changes to `main`:

1. Open **Actions → Build internal package candidate → Run workflow** on `main`.
2. Enter the exact version shared by all five package manifests. The workflow stops if any manifest differs.
3. Enter `BUILD PACKAGE CANDIDATE` in the confirmation field.
4. Wait for the TypeScript SDK, React, CLI, MCP, and Python source tests and archive checks to pass.
5. Download the workflow artifact named `tidelight-package-candidate-<version>-<commit>-<run-id>-<attempt>`.
6. From the artifact root, run `sha256sum -c SHA256SUMS` and verify `SOURCE.txt` identifies the intended mother-repository commit.
7. Review all four `.tgz` files and the `.whl` contents before any registry release.

The workflow has `contents: read` permission only. It does not use registry credentials or OIDC and does not upload to npm, PyPI, or GitHub Releases. Artifacts expire after 30 days.

## Configure publisher trust

Do this only after namespace ownership and legal metadata are resolved.

### npm

For each package, configure npm Trusted Publishing to the exact GitHub organization, mother repository, workflow file, and protected GitHub `publish` environment. Require approval for that environment and restrict it to protected release tags. Verify the package’s npm owner list and publisher settings using the organization’s npm account. Do not put a long-lived npm token in repository secrets when OIDC trusted publishing is available.

### PyPI

Create or verify the approved PyPI project, then configure its Trusted Publisher for `TidelightOrg/tidelight`, the dedicated publishing workflow, and the protected `publish` environment. Confirm the project name and owner before adding the workflow relationship. Do not put a PyPI API token in repository secrets when Trusted Publishing is available.

GitHub `id-token: write` is required only in a future dedicated publishing job that uploads artifacts. Keep it out of candidate and test jobs. Publish the exact candidate artifacts that passed review; do not rebuild packages in the publishing job.

## Release order and consumer verification

1. Release `@tidelight/sdk` first.
2. Release `@tidelight/mcp` and `@tidelight/react` after their namespace, license, compatibility, and client-security checks are approved.
3. Release Python only after the `tidelight` versus `tidelight-sdk` decision is recorded and the matching PyPI project is controlled by Tidelight.
4. Release `@tidelight/cli` only after it depends on the published SDK by an exact supported semver range, then passes an isolated install and smoke test.
5. Publish checksums, provenance/attestations, release notes, compatibility details, and changelog links with each version. Use the same version in the mother repository, registry manifest, and corresponding public mirror.

After publishing each npm package, verify it from a clean temporary directory:

```sh
npm view @tidelight/sdk version dist.tarball
npm pack @tidelight/sdk@<version>
mkdir package-install-check && cd package-install-check
npm init -y
npm install @tidelight/sdk@<version>
```

Import the declared public entry point in a small Node.js smoke test and confirm the packed archive matches the reviewed candidate. For Python, query the approved distribution name on PyPI, install the exact version into a fresh virtual environment, and import `Client` and `ApiError` from `tidelight`. Verify the project page, source link, license, and release files.

Record the registry URL, exact version, artifact checksum, workflow run, GitHub commit, provenance result, and clean-install result in the package changelog/release notes and update the Developer Center catalog only after those checks pass.

## Existing GitHub source-release workflow

`.github/workflows/release-sdk.yml` creates GitHub Releases in the TypeScript, Python, and MCP source mirrors after exact mirror parity and tests pass. It does **not** publish registry packages. Keep source releases distinct from npm/PyPI publishing in the UI, docs, and release notes.
