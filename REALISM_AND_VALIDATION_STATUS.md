# VEROIA v5-Ultra — Realism & Validation Status

## Scope of this repair

This package is a forensic image-feature analysis prototype. It is **not yet a scientifically validated AI-image detector**. A green UI state, finite score, deterministic run, or passing unit test does not establish classification accuracy.

## Corrections made

1. Stage 6 no longer substitutes an IQA value of `75.0` when IQA is non-finite. Non-finite IQA is recorded as invalid evidence.
2. Stage 7 no longer injects a default Markov entropy of `2.45` when the measured value is missing. Missing/non-finite Markov entropy fails closed and cannot be authorized.
3. Added `src/test/realism_acceptance_test.ts` for synthetic Full HD texture families, finite feature outputs, FFT patch limits, collapsed-manifold abstention, and missing-evidence rejection.

## What the current calculations actually measure

- `x_CNN` is a legacy field name for a Laplacian-residual statistic. It is **not** a trained CNN and must not be described as neural-network evidence.
- LBP measures local binary texture patterns; it is not uniquely specific to AI-generated images.
- FFT measures frequency/periodicity characteristics; periodic structure also occurs in natural images and processing artifacts.
- MultiLID estimates local intrinsic dimensionality. The `22.40` reference is an unvalidated exploratory baseline, not a universal natural-image baseline. Its derived 0–100 score is therefore not a validated AI probability.
- Markov entropy measures quantized spatial transition statistics. It is not direct evidence of a VAE or diffusion process.
- Alternative C remains the existing bounded formula; this repair does not alter its constants or bounds.
- Platt parameters `A=-1.685`, `B=0.024` remain fixed and unvalidated on an independent labeled dataset. Outputs must remain explicitly indicative, not calibrated probabilities.

## Synthetic Full HD spot-check (Node.js v22.16.0, this container)

| Synthetic input | x_Laplacian (legacy x_CNN) | x_LBP | x_MultiLID | x_FFT | MultiLID status |
|---|---:|---:|---:|---:|---|
| Flat | 5.0 | 5.0 | 0.0 | 5.0 | COLLAPSED_IDENTICAL |
| Linear gradient | 5.0 | 5.0 | 100.0 | 5.0 | VALID |
| Checkerboard | 95.0 | 15.0 | 100.0 | 78.3 | VALID |
| Deterministic noise | 95.0 | 62.2 | 100.0 | 93.5 | VALID |
| Periodic sinusoid | 9.7 | 5.0 | 100.0 | 5.0 | VALID |

These examples are diagnostic sanity checks, **not** a labeled benchmark and not estimates of precision, recall, FPR, FNR, or AUC. The MultiLID saturation across several very different synthetic textures is a reason not to treat its derived score as AI-specific evidence.

## Test and build status

- `micro_repair_04_1_test.ts`: 12/12 passed when compiled with CommonJS interop enabled.
- `micro_repair_05_26_test.ts`: all checks passed in this container.
- `realism_acceptance_test.ts`: passed across five synthetic Full HD texture families and Stage 7 fail-closed checks.
- Core engine TypeScript compilation (Stage 5/6/7 dependency graph): passed with the globally available TypeScript compiler.
- Full application dependency installation timed out; the ZIP has no lockfile and this environment could not install npm dependencies. Therefore the Vite production build and browser UI have **not** been verified here.
- The legacy `micro_repair_05_9_test.ts` has 2 assertions expecting a definitive HUMAN verdict, and `micro_repair_07_test.ts` has 16 assertions expecting definitive AI/Human/machine-pattern verdicts. Those expectations conflict with the explicit `UNVALIDATED_FIXED_PARAMETERS` state and conservative abstention; they remain failed legacy assertions rather than being weakened or counted as passes.
- The standalone `micro_repair_04_1_test.ts` benchmark runs successfully with CommonJS interop enabled; the global TypeScript environment lacks installed Node type declarations, so its standalone typecheck reports missing `@types/node` symbols.

## Required before claiming a validated detector

1. Freeze a provenance-documented, diverse, independently labeled dataset: real camera images, multiple AI generators, edits/inpainting, screenshots, recompression, resizing, crops, and social-media processing.
2. Split by source/creator/generator and capture session to prevent leakage; keep a blind holdout untouched until final evaluation.
3. Report confusion matrix, sensitivity/recall, specificity, precision, FPR/FNR, ROC-AUC, PR-AUC, Brier score, reliability curve/ECE, and confidence intervals. Report results by generator, image domain, resolution, and compression level.
4. Fit/calibrate thresholds and Platt parameters only on training/validation partitions, then evaluate once on the independent holdout.
5. Run ablations for each feature and stress tests for translation, crop, scale, JPEG quality, blur, sharpening, and noise.
6. Keep `AMBIGUOUS / INSUFFICIENT EVIDENCE` as a valid outcome. Do not force a binary answer.

## Final status

**Software integrity hardening: partial and locally tested. Scientific detector validation: NOT COMPLETE.** It would be misleading to mark the project as a finished, accurate AI detector without the independent labeled dataset and full production build/test run.
