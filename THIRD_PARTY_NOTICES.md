# Third-party software and data

This repository packages the local Escher3D extension and the existing Escher editor distribution. Third-party code, fonts and scientific datasets retain their original attribution and terms; the inclusion of a dataset does not make it subject to another component's software license.

## Escher

- Upstream: https://github.com/opencobra/escher
- Documentation: https://escher.readthedocs.io/
- Website and public map catalog: https://escher.github.io/ and https://escher.github.io/1-0-0/6/index.json
- The bundled editor preserves its embedded Escher MIT notice, copyright 2015 The Regents of the University of California, and other embedded notices. A copy of the embedded Escher notice is in `licenses/Escher.txt`.
- Citation: King et al. (2015), *Escher: A web application for building, sharing, and embedding data-rich visualizations of biological pathways*. https://doi.org/10.1371/journal.pcbi.1004321
- `app/assets/` is the pre-existing compiled editor bundle, not a newly rebuilt upstream release. The editable extension is provided as separate JavaScript/CSS modules.

## Three.js

Three.js 0.180.0, MIT. The upstream license and exact vendored source information are included in `app/vendor/three/LICENSE` and `app/vendor/three/PROVENANCE.txt`. OrbitControls uses a local module import.

## Scientific maps and models

- Four public Escher examples: original files, organism/model identities, URLs, download time and SHA-256 are recorded in `examples/sources.json`. They are retained without rewriting map coordinates.
- iMM1865: Khodaee et al. (2020), *iMM1865: A New Reconstruction of Mouse Genome-Scale Metabolic Model*. https://doi.org/10.1038/s41598-020-63235-w. See `docs/iMM1865-provenance.md` for the source supplement. This repository carries the existing converted JSON model.
- Existing local map/model assets are retained as supplied to the application. RECON1/iJO1366 examples and the default iMM1865 model represent different organisms and must not be treated as interchangeable biological models.

## Design reference

`DESIGN.md` was generated using `npx getdesign@latest add framer` and used as a visual reference for application chrome. The app does not bundle Framer itself or proprietary Framer fonts and does not require a Framer service.
