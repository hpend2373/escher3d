# Mouse genome-scale metabolic model

The active model in this repository is **iMM1865** for *Mus musculus*.
It replaces Recon3D as the intended model basis. Recon3D is a human model;
iMM1865 was reconstructed from its flux-consistent version by mapping and
curating mouse orthologues.

## Model file

- `models/iMM1865.xml`
- SBML Level 3 Version 1 with FBC v2
- 9 compartments
- 5,839 metabolites
- 10,612 reactions
- 1,865 genes
- Objective: `BIOMASS_reaction`
- SHA-256: `d2c21ac43dfd64906376fe422543c58acae5caa8858e7057bb1163a6fe7fe306`

## Provenance

The file is the unmodified `iMM1865.xml` distributed as Supplementary Data 1
(`41598_2020_63235_MOESM2_ESM.zip`) with:

> Khodaee S, Asgari Y, Totonchi M, Karimi-Jafari MH. iMM1865: A New
> Reconstruction of Mouse Genome-Scale Metabolic Model. *Scientific Reports*.
> 2020;10:6177. https://doi.org/10.1038/s41598-020-63235-w

- BioStudies accession: `S-EPMC7148337`
- Original supplement: https://www.ebi.ac.uk/biostudies/files/S-EPMC7148337/41598_2020_63235_MOESM2_ESM.zip
- Retrieved: 2026-09-01

## Validation

The SBML file was checked for XML well-formedness and loaded with COBRApy
0.32.1. COBRApy recovered the counts above, selected `BIOMASS_reaction` as the
objective, and GLPK returned an `optimal` solution under the model's distributed
default bounds.
