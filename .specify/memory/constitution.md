<!--
Sync Impact Report
Version change: unversioned template → 1.0.0
Modified principles: none (initial adoption)
Added sections: Project Constraints; Development Workflow and Quality Gates
Removed sections: none
Follow-up TODO: confirm the original ratification date.
-->

# Gerrymandering Map Explorer Constitution

## Core Principles

### I. Fictional Data and Clear Provenance
All maps, boundaries, places, voter counts, and political results MUST be fictional or
synthetically generated. The interface MUST clearly identify generated data as fictional.
Real-world election or geographic data MUST NOT be introduced without a constitution
amendment. This prevents illustrative content from being mistaken for factual reporting.

### II. Trustworthy Data and Model Invariants
Domain calculations and displayed summaries MUST agree with the underlying data, and
derived totals MUST reconcile with their component values. An interaction that changes
presentation MUST NOT silently alter geography, voter data, or assignments. Generated
scenarios MUST support repeatable test inputs so correctness and regressions can be
verified.

### III. Accessible, Responsive Interaction
Every essential pointer interaction MUST have an equivalent keyboard interaction, with
visible focus and meaningful labels. Core content and controls MUST remain usable across
the supported viewport range, including narrow mobile screens. Accessibility is part of
feature completion, not a follow-up enhancement.

### IV. Simple Static-First Architecture
The application MUST remain deployable as static browser files without a backend, runtime
third-party dependency, network service, account, or persistent user-data store. New
dependencies or services require a constitution amendment describing the unmet need and
the resulting maintenance and privacy costs. This keeps the project easy to run, inspect,
and test.

### V. Specification and Test Discipline
User-visible behavior and domain changes MUST be specified before implementation.
Automated tests MUST cover changed behavior and affected invariants, and existing
regression tests MUST pass before a change is considered complete. Test scenarios MUST
include deterministic inputs where randomness is involved.

## Project Constraints

- The product is a browser-based, static web application using HTML, CSS, and native
  JavaScript modules.
- The application MUST NOT send data to external services or store user changes between
  page loads.
- Political labels, voting results, boundaries, locations, and demographic details MUST
  remain clearly fictional and MUST NOT imply real-world accuracy.
- A feature that changes an established behavior or product constraint MUST update its
  specification and tests together.

## Development Workflow and Quality Gates

- Each feature specification and plan MUST include a constitution compliance check before
  implementation and a second check after design.
- Changes MUST extend the repository's browser-based tests for new behavior and preserve
  existing behavior unless the specification explicitly changes it.
- Validation MUST cover keyboard use and responsive layouts when a change affects
  interaction or presentation.
- Any proposed conflict with this constitution MUST be resolved by amending the
  constitution before implementation; a plan MUST NOT silently waive a principle.

## Governance

- This constitution is authoritative for project principles and constraints. Specifications,
  plans, and implementation details MUST conform to it.
- An amendment MUST state its rationale and scope, identify affected principles and project
  artifacts, and be reviewed and approved by the project maintainer before adoption.
- Version numbers follow semantic versioning: MAJOR for backward-incompatible governance
  changes or principle removals/redefinitions, MINOR for a new principle or materially
  expanded guidance, and PATCH for clarifications or non-semantic wording changes.
- Feature plans and code reviews MUST check compliance with this constitution. Compliance
  is verified through acceptance criteria, automated tests, and documented manual checks
  where automation is not practical.

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE): confirm original adoption date | **Last Amended**: 2026-10-22
