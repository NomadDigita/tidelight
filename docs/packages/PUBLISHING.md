# First registry publication runbook

This runbook describes the first npm and PyPI releases from the Tidelight mother repository. It is a preparation guide, not evidence that a package is published. Do not run a registry write until the final checks and owner approval below are complete.

## Current publication blockers

As of 2026-10-16, the package source manifests are still private. The MCP, React, and CLI npm manifests declare `UNLICENSED`; the TypeScript SDK manifest does not yet declare its license or repository metadata. The Python project is named `tidelight-sdk`, while the intended public distribution name is `tidelight`, and its license metadata says `Proprietary`. The CLI manifest depends on the SDK through a local `file:` path, which is not a valid dependency for a registry consumer. Registry lookup results recorded in `README.md` are point-in-time checks and do not establish current ownership or publishing rights.

Resolve these items through reviewed changes before requesting a release:

1. Confirm the final npm scope and Python distribution names with the organization owners. Check registry ownership while authenticated to the organization; a public 404 alone does not prove that the name is safe to claim.
2. Confirm the package license and the right to distribute each package. Add complete package metadata, security contact, changelog, and support policy.
3. Decide the Python distribution name explicitly. If `tidelight` is selected, change `pyproject.toml`, mirror metadata, docs, and tests together. Do not silently rename it.
4. Change npm `private` to `false` only in the release candidate after the owner has approved that package for publication.
5. Replace the CLI's local SDK dependency with the exact released SDK version in the staged release artifact. Preserve the canonical source dependency for local development; validate and publish the same staged artifact that passed the consumer rehearsal.
6. Configure registry trusted publishers and the protected GitHub `package-publication` environment. Use GitHub OIDC; do not add long-lived npm or PyPI passwords to repository secrets.
7. Keep public market-data redistribution disabled until the required provider terms have been reviewed and recorded.

## Registry ownership and OIDC setup

Before a release pull request is approved, an organization owner should:

- Verify the `@tidelight` npm organization, scope membership, package name ownership, and permission for the publishing identity.
- Configure npm Trusted Publishing for `TidelightOrg/tidelight`, the exact release workflow filename, and the protected environment used by that workflow. Enable provenance and require the `id-token: write` GitHub permission.
- Verify the PyPI project name and owner access. Configure a PyPI Trusted Publisher for the same GitHub repository, exact workflow filename, and environment. Do not create a password-based publisher token.
- Add required reviewers to the GitHub `package-publication` environment and restrict it to the protected `main` branch and approved release tags.
- Confirm that the selected registry supports the required provenance path and that the public package source does not include server code, provider credentials, `.env` files, or private infrastructure.

The existing `.github/workflows/release-sdk.yml` creates GitHub source releases in synchronized repositories. It does **not** publish to npm or PyPI. No npm/PyPI registry publication workflow is configured yet. Before the first release, add a dedicated, reviewed `workflow_dispatch` workflow with `id-token: write`, a protected `package-publication` environment, exact package/version inputs, archive validation before publication, and separate npm/PyPI jobs. Build and validate immutable archives before the protected approval, record their checksums, and have the approved job publish those exact artifacts without rebuilding them. The CLI job must publish its validated staged manifest, not the source `file:` dependency.

The `@tidelight/mcp` package is a local stdio bridge for MCP clients that cannot connect directly to the hosted Streamable HTTP service. It is not the hosted `mcp.tidelight.app` service and does not install or deploy that service. Keep this distinction clear in package descriptions, docs, container plans, and release notes. The current consumer rehearsal packs the TypeScript SDK and React package locally and adjusts the CLI's staged SDK dependency; it does not test an MCP npm archive or validate the exact final release artifacts. Expand that rehearsal before publication.

## Pre-release validation

From a clean checkout at the reviewed release commit:

```sh
npm ci
npm run check:package-catalog
npm test
npm run typecheck
npm run lint
npm run build
npm run test:package-consumers
npm run test:public-mirrors
```

Then validate each selected distribution archive:

```sh
node scripts/check-npm-package-archive.mjs sdk/typescript
node scripts/check-npm-package-archive.mjs public/components/mcp/server
node scripts/check-npm-package-archive.mjs packages/react
node scripts/check-npm-package-archive.mjs packages/cli
python scripts/check-python-package.py sdk/python
```

Run the package-specific tests in each workspace as required by CI. Inspect the resulting tarball or wheel file list and metadata. Confirm every README command matches the release artifact. Verify that package license metadata matches a reviewed license file, package contact/support metadata is present, Python's documented import name matches the built wheel, and the CLI `bin` entry and supported platforms work (including native keyring installation). For React, test the declared React peer versions or narrow the declared range to versions CI actually covers. The current package validation matrix exercises React 19.2.8, not React 18.

Before any registry write, perform a clean-consumer test against the exact staged archives. For the CLI, verify that the staged manifest references the already published exact SDK version and that `scripts/test-package-consumers.mjs` validates that same manifest and archive. Do not publish the local `file:../../sdk/typescript` dependency. Verify normalized package-name availability and authenticated namespace ownership immediately before release; registry 404 responses and old lookup notes are not ownership evidence.

## Release order and commands

Publish the SDK first because React and CLI depend on it. The MCP bridge can follow after its own namespace, license, and source review. Publish Python only after its distribution name has been resolved. Publish React and CLI after verifying the released SDK dependency range.

After the registry workflow has been implemented and its protected environment reviewer approves the release job, publish the already validated package directory through GitHub OIDC. Inside that workflow, the npm publish step is equivalent to:

```sh
npm publish --access public --provenance
```

For a staged CLI, run that command only inside the validated staging directory whose manifest pins the exact released SDK version. Never publish from the unmodified canonical CLI manifest while its dependency is a local `file:` path.

For Python, configure the workflow with `permissions: { contents: read, id-token: write }` and use `pypa/gh-action-pypi-publish@release/v1` from the protected release job against the exact validated wheel. Do not upload a different wheel after validation. Do not use a developer's personal API token in CI.

## Post-publication verification

Verify that each package can be fetched by its exact version from a fresh environment. Record the release tag, mother-repository commit, package version, registry URL, package integrity/provenance result, and clean-install result in the changelog/release record.

For npm:

```sh
npm view @tidelight/sdk@<version> version dist.integrity dist.tarball
npm view @tidelight/mcp@<version> version dist.integrity dist.tarball
npm view @tidelight/react@<version> version dist.integrity dist.tarball
npm view @tidelight/cli@<version> version dist.integrity dist.tarball
```

For PyPI, verify the project page and install the exact version in a clean virtual environment, then import the documented module and run a harmless unauthenticated validation path. A successful workflow alone does not confirm that CDN propagation or a consumer install works.

Only after those checks pass should the Developer Center show the package as published or show a registry installation command. Update the generated catalog from the reviewed release metadata and rerun the package page tests.

## Owner approval record

Before starting the protected publication workflow, record for each package:

- approved registry and exact package name;
- confirmed namespace owner and trusted-publisher configuration;
- approved license and package contents review;
- exact version and source commit;
- passing CI run and archive checksum;
- approved release notes and changelog;
- named owner approval for the first public publication.
