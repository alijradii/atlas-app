# Third-party notices

This bundle contains project adapters, source retrieval/controller code, and package
installation definitions. It does not vendor installed Python dependencies or model
weights. Dependencies and downloaded models retain their respective upstream terms.
Do not describe the complete package/model stack as MIT merely because RAG-Anything
and LightRAG use MIT licenses.

Upstream license texts retained from the installed, pinned source environment:

- [RAG-Anything license](licenses/raganything-LICENSE), version 1.4.2.
- [LightRAG license](licenses/lightrag-hku-LICENSE), version 1.4.16.
- [MinerU license](licenses/mineru-LICENSE.md), version 3.4.1. This has its own
  attribution and commercial-use conditions; read the full text for your deployment.

The [dependency lock](requirements.lock) identifies all package versions and hashes.
The [model manifest](models.json) identifies the parser model repository, revision,
and selected files. Obtain and retain applicable model and dependency notices when
redistributing an installed image or model cache. Gemini service access uses the
recipient's provider account. This handoff does not grant rights to uploaded documents.
