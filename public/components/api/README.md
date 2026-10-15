# Tidelight Intelligence Cloud API

The public REST API is available at `https://api.tidelight.app/v1`. The versioned OpenAPI contract is in [`openapi/tidelight.yaml`](openapi/tidelight.yaml).

The API currently exposes scoped, authenticated tokenized-equity market data and asynchronous company research jobs. Responses identify their source and request ID. rToken spot instruments are distinct from underlying US shares and stock perpetual contracts.

Create and scope credentials in the [Tidelight developer console](https://tidelight.app/developers). Never commit a credential or send one to an untrusted client. Current supported scopes, limits, and errors are defined by the OpenAPI contract and developer guide at [dev.tidelight.app/api](https://dev.tidelight.app/api).

This repository is a generated public distribution of files maintained in `TidelightOrg/tidelight`. Propose changes in the mother repository.
