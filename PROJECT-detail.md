# PROJECT-detail.md — Forensic Document Examination Research Advisor

## 1. Problem Statement

A professional-support and educational skill helping legal professionals, students, and researchers understand established forensic document examination (FDE) methodology for signature and handwriting comparison, grounded in ASTM/SWGDOC standards and forensic-science research on the field's validated reliability limits. It explicitly does not render a verdict on whether any real, specific signature or document is genuine or forged, and always directs actual cases to a certified forensic document examiner (e.g., ABFDE-certified) and proper chain-of-custody procedures.

## 2. Target Users

Describe the primary user personas for this skill (fill in based on real usage once built): e.g., students, professionals, hobbyists, or practitioners in the relevant domain.

## 3. Functional Specification

### 3.1 Core Capabilities

- Explain the standard forensic document examination methodology (exemplar collection, feature comparison, class vs. individual characteristics)
- Explain handwriting/signature comparison principles (line quality, pressure patterns, letter formation, natural variation ranges)
- Explain the field's documented reliability research, including known error rates and scientific-validity critiques (e.g., NAS 2009 report findings)
- Explain document-dating and material-analysis methods conceptually (ink dating, paper analysis, indented-writing/ESDA techniques)
- Support chain-of-custody and exemplar-collection best-practice education for legal professionals
- Explicitly refuse to render a 'genuine/forged' verdict about any real, specific signature or document
- Always direct actual authentication needs to a certified forensic document examiner and proper legal procedure

### 3.2 Key Methodologies & Frameworks Applied

- **ASTM/SWGDOC (Scientific Working Group for Forensic Document Examination) standards**
- **Class characteristics vs. individual characteristics comparison framework**
- **Natural variation range analysis in handwriting comparison**
- **Indented-writing analysis (ESDA — Electrostatic Detection Apparatus) conceptual methodology**
- **NAS (National Academy of Sciences) 2009 forensic-science reliability critique framework**

Each framework above should be operationalized as a concrete step, checklist, or template inside the skill's SKILL.md and reference files once this scaffold is turned into a runnable skill (see `DEVELOPMENT-TASK-BY-PHASES.md`).

### 3.3 Expected Input

Typical user requests this skill should handle (fill in with real example prompts during development and testing).

### 3.4 Expected Output Format

Define the structured output format(s) this skill should produce (e.g., structured report, checklist, scored recommendation, memo). Align with the methodologies above so outputs are consistent and auditable.

## 4. Out of Scope / Guardrails

- Always include the standing disclaimer for this domain (see CLAUDE.md).
- Never present output as a certified/professional determination (e.g., not a diagnosis, not a legal opinion, not a guaranteed forecast).
- Where the skill involves a named third party (e.g., a partner, a suspect, a specific person), do not produce a definitive judgment about that individual — stay at the level of general, population-based information and structured reasoning support.
- Flag explicitly when a licensed professional (doctor, lawyer, engineer, certified analyst, etc.) should be consulted.

## 5. Knowledge Base Dependency

This skill's reasoning quality depends on the research foundations catalogued in `SECOND-BRAIN-KNOWLEDGE-PAPER.md`. When building the actual skill (SKILL.md + references/), extract the operational principles from each paper into concrete reference files rather than leaving them as a flat reading list.

## 6. Success Criteria

- Output correctly applies the named methodologies rather than generic reasoning.
- Output is well-structured and consistent across repeated runs on similar inputs.
- Domain-appropriate guardrails/disclaimers are respected in every response.
- Test prompts (see `DEVELOPMENT-TASK-BY-PHASES.md`, Phase 5) produce outputs a subject-matter-competent reviewer would rate as sound.
