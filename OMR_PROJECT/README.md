# OMR Project

This repository contains the mathematical generators, templates, reference artifacts, and the scanning engine for various OMR layouts.

## Directory Structure
- `templates/`: Contains all OMR templates (T1-T7) along with their respective generation script, generated blank PNG, sample filled OMR, and expected answer table.
- `reference/`: Global reference artifacts for scanning checks.
- `omr_scanner/`: The core scanner engine.

## Usage
Each template folder (e.g. `T6_MHCET_200_BIO/`) has everything self-contained for easy scanner integration.
